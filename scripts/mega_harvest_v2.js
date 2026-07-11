require('dotenv').config({ path: '/var/www/kibilov-backend/.env' });
const { PrismaClient } = require('@prisma/client');
const autodoc = require('../src/services/autodoc');
const fs = require('fs');
const prisma = new PrismaClient();

const CHECKPOINT_FILE = '/var/www/kibilov-backend/scripts/mega_harvest_v2.checkpoint.json';
const SLEEP_MS = 200; // ~5 req/sec, უსაფრთხო 25/sec ლიმიტის ქვეშ
const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadCheckpoint() {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')); }
  catch { return { phase1Done: false, phase2Done: false, phase3ModelIndex: 0, stats: {} }; }
}
function saveCheckpoint(cp) { fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2)); }

let totalCalls = 0;
function logProgress(msg) {
  const line = `[${new Date().toISOString()}] ${msg} (calls so far: ${totalCalls})`;
  console.log(line);
}

// ============ PHASE 1: პროდუქტების Article ID-ზე დამთხვევა ============
async function phase1_matchProducts() {
  logProgress('PHASE 1 დაწყება: პროდუქტების დამთხვევა Article ID-ზე');
  const products = await prisma.product.findMany({
    where: { autodocArticleId: null },
    select: { id: true, sku: true, oemCodes: true, articleNumber: true },
  });
  logProgress(`სამთხვევია ${products.length} პროდუქტი`);
  let matched = 0, failed = 0;

  for (const p of products) {
    const candidates = [p.articleNumber, p.sku, ...(p.oemCodes || [])].filter(Boolean);
    let found = false;
    for (const candidate of candidates.slice(0, 3)) {
      try {
        const clean = candidate.replace(/\s/g, '');
        const d = await autodoc.searchByArticleNo(clean, 'ArticleNumber', 4);
        totalCalls++;
        const art = (d.articles || [])[0];
        if (art && art.articleId) {
          await prisma.product.update({
            where: { id: p.id },
            data: { autodocArticleId: BigInt(art.articleId) },
          });
          matched++;
          found = true;
          break;
        }
        await sleep(SLEEP_MS);
      } catch (e) { await sleep(SLEEP_MS * 2); }
    }
    if (!found) failed++;
    if ((matched + failed) % 100 === 0) logProgress(`Phase1 პროგრესი: matched=${matched} failed=${failed} / ${products.length}`);
  }
  logProgress(`PHASE 1 დასრულდა: matched=${matched} failed=${failed}`);
  return { matched, failed };
}

// ============ PHASE 2: არსებული პროდუქტების სრული გამდიდრება ============
async function phase2_enrichProducts() {
  logProgress('PHASE 2 დაწყება: პროდუქტების სრული გამდიდრება (specs+OEM+compatibility)');
  const products = await prisma.product.findMany({
    where: { autodocArticleId: { not: null } },
    select: { id: true, autodocArticleId: true, oemCodes: true, descriptionEn: true, compatibility: true },
  });
  logProgress(`გასამდიდრებელია ${products.length} პროდუქტი`);
  let enriched = 0, failed = 0;

  for (const p of products) {
    try {
      const data = await autodoc.getArticleFullDetails(Number(p.autodocArticleId));
      totalCalls++;
      const a = data.article || {};
      const newOemCodes = (a.oemNo || []).map(o => o.oemDisplayNo).filter(Boolean);
      const existingOem = new Set(p.oemCodes || []);
      const mergedOem = [...new Set([...p.oemCodes, ...newOemCodes])];
      const compatArr = (a.compatibleCars || []).map(c => ({
        manufacturer: c.manufacturerName, model: c.modelName,
        engine: c.typeEngineName, from: c.constructionIntervalStart, to: c.constructionIntervalEnd,
      }));
      const specsText = (a.allSpecifications || []).map(s => `${s.criteriaName}: ${s.criteriaValue}`).join('; ');

      await prisma.product.update({
        where: { id: p.id },
        data: {
          oemCodes: mergedOem,
          compatibility: JSON.stringify(compatArr),
          descriptionEn: p.descriptionEn || specsText || null,
        },
      });
      enriched++;
      await sleep(SLEEP_MS);
    } catch (e) { failed++; await sleep(SLEEP_MS * 2); }
    if ((enriched + failed) % 100 === 0) logProgress(`Phase2 პროგრესი: enriched=${enriched} failed=${failed} / ${products.length}`);
  }
  logProgress(`PHASE 2 დასრულდა: enriched=${enriched} failed=${failed}`);
  return { enriched, failed };
}

