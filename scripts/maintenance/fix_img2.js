const https = require('https');
const KEY = '98fcf77b13msh4c667e538cb11e8p15f12djsn70f2d789b288';
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';

const codes = ['0451103252', 'SM119', 'SM 119', 'W92032'];
let found = false;

async function tryCode(code, type) {
  return new Promise(resolve => {
    const req = https.request({
      method: 'GET', hostname: HOST,
      path: '/api/artlookup/search-articles-by-article-no?langId=4&articleNo=' + encodeURIComponent(code) + '&articleType=' + type,
      headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const d = JSON.parse(Buffer.concat(chunks).toString());
        const img = (d.articles||[]).find(a => a.s3image);
        if (img) console.log('FOUND:', code, type, img.s3image);
        else console.log('NOT FOUND:', code, type);
        resolve(img ? img.s3image : null);
      });
    });
    req.end();
  });
}

async function main() {
  for (const code of codes) {
    for (const type of ['ArticleNumber', 'OENumber', 'IAMNumber']) {
      const img = await tryCode(code, type);
      if (img) { found = true; break; }
      await new Promise(r => setTimeout(r, 300));
    }
    if (found) break;
  }
}
main();
