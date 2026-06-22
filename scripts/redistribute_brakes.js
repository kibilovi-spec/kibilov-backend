
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cats = await prisma.category.findMany({
    where: { slug: { in: ['brakes','brake-pads-front','brake-pads-rear','brake-diski','brake-suporti','brake-sensori','brake-cilindri','brake-torsi','brake-vakuum'] } },
    select: { id: true, slug: true }
  });
  const catMap = {};
  cats.forEach(c => catMap[c.slug] = c.id);

  const products = await prisma.product.findMany({
    where: { categoryId: catMap['brakes'] },
    select: { id: true, nameKa: true }
  });
  console.log('brakes-ში:', products.length);

  const counts = {};
  for (const p of products) {
    const name = (p.nameKa || '').toLowerCase();
    let slug = null;

    if (name.includes('წინა სამუხ') || name.includes('წინა  სამუხ') || (name.includes('წინა') && name.includes('ხუნდ'))) {
      slug = 'brake-pads-front';
    } else if (name.includes('უკანა სამუხ') || name.includes('უკანა  სამუხ') || (name.includes('უკანა') && name.includes('ხუნდ'))) {
      slug = 'brake-pads-rear';
    } else if (name.includes('ნაკანეჩნ') || name.includes('კალოტკ') || name.includes('კალოდ') || name.includes('ხუნდ')) {
      slug = 'brake-pads-front';
    } else if (name.includes('სამუხრუჭე დისკ') || name.includes('ტორმუზის დისკ')) {
      slug = 'brake-diski';
    } else if (name.includes('სუპორტ') || name.includes('სტრემიანკ')) {
      slug = 'brake-suporti';
    } else if (name.includes('ცილინდრ')) {
      slug = 'brake-cilindri';
    } else if (name.includes('სენსორ') || name.includes('სადენი') && name.includes('მუხრ')) {
      slug = 'brake-sensori';
    } else if (name.includes('ტროს')) {
      slug = 'brake-torsi';
    } else if (name.includes('ვაკუუმ') || name.includes('ვაკუმ')) {
      slug = 'brake-vakuum';
    }

    if (slug && catMap[slug]) {
      await prisma.product.update({ where: { id: p.id }, data: { categoryId: catMap[slug] } });
      counts[slug] = (counts[slug] || 0) + 1;
    } else {
      counts['სხვა'] = (counts['სხვა'] || 0) + 1;
    }
  }

  console.log('შედეგი:');
  Object.entries(counts).forEach(([k,v]) => console.log(' ', k, v));
  await prisma.$disconnect();
}
main().catch(console.error);