// ============ PHASE 3: autodoc_reference_data-ს გაფართოება ============
const POPULAR_CATEGORY_IDS = [
  100030, 100032, 100033, 100027, 100121, 100581, 100579, 100197, 100575, 100583,
  100126, 100576, 100259, 100260, 100261, 100267, 100452, 100454, 100091, 100150,
  100155, 100135, 100136, 100229, 100226, 100231, 100051, 100055, 100190, 100192,
  100092, 100096, 100047, 100048, 100062, 100078, 100082, 100064, 100073, 100066,
  100067, 100158, 100133, 100114, 100115, 100043, 100042, 100046, 100703, 100714,
];

const CONCURRENCY = 10; // პარალელური request-ები (25/sec ლიმიტის ქვეშ, buffer-ით)

async function processCategoryForVehicle(model, v, catId) {
  try {
    const existing = await prisma.$queryRaw`
      SELECT id FROM autodoc_reference_data WHERE make = ${model.make.name} AND model = ${model.name} AND autodoc_category_id = ${catId} LIMIT 1
    `;
    if (existing.length > 0) return;

    const ad = await autodoc.getArticlesByVehicle(v.vehicleId, catId);
    totalCalls++;
    const articles = (ad.articles || []).slice(0, 5);

    for (const art of articles) {
      await prisma.$executeRaw`
        INSERT INTO autodoc_reference_data (make, model, category_en, autodoc_category_id, brand, article_code, article_id, description, created_at)
        VALUES (${model.make.name}, ${model.name}, ${String(catId)}, ${catId}, ${art.supplierName || ''}, ${art.articleNo || ''}, ${art.articleId ? BigInt(art.articleId) : null}, ${art.articleProductName || ''}, NOW())
      `;
    }
  } catch (e) { /* ignore single category failures */ }
}

async function runBatched(tasks, concurrency) {
  const results = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    await Promise.all(batch.map(fn => fn()));
    await sleep(SLEEP_MS); // batch-ებს შორის მცირე პაუზა rate-limit ბუფერისთვის
  }
  return results;
}

async function phase3_expandReferenceData(cp) {
  logProgress('PHASE 3 დაწყება: autodoc_reference_data გაფართოება (პარალელური batch-ებით)');
  const allModels = await prisma.vehicleModel.findMany({
    where: { autodoc_model_id: { not: null } },
    select: { id: true, autodoc_model_id: true, name: true, make: { select: { name: true } } },
    orderBy: { id: 'asc' },
  });
  logProgress(`სულ ${allModels.length} მოდელი, ვაგრძელებთ index ${cp.phase3ModelIndex}-დან`);

  for (let i = cp.phase3ModelIndex; i < allModels.length; i++) {
    const model = allModels[i];
    try {
      const vd = await autodoc.getVehicleListByModel(model.autodoc_model_id);
      totalCalls++;
      const vehicles = (vd.modelTypes || []).slice(0, 3);

      const tasks = [];
      for (const v of vehicles) {
        for (const catId of POPULAR_CATEGORY_IDS) {
          tasks.push(() => processCategoryForVehicle(model, v, catId));
        }
      }
      await runBatched(tasks, CONCURRENCY);
    } catch (e) {
      logProgress(`Model ${model.name} შეცდომა: ${e.message}`);
      await sleep(SLEEP_MS * 3);
    }

    cp.phase3ModelIndex = i + 1;
    if (i % 5 === 0) {
      saveCheckpoint(cp);
      logProgress(`Phase3 პროგრესი: model ${i + 1}/${allModels.length} (${model.name}) [calls: ${totalCalls}]`);
    }
  }
  logProgress('PHASE 3 დასრულდა');
}


// ============ PHASE 4: სურათები + ბრენდის ლოგოები ============
const https = require('https');
const path = require('path');
const IMG_DIR = '/var/www/kibilov-backend/uploads/autodoc_images';
const LOGO_DIR = '/var/www/kibilov-backend/uploads/brand_logos';

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) { file.close(); fs.unlink(destPath, () => {}); return reject(new Error('status ' + res.statusCode)); }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (e) => { file.close(); fs.unlink(destPath, () => {}); reject(e); });
  });
}

