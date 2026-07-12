'use strict';
// Retrospective აუდიტი — ვამოწმებთ, უკვე-არსებულ სურათებს ჰქონდათ თუ არა
// enrich_images_cross.js-ის ძველი, არასწორი ლოგიკის ეფექტი. DRY-RUN — არაფერს
// არ ცვლის, მხოლოდ ლოგში (და ცალკე რეპორტ-ფაილში) წერს საეჭვო შემთხვევებს.
// შენიშვნა: საჭიროებს ცოცხალ RapidAPI/Autodoc წვდომას — თუ Suspended-ია,
// სკრიპტი ამას ცხადად იტყვის და შეჩერდება, ცრუ-დადებითი "ვერ მოიძებნას" ნაცვლად.
require('dotenv').config();
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const KEY = process.env.RAPIDAPI_KEY || '98fcf77b13msh4c667e538cb11e8p15f12djsn70f2d789b288';
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const BASE = `https://${HOST}`;
const headers = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getArticleInfo(sku) {
  const clean = sku.replace(/\s+/g, '');
  const r = await fetch(`${BASE}/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(clean)}&articleType=ArticleNumber`, { headers });
  if (r.status === 403) {
    const body = await r.json().catch(() => ({}));
    throw new Error(`API_SUSPENDED: ${body.message || r.status}`);
  }
  if (!r.ok) throw new Error(`API_ERROR: HTTP ${r.status}`);
  const d = await r.json();
  const art = (d.articles || [])[0];
  if (!art) return null; // ეს ახლა ნამდვილად ნიშნავს "ვერ მოიძებნა", API-ერორი არა
  return { articleId: art.articleId, supplierName: art.supplierName || '' };
}

function brandsMatch(ourBrand, autodocSupplierName) {
  if (!ourBrand || !autodocSupplierName) return false;
  const a = ourBrand.trim().toUpperCase();
  const b = autodocSupplierName.trim().toUpperCase();
  return a === b || a.includes(b) || b.includes(a);
}

(async () => {
  // jer სწრაფი health-check — თუ API Suspended-ია, ერთი მოთხოვნით ეს ცხადი გახდება
  try {
    await getArticleInfo('GDB4605'); // ცნობილი, რეალური Autodoc-კოდი health-check-ისთვის
  } catch (e) {
    console.log(`❌ ვერ ვიწყებ აუდიტს — Autodoc API მიუწვდომელია: ${e.message}`);
    console.log('სცადეთ ხელახლა, როცა RapidAPI Pro გეგმა აღდგება.');
    await prisma.$disconnect();
    process.exit(1);
  }

  const products = await prisma.$queryRaw`
    SELECT id, sku, brand, "nameKa"
    FROM products
    WHERE "isActive" = true
    AND images IS NOT NULL AND images != '{}'
    AND sku NOT LIKE 'BB%' AND sku NOT LIKE 'SAK%'
    AND sku NOT LIKE 'KFC%' AND sku NOT LIKE 'SB%'
    AND sku NOT LIKE 'LF%' AND sku NOT LIKE 'MF%'
    AND sku NOT LIKE 'WO%' AND sku NOT LIKE 'GB-%'
    ORDER BY sku
  `;
  console.log(`API ხელმისაწვდომია. სულ ${products.length} პროდუქტი შესამოწმებელი.\n`);

  const suspects = [];
  let checked = 0, noMatch = 0;
  for (const p of products) {
    try {
      const found = await getArticleInfo(p.sku);
      if (found && !brandsMatch(p.brand, found.supplierName)) {
        suspects.push({ sku: p.sku, nameKa: p.nameKa, ourBrand: p.brand, autodocBrand: found.supplierName, productId: p.id });
        console.log(`⚠️  საეჭვო: ${p.sku} (${p.brand}) — Autodoc: "${found.supplierName}"`);
      }
    } catch (e) {
      console.log(`❌ ${p.sku}: ${e.message} — აუდიტი შეჩერდა`);
      break;
    }
    checked++;
    if (checked % 50 === 0) console.log(`... პროგრესი: ${checked}/${products.length}`);
    await sleep(300);
  }

  const reportPath = '/var/www/kibilov-backend/scripts/image-brand-audit-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(suspects, null, 2));
  console.log(`\n=== დასრულდა: ${checked} შემოწმდა, ${suspects.length} საეჭვო ნაპოვნია ===`);
  console.log(`სრული რეპორტი: ${reportPath}`);
  await prisma.$disconnect();
})();
