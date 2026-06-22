
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // კატეგორიების ID-ები
  const cats = await prisma.category.findMany({
    where: { slug: { in: ['filt-zetis','filt-haeri','filt-saloni','filt-sawvavi','filters'] } },
    select: { id: true, slug: true, nameKa: true }
  });
  
  const catMap = {};
  cats.forEach(c => catMap[c.slug] = c.id);
  console.log('კატეგორიები:', Object.keys(catMap));

  // filters კატეგორიიდან ყველა პროდუქტი
  const products = await prisma.product.findMany({
    where: { categoryId: catMap['filters'] },
    select: { id: true, nameKa: true }
  });
  console.log('filters-ში პროდუქტი:', products.length);

  let oil=0, air=0, cabin=0, fuel=0, other=0;
  
  for (const p of products) {
    const name = (p.nameKa || '').toLowerCase();
    let newCatId = null;
    
    if (name.includes('ზეთის') || name.includes('oil filter') || name.includes('ზეთფ')) {
      newCatId = catMap['filt-zetis']; oil++;
    } else if (name.includes('ჰაერის') || name.includes('air filter') || name.includes('ჰაერფ')) {
      newCatId = catMap['filt-haeri']; air++;
    } else if (name.includes('სალონის') || name.includes('cabin filter')) {
      newCatId = catMap['filt-saloni']; cabin++;
    } else if (name.includes('საწვავის') || name.includes('fuel filter')) {
      newCatId = catMap['filt-sawvavi']; fuel++;
    } else {
      other++;
    }
    
    if (newCatId) {
      await prisma.product.update({ where: { id: p.id }, data: { categoryId: newCatId } });
    }
  }
  
  console.log('ზეთის ფილტრი:', oil);
  console.log('ჰაერის ფილტრი:', air);
  console.log('სალონის ფილტრი:', cabin);
  console.log('საწვავის ფილტრი:', fuel);
  console.log('სხვა:', other);
  
  await prisma.$disconnect();
}
main().catch(console.error);
