
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function detectSlug(nameKa) {
  const n = (nameKa || '').toLowerCase();
  if (n.includes('ამორტიზატ') || n.includes('სტოიკ') || n.includes('პადვესნო') || n.includes('ვიაბრაზნ')) return 'amortizacia';
  if (n.includes('ფერადო') || n.includes('ნაკლატკ')) return 'clutch-plita';
  if (n.includes('სამუხ') && n.includes('სითხ') || n.includes('brake fluid') || n.includes('hydrolube')) return 'oil-brake';
  if (n.includes('მუხრ') && n.includes('ავზ')) return 'brake-cilindri';
  if (n.includes('უდარნ') || n.includes('სტერჟინ') || n.includes('სტეჟინ') || n.includes('ბალკ') && n.includes('ტულკ') || n.includes('შტანგ') && n.includes('ტულკ') || n.includes('რაზვალ') && n.includes('ტულკ')) return 'savali-sukho';
  if (n.includes('ხიდის ტულკ') || n.includes('კრონშტეინ')) return 'savali-sukho';
  if (n.includes('სარქვლ') && n.includes('ჩობალ') || n.includes('სალნიკ')) return 'savali-salnikebi';
  if (n.includes('სტუპიც') && n.includes('საკისარ') || n.includes('პოლუოსის') && n.includes('საკისარ')) return 'savali-stupicebi';
  if (n.includes('ცეპლენ') || n.includes('ტრეშოტკ')) return 'eng-cepi';
  if (n.includes('სამუხ') && n.includes('ფირფიტ')) return 'brake-pads-rear';
  if (n.includes('ნაკანეჩნ') || n.includes('ხუნდ') || n.includes('კალოტკ')) return 'brake-pads-front';
  if (n.includes('ატf') || n.includes('steering oil') || n.includes('gear oil') || n.includes('ტრანსმ') && n.includes('ზეთ') || n.includes('კბილან') && n.includes('ზეთ')) return 'oil-trans';
  if (n.includes('საბურავ') && n.includes('ფერ') || n.includes('საწმენდ') && n.includes('დისკ')) return 'oils-fluids';
  if (n.includes('ჭრიჭინ')) return 'savali-pilnikebi';
  if (n.includes('საჰაერო') || n.includes('air')) return 'filt-haeri';
  if (n.includes('გადაცემ') && n.includes('ფილტ')) return 'filt-kolofi';
  if (n.includes('პედლ') && n.includes('ლაგუშკ') || n.includes('პედლ') && n.includes('ბუდ')) return 'brake-cilindri';
  if (n.includes('შუქ') && n.includes('რელ') || n.includes('ზაჟიგ') || n.includes('კონტაქტ')) return 'elec-other';
  if (n.includes('სტოპ') && n.includes('პლატ')) return 'elec-nathura';
  if (n.includes('უკან სვლ') && n.includes('დაჩიკ')) return 'eng-sensor';
  if (n.includes('მუხრ') && n.includes('დამჭ')) return 'brake-suporti';
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
