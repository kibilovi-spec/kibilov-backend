const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const products = await prisma.$queryRaw`
    SELECT id, sku, "oemCodes" FROM products
    WHERE image_status = 'NO_IMAGE'
  `;
  console.log(`სულ პროდუქტი, ფოტოს გარეშე: ${products.length}`);

  let updated = 0, checked = 0, notFound = 0;
  const startTime = Date.now();

  for (const p of products) {
    checked++;
    const codes = (p.oemCodes && p.oemCodes.length) ? p.oemCodes : [p.sku];
    let found = false;

    for (const code of codes) {
      if (!code) continue;
      try {
        const url = `http://localhost:3001/api/autodoc/oem?code=${encodeURIComponent(code)}`;
        const r = await fetch(url);
        const d = await r.json();
        if (d.found && d.articles?.length > 0) {
          const withImage = d.articles.find(a => a.image);
          if (withImage) {
            await prisma.$executeRaw`
              UPDATE products SET images = ARRAY[${withImage.image}]::text[], image_status = 'AUTODOC_MATCHED'
              WHERE id = ${p.id}
            `;
            updated++;
            found = true;
            break;
          }
        }
      } catch (e) {}
      await sleep(200);
    }
    if (!found) notFound++;

    if (checked % 25 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[${elapsed}s] ${checked}/${products.length} შემოწმებული, ${updated} ფოტო დამატებული, ${notFound} ვერ მოიძებნა`);
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`შემოწმებული: ${checked}, ფოტო დამატებული: ${updated}, ვერ მოიძებნა: ${notFound}`);
  process.exit(0);
})();
