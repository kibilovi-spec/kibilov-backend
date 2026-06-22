const { config } = require('dotenv');
config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const BASE = 'https://' + HOST;
const hdrs = () => ({ 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SKIP = ['MERCEDES','VW','BMW','TOYOTA','BOSCH','HYUNDAI','KIA','BENZ','FORD','OPEL'];

function extractCodes(oemCodes) {
  return oemCodes
    .map(c => c.replace(/[\s\-\.]/g, '').toUpperCase())
    .filter(c => c.length >= 4 && c.length <= 20 && !SKIP.some(s => c.includes(s)));
}

(async () => {
  const products = await prisma.product.findMany({
    where: { oemCodes: { isEmpty: false } },
    select: { nameKa: true, oemCodes: true },
    take: 20
  });

  for (const p of products) {
    const codes = extractCodes(p.oemCodes);
    if (!codes.length) { console.log('SKIP:', p.nameKa.slice(0,40)); continue; }
    const code = codes[0];
    const url = BASE + '/api/artlookup/search-articles-by-article-no?langId=4&articleNo=' + encodeURIComponent(code) + '&articleType=ArticleNumber';
    const r = await fetch(url, { headers: hdrs() });
    const d = await r.json();
    const count = d?.articles?.length || 0;
    const mark = count > 0 ? 'OK' : 'NO';
    console.log(mark + ' ' + code + ' -> ' + count + ' | ' + p.nameKa.slice(0,35));
    await sleep(300);
  }
  await prisma.$disconnect();
})().catch(console.error);
