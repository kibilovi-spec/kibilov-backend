const { PrismaClient } = require('@prisma/client');
const https = require('https');
const prisma = new PrismaClient();
const KEY = '98fcf77b13msh4c667e538cb11e8p15f12djsn70f2d789b288';
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';

async function main() {
  const p = await prisma.product.findFirst({ where: { sku: 'MF 2520' } });
  const code = (p.oemCodes || []).find(c => !c.includes(':')) || 'SM 119';
  console.log('code:', code);
  const req = https.request({
    method: 'GET', hostname: HOST,
    path: '/api/artlookup/search-articles-by-article-no?langId=4&articleNo=' + encodeURIComponent(code) + '&articleType=OENumber',
    headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST }
  }, res => {
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', async () => {
      const d = JSON.parse(Buffer.concat(chunks).toString());
      const img = (d.articles || []).find(a => a.s3image) && (d.articles || []).find(a => a.s3image).s3image;
      if (img) {
        await prisma.$executeRaw`UPDATE products SET images = ARRAY[${img}::text], image_status = 'REAL' WHERE sku = 'MF 2520'`;
        console.log('updated:', img);
      } else {
        console.log('no image found');
      }
      await prisma.$disconnect();
    });
  });
  req.end();
}
main().catch(console.error);
