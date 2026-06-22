const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const H = { 'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com', 'x-rapidapi-key': '98fcf77b13msh4c667e538cb11e8p15f12djsn70f2d789b288' };
const prisma = new PrismaClient();
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const cats = await prisma.$queryRaw`SELECT autodoc_id, name_en FROM autodoc_categories WHERE level=2 ORDER BY autodoc_id`;
  console.log(`Total: ${cats.length}`);
  
  const dst = '/var/www/kibilov-frontend/public/images/categories';
  let ok = 0, skip = 0;
  
  for (const cat of cats) {
    const imgPath = `${dst}/${cat.autodoc_id}.png`;
    if (fs.existsSync(imgPath)) { skip++; continue; }
    try {
      const r = await fetch(`https://autodoc-parts-catalog.p.rapidapi.com/api/articles/list/type-id/1/vehicle-id/19942/category-id/${cat.autodoc_id}/lang-id/4`, {headers: H});
      const d = await r.json();
      const art = (d.articles || []).find(a => a.s3image);
      if (art?.s3image) {
        const imgR = await fetch(art.s3image);
        const buf = Buffer.from(await imgR.arrayBuffer());
        fs.writeFileSync(imgPath, buf);
        ok++;
        if (ok % 20 === 0) console.log(`✅ ${ok} done, last: ${cat.name_en}`);
      }
      await sleep(150);
    } catch(e) {}
  }
  console.log(`Done! ${ok} new, ${skip} skipped`);
  await prisma.$disconnect();
})();
