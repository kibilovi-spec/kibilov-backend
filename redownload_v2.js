const https = require('https');
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({host:'127.0.0.1',database:'kibilov_db',user:'postgres',password:'Anarkia199090',port:5432});
const dir = '/var/www/kibilov-frontend/public/images/categories/';
const PNG = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);

function download(id) {
  return new Promise((resolve) => {
    const url = `https://scdn.autodoc.de/catalog/categories/300x300/${id}.png`;
    https.get(url, (res) => {
      if (res.statusCode !== 200) { res.resume(); resolve(false); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length > 500) {
          fs.writeFileSync(`${dir}${id}.png`, buf);
          resolve(true);
        } else resolve(false);
      });
    }).on('error', () => resolve(false));
  });
}

async function main() {
  const {rows} = await pool.query('SELECT DISTINCT autodoc_id FROM autodoc_categories WHERE autodoc_id IS NOT NULL ORDER BY autodoc_id');
  await pool.end();
  
  let ok=0, fail=0;
  for (const {autodoc_id} of rows) {
    const r = await download(autodoc_id);
    if(r) ok++; else fail++;
    if((ok+fail) % 50 === 0) console.log(`${ok+fail}/${rows.length} — ok:${ok} fail:${fail}`);
  }
  console.log(`\nDone: ${ok} ok, ${fail} failed`);
}
main().catch(console.error);
