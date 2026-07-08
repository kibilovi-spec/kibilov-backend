const { chromium } = require('playwright');
const https = require('https');
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({host:'127.0.0.1',database:'kibilov_db',user:'postgres',password:'Anarkia199090',port:5432});
const dir = '/var/www/kibilov-frontend/public/images/categories/';

function downloadFile(url, dest) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode !== 200) { resolve(false); return; }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
    }).on('error', () => resolve(false));
  });
}

async function main() {
  const {rows} = await pool.query('SELECT autodoc_id FROM autodoc_categories WHERE autodoc_id IS NOT NULL ORDER BY level, autodoc_id');
  await pool.end();
  
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage();
  
  // intercept image requests
  const imgMap = {};
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('scdn.autodoc.de') && url.includes('.png') && res.status() === 200) {
      const match = url.match(/(\d+)\.png/);
      if (match) imgMap[match[1]] = url;
    }
  });
  
  console.log('Loading autodoc.de/autoteile...');
  await page.goto('https://www.autodoc.de/autoteile', {waitUntil:'networkidle', timeout:60000});
  await page.waitForTimeout(3000);
  
  console.log(`Captured ${Object.keys(imgMap).length} image URLs`);
  console.log('Sample:', Object.entries(imgMap).slice(0,3));
  
  await browser.close();
  
  // ჩამოვტვირთოთ autodoc_id-ებზე match
  let ok=0, fail=0;
  for (const {autodoc_id} of rows) {
    if (imgMap[autodoc_id]) {
      const r = await downloadFile(imgMap[autodoc_id], `${dir}${autodoc_id}.png`);
      if(r) ok++; else fail++;
    }
  }
  console.log(`Downloaded: ${ok}, failed: ${fail}`);
}
main().catch(console.error);
