const http = require('http');
function get(path) {
  return new Promise((resolve) => {
    const r = http.request({hostname:'localhost',port:3002,path,method:'GET'}, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>resolve({status:res.statusCode,len:d.length}));
    });
    r.on('error',e=>resolve({status:0}));
    r.end();
  });
}

// პირველ რიგში category slug ვნახოთ DB-დან
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const cat = await p.category.findFirst({ select: { slug: true, nameKa: true } });
  const prod = await p.product.findFirst({ select: { id: true } });
  await p.$disconnect();

  const pages = [
    [`/categories/${cat?.slug || 'samuxruve'}`, `Category (${cat?.nameKa || 'test'})`],
    [`/brands/toyota`, 'Brand Toyota'],
    [`/brands/bmw`, 'Brand BMW'],
    [`/products/${prod?.id || '1'}`, 'Product Detail'],
  ];

  console.log('\n=== Dynamic Routes ===\n');
  for (const [path, name] of pages) {
    const r = await get(path);
    const ok = r.status === 200;
    console.log(`${ok?'✅':'❌'} ${name.padEnd(25)} [${r.status}] ${path}`);
    await new Promise(res=>setTimeout(res,100));
  }
}
main();
