require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const autodoc = require('../src/services/autodoc');
const { Pool } = require('pg');

const prisma = new PrismaClient();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DELAY = 500;
const BATCH = parseInt(process.argv[2] || '50', 10);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const products = await pool.query(`
    SELECT p.id, p.sku, p."nameKa" FROM products p
    LEFT JOIN product_vehicle_compatibility pvc ON pvc.product_id = p.id
    WHERE pvc.id IS NULL AND p.autodoc_category_id IS NOT NULL
    LIMIT $1
  `, [BATCH]);

  console.log(`Enriching ${products.rows.length} products with vehicle compatibility`);
  let matched = 0, skipped = 0, errors = 0;

  for (const p of products.rows) {
    try {
      const search = await autodoc.searchByArticleNo(p.sku);
      if (!search?.articles?.length) { skipped++; await sleep(DELAY); continue; }

      const article = search.articles[0];
      let cars = [];
      try {
        cars = await autodoc.getCompatibleCars(article.articleNo, article.supplierId);
      } catch (e) { skipped++; await sleep(DELAY); continue; }

      if (cars?.length) {
        for (const car of cars.slice(0, 20)) {
          await pool.query(`
            INSERT INTO product_vehicle_compatibility 
            (product_id, vehicle_type_id, manufacturer_name, model_name, year_from, year_to, engine)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT DO NOTHING
          `, [p.id, car.vehicleTypeId || null, car.manufacturerName || '', 
              car.modelName || '', car.yearFrom || null, car.yearTo || null, car.engineName || '']);
        }
        matched++;
        console.log(`✓ ${p.sku}: ${cars.length} vehicles`);
      } else { skipped++; }
    } catch (e) {
      errors++;
      console.log(`✗ ${p.sku}: ${e.message}`);
    }
    await sleep(DELAY);
  }

  console.log(`\nMatched: ${matched}, Skipped: ${skipped}, Errors: ${errors}`);
  await pool.end();
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
