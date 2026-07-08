const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host:'127.0.0.1', database:'kibilov_db',
  user:'postgres', password:'Anarkia199090', port:5432
});

const PNG_HEADER = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
const dir = '/var/www/kibilov-frontend/public/images/categories/';

function isCorrupt(filename) {
  try {
    const buf = Buffer.alloc(8);
    const fd = fs.openSync(dir+filename,'r');
    fs.readSync(fd,buf,0,8,0);
    fs.closeSync(fd);
    return !buf.equals(PNG_HEADER);
  } catch { return true; }
}

async function main() {
  // ყველა numeric PNG ფაილი
  const corrupt = fs.readdirSync(dir)
    .filter(f => /^\d+\.png$/.test(f) && isCorrupt(f))
    .map(f => parseInt(f));
  
  console.log(`Corrupt files: ${corrupt.length}`, corrupt);
  
  if (!corrupt.length) { console.log('All clean!'); await pool.end(); return; }
  
  // parent სურათი ჩავუწეროთ
  const r = await pool.query(`
    UPDATE autodoc_categories c
    SET image_url = p.image_url
    FROM autodoc_categories p
    WHERE p.autodoc_id = c.parent_id
      AND c.autodoc_id = ANY($1)
      AND p.image_url LIKE '/images/categories/1%.png'
  `, [corrupt]);
  
  console.log(`Fixed: ${r.rowCount}`);
  await pool.end();
}
main().catch(console.error);
