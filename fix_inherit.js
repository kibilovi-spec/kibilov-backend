const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1', database: 'kibilov_db',
  user: 'postgres', password: 'Anarkia199090', port: 5432
});

async function main() {
  // level 2: parent (level 1) სურათი ავიღოთ
  const r1 = await pool.query(`
    UPDATE autodoc_categories c
    SET image_url = p.image_url
    FROM autodoc_categories p
    WHERE c.parent_id = p.id
      AND c.level = 2
      AND (c.image_url LIKE '/images/categories/auto_%' OR c.image_url LIKE '/images/categories/brakes%' OR c.image_url LIKE '/images/categories/antrieb%' OR c.image_url LIKE '/images/categories/auspuff%' OR c.image_url LIKE '/images/categories/karosserie%')
      AND p.image_url LIKE '/images/categories/1%.png'
    RETURNING c.id
  `);
  console.log('Level 2 inherited:', r1.rowCount);

  // level 3+: parent სურათი
  const r2 = await pool.query(`
    UPDATE autodoc_categories c
    SET image_url = p.image_url
    FROM autodoc_categories p
    WHERE c.parent_id = p.id
      AND c.level >= 3
      AND c.image_url NOT LIKE '/images/categories/1%.png'
      AND p.image_url LIKE '/images/categories/1%.png'
    RETURNING c.id
  `);
  console.log('Level 3+ inherited:', r2.rowCount);

  // რამდენი ჯერ კიდევ german filename აქვს
  const { rows } = await pool.query(`
    SELECT COUNT(*) FROM autodoc_categories 
    WHERE image_url LIKE '/images/categories/auto_%'
  `);
  console.log('Still german filename:', rows[0].count);

  await pool.end();
}
main().catch(console.error);
