const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: '127.0.0.1',
  database: 'kibilov_db',
  user: 'postgres',
  password: 'Anarkia199090',
  port: 5432
});

async function main() {
  // ლოკალური სურათების სია
  const files = fs.readdirSync('/var/www/kibilov-frontend/public/images/categories/')
    .filter(f => /^\d+\.png$/.test(f))
    .map(f => parseInt(f.replace('.png', '')));
  
  console.log(`Local images: ${files.length}`);
  
  // ყველა category autodoc_id-ით
  const { rows } = await pool.query(
    'SELECT id, name_en, autodoc_id FROM autodoc_categories WHERE autodoc_id IS NOT NULL'
  );
  
  let updated = 0;
  let missing = 0;
  
  for (const row of rows) {
    if (files.includes(row.autodoc_id)) {
      const url = `/images/categories/${row.autodoc_id}.png`;
      await pool.query('UPDATE autodoc_categories SET image_url = $1 WHERE id = $2', [url, row.id]);
      updated++;
    } else {
      missing++;
    }
  }
  
  console.log(`Updated: ${updated}, No image: ${missing}`);
  
  // missing-ებისთვის parent-ის სურათი გამოვიყენოთ
  const { rows: missRows } = await pool.query(`
    SELECT c.id, c.name_en, c.autodoc_id, c.parent_id, p.image_url as parent_img
    FROM autodoc_categories c
    JOIN autodoc_categories p ON p.id = c.parent_id
    WHERE c.image_url NOT LIKE '/images/categories/1%'
    AND p.image_url IS NOT NULL
  `);
  
  let inherited = 0;
  for (const row of missRows) {
    if (row.parent_img) {
      await pool.query('UPDATE autodoc_categories SET image_url = $1 WHERE id = $2', [row.parent_img, row.id]);
      inherited++;
    }
  }
  
  console.log(`Inherited from parent: ${inherited}`);
  await pool.end();
}

main().catch(console.error);
