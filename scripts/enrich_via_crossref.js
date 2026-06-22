const { config } = require('dotenv');
config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const BASE = `https://${HOST}`;
const hdrs = () => ({ 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function artlookup(articleNo) {
  const url = `${BASE}/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(articleNo)}&articleType=ArticleNumber`;
  const r = await fetch(url, { headers: hdrs() });
  const d = await r.json();
  return (d?.articles || [])[0] || null;
}

async function getCrossRefs(supplierId, articleNo) {
  const r = await fetch(`${BASE}/api/artlookup/search-for-cross-references-through-oem-numbers`, {
    method: 'POST',
    headers: { ...hdrs(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `supplierId=${supplierId}&articleNo=${encodeURIComponent(articleNo)}`
  });
  const d = await r.json();
  return (d?.articles || []).map(a => a.crossNumber?.replace(/[\s\-\.]/g, '').toUpperCase()).filter(Boolean);
}

function extractCodes(oemCodes) {
  const SKIP = ['MERCEDES','VW','BMW','TOYOTA','BOSCH','HYUNDAI','KIA','BENZ','FORD','OPEL'];
  return oemCodes
    .map(c => c.replace(/[\s\-\.]/g, '').toUpperCase())
    .filter(c => c.length >= 4 && c.length <= 20 && !SKIP.some(s => c.includes(s)));
}

async function main() {
  const products = await prisma.product.findMany({
    where: { oemCodes: { isEmpty: false } },
    select: { id: true, nameKa: true, oemCodes: true, alternativeSearchKeys: true },
  });

  console.log(`სულ: ${products.length} პროდუქტი`);
  let enriched = 0, failed = 0, skipped = 0;

  for (const p of products) {
    const codes = extractCodes(p.oemCodes);
    if (!codes.length) { skipped++; continue; }

    try {
      const allKeys = new Set(p.alternativeSearchKeys || []);
      let found = false;

      for (const code of codes.slice(0, 2)) {
        await sleep(350);
        const art = await artlookup(code);
        if (!art) continue;

        await sleep(350);
        const crossRefs = await getCrossRefs(art.supplierId, code);
        if (!crossRefs.length) continue;

        crossRefs.forEach(c => allKeys.add(c));
        found = true;
        break;
      }

      if (found) {
        await prisma.product.update({
          where: { id: p.id },
          data: { alternativeSearchKeys: [...allKeys].slice(0, 100) }
        });
        enriched++;
        if (enriched % 20 === 0) console.log(`✅ enriched: ${enriched} | failed: ${failed} | skipped: ${skipped}`);
      } else {
        failed++;
      }
    } catch(e) {
      failed++;
      console.error(p.nameKa?.slice(0,40), e.message);
      await sleep(1000);
    }
  }

  console.log(`\n✅ Done! enriched: ${enriched} | failed: ${failed} | skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(console.error);
