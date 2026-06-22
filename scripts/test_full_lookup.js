
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const hdrs = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };

async function main() {
  const url = 'https://' + HOST + '/api/artlookup/search-articles-by-article-no?langId=4&articleNo=1027640&articleType=OENumber';
  const r = await fetch(url, { headers: hdrs });
  const d = await r.json();
  
  const codes = (d?.articles || []).map(a => a.articleNo.replace(/[\s\-.]/g,'').toUpperCase());
  console.log('Autodoc codes:', codes.length, codes.slice(0,5));

  const products = await prisma.product.findMany({
    where: { alternativeSearchKeys: { hasSome: codes } },
    select: { nameKa: true },
    take: 10
  });
  console.log('DB matched:', products.length);
  products.forEach(p => console.log(' -', p.nameKa.slice(0,55)));

  await prisma.$disconnect();
}
main().catch(console.error);
