const { config } = require('dotenv');
config();
const KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function oemToAftermarket(oemCode) {
  const url = `https://${HOST}/api/articles/search-by-oem-no/${encodeURIComponent(oemCode)}/lang-id/4`;
  const r = await fetch(url, { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST } });
  return r.json();
}

const OEM_CODES = ['2115401717', 'A2115401717', '2205400617'];

(async () => {
  for (const code of OEM_CODES) {
    const d = await oemToAftermarket(code);
    const arts = d?.articles || [];
    console.log(`\nOEM: ${code} → ${arts.length} aftermarket parts`);
    arts.slice(0,5).forEach(a => console.log(`  ${a.supplierName} ${a.articleNo}`));
    await sleep(500);
  }
})().catch(console.error);
