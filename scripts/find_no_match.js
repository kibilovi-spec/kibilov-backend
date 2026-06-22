
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const BASE = 'https://' + HOST;
const hdrs = () => ({ 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST });
const sleep = ms => new Promise(r => setTimeout(r, ms));

require('dotenv').config();

async function checkProduct(p) {
  const codes = p.alternativeSearchKeys.slice(0, 5);
  if (!codes.length) return false;
  for (const code of codes) {
    const url = BASE + '/api/artlookup/search-for-cross-references-through-oem-numbers/article-no/' 
      + encodeURIComponent(code) + '/supplierId/0';
    try {
      const r = await fetch(url, { headers: hdrs() });
      const d = await r.json();
      if (d?.countArticles > 0) return true;
    } catch(e) {}
    await sleep(200);
  }
  return false;
}

async function main() {
  const products = await prisma.product.findMany({
    where: { oemCodes: { isEmpty: false } },
    select: { id: true, nameKa: true, sku: true, oemCodes: true, alternativeSearchKeys: true, price: true, stock: true, categoryId: true }
  });

  console.log('სულ:', products.length);
  const noMatch = [];
  let checked = 0;

  for (const p of products) {
    const altKeys = new Set(p.alternativeSearchKeys.map(k => k.toUpperCase().replace(/[\s\-.]/g,'')));
    const oemKeys = new Set(p.oemCodes.map(k => k.toUpperCase().replace(/[\s\-.]/g,'')));
    const diff = [...altKeys].filter(k => !oemKeys.has(k));
    
    if (diff.length === 0) {
      noMatch.push(p);
    }
    checked++;
    if (checked % 500 === 0) console.log('checked:', checked);
  }

  require('fs').writeFileSync('/tmp/no_match.json', JSON.stringify(noMatch, null, 2));
  console.log('არ იკვეთება:', noMatch.length);
  console.log('შენახულია: /tmp/no_match.json');
  await prisma.$disconnect();
}

main().catch(console.error);
