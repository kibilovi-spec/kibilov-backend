const { PrismaClient } = require('@prisma/client');
const autodoc = require('../src/services/autodoc.js');
const prisma = new PrismaClient();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getSupplierId(articleNo) {
  const d = await autodoc.searchByArticleNo(articleNo, 'ArticleNumber', 4);
  const a = (d.articles || [])[0];
  return a ? a.supplierId : null;
}

async function main() {
  const products = await prisma.product.findMany({
    where: { oemCodes: { isEmpty: false }, alternativeSearchKeys: { isEmpty: true } },
    select: { id: true, nameKa: true, oemCodes: true, alternativeSearchKeys: true },
  });
  console.log(`Total: ${products.length}`);
  let enriched = 0, failed = 0, viaAnalog = 0, req = 0;

  for (const p of products) {
    const oem = (p.oemCodes[0] || '').replace(/\s/g, '');
    if (!oem || oem.length < 4 || oem.startsWith('SKU')) { failed++; continue; }
    try {
      const supplierId = await getSupplierId(oem); req++;
      await sleep(250);
      if (!supplierId) { failed++; continue; }

      const crossData = await autodoc.getCrossRefsBySupplierAndNo(supplierId, oem); req++;
      await sleep(250);
      let refs = (crossData.articles || []).map(a => a.crossNumber).filter(Boolean);

      // Fallback: თუ ზუსტი cross-ref ვერ იპოვა, ვცადოთ ანალოგები OEM-ით
      if (!refs.length) {
        try {
          const analogData = await autodoc.getAnalogByArticleNo(oem, oem, 4); req++;
          await sleep(250);
          refs = (analogData.articles || []).map(a => a.articleNo).filter(Boolean);
          if (refs.length) viaAnalog++;
        } catch (e) { /* ignore analog fallback errors */ }
      }

      if (!refs.length) { failed++; continue; }

      const existing = new Set(p.alternativeSearchKeys || []);
      const newKeys = refs.filter(c => !existing.has(c)).slice(0, 50);
      if (newKeys.length) {
        await prisma.product.update({ where: { id: p.id }, data: { alternativeSearchKeys: { push: newKeys } } });
        enriched++;
      } else {
        failed++;
      }

      if (req % 100 === 0) console.log(`req:${req} enriched:${enriched} (analog:${viaAnalog}) failed:${failed}`);
    } catch (e) {
      failed++;
      await sleep(1000);
    }
  }
  console.log(`Done! enriched:${enriched} (via analog fallback: ${viaAnalog}) failed:${failed} req:${req}`);
  await prisma.$disconnect();
}
main();
