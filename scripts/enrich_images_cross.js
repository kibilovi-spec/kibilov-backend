require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const KEY = process.env.RAPIDAPI_KEY || '98fcf77b13msh4c667e538cb11e8p15f12djsn70f2d789b288';
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const BASE = `https://${HOST}`;
const headers = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };

const IMAGE_PRIORITY = ['ATE','BREMBO','TRW','TEXTAR','FERODO','BOSCH','PAGID','JURID','DELPHI','HELLA','MANN','MAHLE','SACHS','SKF','FEBI','VALEO','NGK'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getArticleId(sku) {
  try {
    const clean = sku.replace(/\s+/g, '');
    const r = await fetch(`${BASE}/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(clean)}&articleType=ArticleNumber`, { headers });
    const d = await r.json();
    const art = (d.articles || [])[0];
    if (!art) return null;
    return { articleId: art.articleId, supplierName: art.supplierName || '' };
  } catch { return null; }
}
// SKU-ს ავტოდეტექტირებული ბრენდი ნამდვილად უნდა ემთხვეოდეს ჩვენი
// პროდუქტის საკუთარ brand ველს, სანამ სურათს მივანიჭებთ — თორემ
// შემთხვევითი SKU-დამთხვევა სხვა ბრენდის ნაწილთან არასწორ სურათს გვაძლევს
function brandsMatch(ourBrand, autodocSupplierName) {
  if (!ourBrand || !autodocSupplierName) return false;
  const a = ourBrand.trim().toUpperCase();
  const b = autodocSupplierName.trim().toUpperCase();
  return a === b || a.includes(b) || b.includes(a);
}

async function getImageFromCrossRefs(articleId) {
  try {
    const r = await fetch(`${BASE}/api/artlookup/select-article-cross-references/article-id/${articleId}/lang-id/4`, { headers });
    const d = await r.json();
    const crosses = (d.articles || []).filter(a => a.s3image);
    if (!crosses.length) return null;

    // priority sort
    crosses.sort((a, b) => {
      const ai = IMAGE_PRIORITY.findIndex(p => (a.supplierName || '').toUpperCase().includes(p));
      const bi = IMAGE_PRIORITY.findIndex(p => (b.supplierName || '').toUpperCase().includes(p));
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    return crosses[0].s3image;
  } catch { return null; }
}

(async () => {
  // no image, autodoc-eligible, not local brand
  const products = await prisma.$queryRaw`
    SELECT id, sku, brand, "nameKa"
    FROM products
    WHERE "isActive" = true
    AND (images IS NULL OR images = '{}')
    AND sku NOT LIKE 'BB%' AND sku NOT LIKE 'SAK%'
    AND sku NOT LIKE 'KFC%' AND sku NOT LIKE 'SB%'
    AND sku NOT LIKE 'LF%' AND sku NOT LIKE 'MF%'
    AND sku NOT LIKE 'WO%' AND sku NOT LIKE 'GB-%'
    ORDER BY sku
    LIMIT 200
  `;

  console.log(`სულ ${products.length} პროდუქტი enrichment-სთვის`);
  let updated = 0, notFound = 0, brandMismatch = 0;

  for (const p of products) {
    const found = await getArticleId(p.sku);
    if (!found) { notFound++; await sleep(300); continue; }

    // 🛡️ დაცვა: SKU-ს Autodoc-ის ავტოდეტექტირებული ბრენდი უნდა ემთხვეოდეს
    // ჩვენი პროდუქტის რეალურ ბრენდს — თუ არა, ხელით ატვირთვას ვტოვებთ
    if (!brandsMatch(p.brand, found.supplierName)) {
      brandMismatch++;
      console.log(`⏭️  ${p.sku} გამოტოვებულია — ბრენდი არ ემთხვევა (ჩვენი: "${p.brand}", Autodoc: "${found.supplierName}")`);
      await sleep(300);
      continue;
    }

    const imageUrl = await getImageFromCrossRefs(found.articleId);
    if (!imageUrl) { notFound++; await sleep(300); continue; }

    await prisma.$executeRaw`
      UPDATE products SET images = ARRAY[${imageUrl}]::text[]
      WHERE id = ${p.id}
    `;
    updated++;
    console.log(`✅ ${p.sku} (${p.brand}) → ${imageUrl.split('/').pop()}`);
    await sleep(400);
  }

  console.log(`\n=== დასრულდა: ${updated} განახლდა, ${brandMismatch} ბრენდი არ ემთხვეოდა (ხელით ასატვირთი), ${notFound} ვერ მოიძებნა ===`);
  await prisma.$disconnect();
})();
