const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const BASE = `https://${HOST}`;
const headers = { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': HOST };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getArticleInfo(articleNo) {
  const r = await fetch(`${BASE}/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(articleNo)}&articleType=ArticleNumber`, { headers });
  const d = await r.json();
  const a = (d.articles||[])[0];
  return a ? { supplierId: a.supplierId } : null;
}

async function getCrossRefs(supplierId, articleNo) {
  const r = await fetch(`${BASE}/api/artlookup/search-for-cross-references-through-oem-numbers`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `supplierId=${supplierId}&articleNo=${encodeURIComponent(articleNo)}`
  });
  const d = await r.json();
  return (d.articles||[]).map(a=>a.crossNumber).filter(Boolean);
}

async function main() {
  const products = await prisma.product.findMany({
    where: { oemCodes: { isEmpty: false }, alternativeSearchKeys: { isEmpty: true } },
    select: { id: true, nameKa: true, oemCodes: true, alternativeSearchKeys: true },
  });

  console.log(`Total: ${products.length}`);
  let enriched=0, failed=0, req=0;

  for (const p of products) {
    const oem = (p.oemCodes[0]||'').replace(/\s/g,'');
    if (!oem || oem.length < 4 || oem.startsWith('SKU')) { failed++; continue; }
    try {
      const info = await getArticleInfo(oem); req++;
      await sleep(250);
      if (!info) { failed++; continue; }
      const refs = await getCrossRefs(info.supplierId, oem); req++;
      await sleep(250);
      if (!refs.length) { failed++; continue; }
      const existing = new Set(p.alternativeSearchKeys||[]);
      const newKeys = refs.filter(c=>!existing.has(c)).slice(0,50);
      if (newKeys.length) {
        await prisma.product.update({ where:{id:p.id}, data:{alternativeSearchKeys:{push:newKeys}} });
        enriched++;
      }
      if (req % 100 === 0) console.log(`req:${req} enriched:${enriched} failed:${failed}`);
    } catch(e) { failed++; await sleep(1000); }
  }
  console.log(`Done! enriched:${enriched} failed:${failed} req:${req}`);
  await prisma.$disconnect();
}
main();
