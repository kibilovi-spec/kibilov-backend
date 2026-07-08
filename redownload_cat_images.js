const https = require('https');
const fs = require('fs');

const API_KEY = '98fcf77b13msh4c667e538cb11e8p15f12djsn70f2d789b288';
const dir = '/var/www/kibilov-frontend/public/images/categories/';

function get(url, isApi=false) {
  return new Promise((resolve) => {
    const opts = isApi ? {
      hostname: 'autodoc-parts-catalog.p.rapidapi.com',
      path: url,
      headers: {'x-rapidapi-key': API_KEY, 'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com'}
    } : new URL(url);
    
    https.get(isApi ? opts : url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        get(res.headers.location).then(resolve);
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', () => resolve(null));
  });
}

async function main() {
  // Autodoc category tree API-დან image URL-ები ვიღოთ
  const data = await get('/api/catalog/category/type-id/1/list-category-tree-structure/lang-id/1', true);
  if (!data) { console.log('API failed'); return; }
  
  const tree = JSON.parse(data.toString());
  const images = [];
  
  function traverse(nodes) {
    for (const n of nodes||[]) {
      if (n.image) images.push({id: n.id, url: n.image});
      traverse(n.children);
    }
  }
  traverse(Array.isArray(tree) ? tree : [tree]);
  
  console.log(`Found ${images.length} images in API`);
  
  let ok=0, fail=0;
  for (const {id, url} of images) {
    const buf = await get(url);
    if (buf && buf.length > 1000) {
      fs.writeFileSync(`${dir}${id}.png`, buf);
      ok++;
    } else fail++;
    if ((ok+fail) % 20 === 0) console.log(`${ok+fail}/${images.length}`);
  }
  console.log(`Done: ${ok} ok, ${fail} failed`);
}
main().catch(console.error);
