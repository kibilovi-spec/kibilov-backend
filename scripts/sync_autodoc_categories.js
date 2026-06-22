require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function slugify(name) {
  return name.toLowerCase()
    .replace(/[&\/\\#+()$~%.'":*?<>{}]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function fetchCategories(vehicleId) {
  const r = await fetch(
    `https://${HOST}/api/category/type-id/1/products-groups-variant-4/${vehicleId}/lang-id/4`,
    { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST } }
  );
  return (await r.json()).categories || [];
}

async function main() {
  const vehicleIds = [19942, 8456, 8800, 14814, 8963, 3547, 8994, 4579];
  const allCats = new Map();
  for (const vid of vehicleIds) {
    try {
      const cats = await fetchCategories(vid);
      for (const c of cats) allCats.set(c.categoryId, { name: c.categoryName, level: c.level });
      console.log(`vehicle ${vid}: ${cats.length} cats`);
      await sleep(400);
    } catch(e) { console.error(`${vid}: ${e.message}`); }
  }
  console.log(`\nTotal unique: ${allCats.size}`);
  let n = 0;
  for (const [id, c] of allCats) {
    await prisma.$executeRaw`
      INSERT INTO autodoc_category_map (autodoc_id, slug, name_en)
      VALUES (${id}, ${slugify(c.name)}, ${c.name})
      ON CONFLICT (autodoc_id) DO UPDATE SET slug=EXCLUDED.slug, name_en=EXCLUDED.name_en
    `;
    n++;
  }
  console.log(`✅ synced: ${n}`);
  const top = await prisma.$queryRaw`SELECT autodoc_id, name_en FROM autodoc_category_map ORDER BY autodoc_id LIMIT 20`;
  top.forEach(c => console.log(`  ${c.autodoc_id}: ${c.name_en}`));
  await prisma.$disconnect();
}
main().catch(console.error);