async function phase4_downloadImagesAndLogos() {
  logProgress('PHASE 4 დაწყება: სურათები + ბრენდის ლოგოები');
  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
  if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true });

  // 4a. ბრენდის ლოგოები
  try {
    const suppliers = await autodoc.getSuppliersList();
    totalCalls++;
    const list = suppliers.suppliers || suppliers || [];
    let logoOk = 0, logoFail = 0;
    for (const s of list) {
      const url = s.s3image || s.logo || s.image;
      if (!url) continue;
      const fname = `${s.supplierId || s.id}_${(s.supplierName||s.name||'brand').replace(/[^a-zA-Z0-9]/g,'_')}.webp`;
      const dest = path.join(LOGO_DIR, fname);
      if (fs.existsSync(dest)) continue;
      try { await downloadFile(url, dest); logoOk++; } catch(e) { logoFail++; }
      await sleep(50);
    }
    logProgress(`ბრენდის ლოგოები: ok=${logoOk} failed=${logoFail} / ${list.length}`);
  } catch (e) { logProgress('ლოგოების სია ვერ ჩამოვიტანე: ' + e.message); }

  // 4b. პროდუქტების სურათები (ლოკალურად ჩამოტვირთვა, S3 URL-ის სარეზერვოდ შენარჩუნებით)
  const products = await prisma.product.findMany({
    where: { images: { isEmpty: false } },
    select: { id: true, images: true },
  });
  logProgress(`სურათების ჩამოსატვირთია ${products.length} პროდუქტი`);
  let imgOk = 0, imgFail = 0;
  for (const p of products) {
    for (let idx = 0; idx < p.images.length; idx++) {
      const url = p.images[idx];
      if (!url || !url.startsWith('http')) continue;
      const ext = url.split('.').pop().split('?')[0].slice(0, 4) || 'webp';
      const fname = `${p.id}_${idx}.${ext}`;
      const dest = path.join(IMG_DIR, fname);
      if (fs.existsSync(dest)) continue;
      try { await downloadFile(url, dest); imgOk++; } catch(e) { imgFail++; }
      await sleep(30);
    }
    if ((imgOk + imgFail) % 200 === 0 && (imgOk+imgFail) > 0) logProgress(`Phase4 სურათები პროგრესი: ok=${imgOk} failed=${imgFail}`);
  }
  logProgress(`PHASE 4 დასრულდა: სურათები ok=${imgOk} failed=${imgFail}`);
}

// ============ PHASE 5: Cross-reference bulk ============
async function phase5_crossReferenceBulk() {
  logProgress('PHASE 5 დაწყება: Cross-reference bulk');
  const products = await prisma.product.findMany({
    where: { autodocArticleId: { not: null } },
    select: { id: true, autodocArticleId: true, oemCodes: true, brand: true },
  });
  logProgress(`Cross-reference-ისთვის ${products.length} პროდუქტი`);
  let inserted = 0, failed = 0;

  for (const p of products) {
    try {
      const cr = await autodoc.getCrossRefs(Number(p.autodocArticleId));
      totalCalls++;
      await sleep(SLEEP_MS);
      const refs = (cr.articles || []).slice(0, 20);
      for (const r of refs) {
        if (!r.crossNumber && !r.articleNo) continue;
        const artNo = r.crossNumber || r.articleNo;
        for (const oem of (p.oemCodes || []).slice(0, 2)) {
          try {
            await prisma.crossReference.upsert({
              where: { oemCode_articleNumber: { oemCode: oem, articleNumber: artNo } },
              update: {},
              create: { oemCode: oem, articleNumber: artNo, brand: r.crossManufacturerName || p.brand || '' },
            });
            inserted++;
          } catch (e) { /* unique constraint or missing compound key — try raw insert fallback */
            try {
              await prisma.$executeRaw`
                INSERT INTO cross_reference (oem_code, article_number, brand)
                VALUES (${oem}, ${artNo}, ${r.crossManufacturerName || p.brand || ''})
                ON CONFLICT DO NOTHING
              `;
              inserted++;
            } catch (e2) { failed++; }
          }
        }
      }
    } catch (e) { failed++; await sleep(SLEEP_MS * 2); }
  }
  logProgress(`PHASE 5 დასრულდა: inserted=${inserted} failed=${failed}`);
}

async function main() {
  const cp = loadCheckpoint();
  try {
    if (!cp.phase1Done) {
      const r = await phase1_matchProducts();
      cp.phase1Done = true; cp.stats.phase1 = r;
      saveCheckpoint(cp);
    } else logProgress('PHASE 1 უკვე დასრულებულია, გამოტოვება');

    if (!cp.phase2Done) {
      const r = await phase2_enrichProducts();
      cp.phase2Done = true; cp.stats.phase2 = r;
      saveCheckpoint(cp);
    } else logProgress('PHASE 2 უკვე დასრულებულია, გამოტოვება');

    await phase3_expandReferenceData(cp);
    cp.phase3Done = true;
    saveCheckpoint(cp);

    if (!cp.phase4Done) {
      await phase4_downloadImagesAndLogos();
      cp.phase4Done = true;
      saveCheckpoint(cp);
    } else logProgress('PHASE 4 უკვე დასრულებულია, გამოტოვება');

    if (!cp.phase5Done) {
      await phase5_crossReferenceBulk();
      cp.phase5Done = true;
      saveCheckpoint(cp);
    } else logProgress('PHASE 5 უკვე დასრულებულია, გამოტოვება');

    logProgress(`ყველა ფაზა დასრულდა! სულ API calls: ${totalCalls}`);
  } catch (e) {
    logProgress(`კრიტიკული შეცდომა: ${e.message}`);
    saveCheckpoint(cp);
  } finally {
    await prisma.$disconnect();
  }
}

main();
