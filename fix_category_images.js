const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  host: '127.0.0.1',
  database: 'kibilov_db',
  user: 'postgres',
  password: 'Anarkia199090',
  port: 5432
});

function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

async function main() {
  const { rows } = await pool.query(
    'SELECT id, name_en, autodoc_id FROM autodoc_categories WHERE autodoc_id IS NOT NULL ORDER BY level, id'
  );
  
  console.log(`Total categories: ${rows.length}`);
  
  let updated = 0;
  let failed = 0;
  
  for (const row of rows) {
    const url = `https://scdn.autodoc.de/img_cat/${row.autodoc_id}.webp`;
    const ok = await checkUrl(url);
    
    if (ok) {
      await pool.query(
        'UPDATE autodoc_categories SET image_url = $1 WHERE id = $2',
        [url, row.id]
      );
      updated++;
      if (updated % 50 === 0) console.log(`Updated: ${updated}/${rows.length}`);
    } else {
      failed++;
      console.log(`MISS: ${row.name_en} (autodoc_id: ${row.autodoc_id})`);
    }
  }
  
  console.log(`\nDone! Updated: ${updated}, Failed: ${failed}`);
  await pool.end();
}

main().catch(console.error);
