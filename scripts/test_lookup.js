
require('dotenv').config();
const KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const hdrs = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };

async function main() {
  const oem = '1027640';
  const url = 'https://' + HOST + '/api/artlookup/search-articles-by-article-no?langId=4&articleNo=' 
    + encodeURIComponent(oem) + '&articleType=OENumber';
  const r = await fetch(url, { headers: hdrs });
  const d = await r.json();
  console.log('articles:', d?.countArticles);
  (d?.articles || []).slice(0,10).forEach(a => {
    const clean = a.articleNo.replace(/[\s\-.]/g,'').toUpperCase();
    console.log('  raw:', a.articleNo, '| clean:', clean, '|', a.supplierName);
  });
}
main().catch(console.error);
