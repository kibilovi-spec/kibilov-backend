
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function detectSlug(nameKa) {
  const n = (nameKa || '').toLowerCase();
  if (n.includes('გიტარ') || n.includes('კრანშტეინ') || n.includes('ქვედა ბერკეტ')) return 'savali-gitara';
  if (n.includes('პილნიკ') || n.includes('მტვერდამც')) return 'savali-pilnikebi';
  if (n.includes('ყუმბარ')) return 'savali-yumbarebi';
  if (n.includes('შარავო')) return 'savali-sharavoebi';
  if (n.includes('ბაბინ')) return 'eng-anteba';
  if (n.includes('ციმციმ') || n.includes('სანათ') || n.includes('ნომრის') || n.includes('კნოპ') || n.includes('ღილაკ')) return 'elec-other';
  if (n.includes('საყრდენი დისკ') || n.includes('ვიდუშ')) return 'brake-diski';
  if (n.includes('ტროს') && !n.includes('მუხრ')) return 'eng-trosi';
  return null;
}

async function main() {
  const allCats = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catMap = {};
  allCats.forEach(c => catMap[c.slug] = c.id);

  const SLUGS = ['brakes','driveshaft','filters','electrics'];
  for (const fromSlug of SLUGS) {
    const products = await prisma.product.findMany({
      where: { categoryId: catMap[fromSlug] },
      select: { id: true, nameKa: true }
    });
    let moved = 0, stayed = 0;
    for (const p of products) {
      const newSlug = detectSlug(p.nameKa);
      if (newSlug && catMap[newSlug] && newSlug !== fromSlug) {
        await prisma.product.update({ where: { id: p.id }, data: { categoryId: catMap[newSlug] } });
        moved++;
      } else stayed++;
    }
    console.log(fromSlug + ': გადავიდა=' + moved + ' დარჩა=' + stayed);
  }
  await prisma.$disconnect();
}
main().catch(console.error);
