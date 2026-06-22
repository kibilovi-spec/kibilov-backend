require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const hdrs = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getCrossRefs(articleId) {
  const r = await fetch(`https://${HOST}/api/artlookup/select-article-cross-references/article-id/${articleId}/lang-id/4`, { headers: hdrs });
  const d = await r.json();
  return d?.articleCrossReferences || [];
}

async function getArticlesByVehicleCategory(vehicleId, categoryId) {
  const r = await fetch(`https://${HOST}/api/articles/list/type-id/1/vehicle-id/${vehicleId}/category-id/${categoryId}/lang-id/4`, { headers: hdrs });
  const d = await r.json();
  return d?.articles || [];
}

async function getOemsByArticleIds(articleIds) {
  const r = await fetch(`https://${HOST}/api/articles/get-oems-by-list-of-articles-ids`, {
    method: 'POST',
    headers: { ...hdrs, 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleIds })
  });
  return r.json();
}

async function main() {
  console.log('🔗 OEM Cross-Reference Graph Builder\n');

  // კატეგორიები × მანქანები
  const vehicleCategories = [
    { vehicleId: 8448, label: 'Golf 6 1.6', categories: [100030, 100032, 100121, 100226, 100579] },
    { vehicleId: 10890, label: 'W204 C220', categories: [100030, 100032, 100121, 100259, 100452] },
    { vehicleId: 5972, label: 'BMW E46', categories: [100030, 100032, 100121, 100226, 100579] },
    { vehicleId: 19942, label: 'Ford Transit', categories: [100030, 100032, 100121] },
  ];

  let added = 0, skipped = 0, errors = 0;

  for (const vc of vehicleCategories) {
    for (const catId of vc.categories) {
      console.log(`📦 ${vc.label} cat:${catId}`);
      try {
        const articles = await getArticlesByVehicleCategory(vc.vehicleId, catId);
        await sleep(500);
        if (!articles.length) continue;

        const articleIds = articles.slice(0, 10).map(a => a.articleId);
        const oemsData = await getOemsByArticleIds(articleIds);
        await sleep(500);

        const oemCodes = (oemsData?.articles || [])
          .flatMap(a => a.oemNo?.map(o => o.oemDisplayNo.replace(/[\s\-\.]/g,'').toUpperCase()) || []);

        // cross-refs for each article
        for (const articleId of articleIds.slice(0, 5)) {
          try {
            const refs = await getCrossRefs(articleId);
            await sleep(300);

            for (const ref of refs) {
              if (!ref.articleNo || !ref.supplierName) continue;
              const articleNo = ref.articleNo.replace(/[\s\-\.]/g,'').toUpperCase();
              
              // ყოველ OEM კოდს დავუკავშიროთ
              for (const oemCode of oemCodes.slice(0, 3)) {
                try {
                  await prisma.$executeRaw`
                    INSERT INTO cross_reference (oem_code, article_number, brand)
                    VALUES (${oemCode}, ${articleNo}, ${ref.supplierName})
                    ON CONFLICT DO NOTHING
                  `;
                  added++;
                } catch(e) { skipped++; }
              }
            }
          } catch(e) { errors++; }
        }
      } catch(e) {
        console.log(`  ❌ ${e.message}`);
        errors++;
      }
      await sleep(1000);
    }
  }

  const total = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM cross_reference`;
  console.log(`\n✅ დასრულდა!`);
  console.log(`   added: ${added}, skipped: ${skipped}, errors: ${errors}`);
  console.log(`   სულ cross_reference: ${Number(total[0].cnt)}`);
  await prisma.$disconnect();
}

main().catch(console.error);
