const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const BASE = `https://${HOST}`;
const headers = { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': HOST };

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getArticleInfo(articleNo) {
  const url = `${BASE}/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(articleNo)}&articleType=ArticleNumber`;
  const r = await fetch(url, { headers });
  const d = await r.json();
  const articles = d.articles || [];
  if (articles.length > 0) return { articleId: articles[0].articleId, supplierId: articles[0].supplierId };
  return null;
}

async function getCrossRefs(supplierId, articleNo) {
  const url = `${BASE}/api/artlookup/search-for-cross-references-through-oem-numbers`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `supplierId=${supplierId}&articleNo=${encodeURIComponent(articleNo)}`
  });
  const d = await r.json();
  return (d.articles || []).map(a => a.crossNumber).filter(Boolean);
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      oemCodes: { isEmpty: false }
    },
    select: { id: true, nameKa: true, oemCodes: true, alternativeSearchKeys: true },
    take: 100
  });

  console.log(`Processing ${products.length} products...`);
  let enriched = 0, failed = 0, reqCount = 0;

  for (const product of products) {
    const rawOem = product.oemCodes[0] || '';
    const oem = rawOem.replace(/\s/g, '');
    if (!oem || oem.length < 4 || oem.startsWith('SKU')) { failed++; continue; }

    try {
      const info = await getArticleInfo(oem);
      reqCount++;
      await sleep(200);

      if (!info) { failed++; continue; }

      const crossRefs = await getCrossRefs(info.supplierId, oem);
      reqCount++;
      await sleep(200);

      if (crossRefs.length === 0) { failed++; continue; }

      const existing = new Set(product.alternativeSearchKeys || []);
      const newKeys = crossRefs.filter(c => !existing.has(c)).slice(0, 50);

      if (newKeys.length > 0) {
        await prisma.product.update({
          where: { id: product.id },
          data: { alternativeSearchKeys: { push: newKeys } }
        });
        enriched++;
        console.log(`[${enriched}] ${product.nameKa.slice(0,40)} +${newKeys.length} codes`);
      }
    } catch(e) {
      failed++;
      console.error(`Error for ${oem}:`, e.message);
      await sleep(1000);
    }
  }

  console.log(`\nDone! Enriched: ${enriched}, Failed: ${failed}, Requests: ${reqCount}`);
  await prisma.$disconnect();
}

main();
