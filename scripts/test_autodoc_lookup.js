const { config } = require('dotenv');
config();
const KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function searchByNo(articleNo) {
  const url = `https://${HOST}/api/articles/search-by-article-no/${encodeURIComponent(articleNo)}/lang-id/4`;
  const r = await fetch(url, { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST } });
  return r.json();
}

const CODES = ['SP389', 'GDB1455', '0986424830', 'SP244', 'GDB1378'];

(async () => {
  for (const code of CODES) {
    const d = await searchByNo(code);
    const arts = d?.articles || [];
    console.log(`${code} → ${arts.length} | ${arts[0] ? arts[0].supplierName + ' ' + arts[0].articleNo : 'not found'}`);
    await sleep(400);
  }
})().catch(console.error);
