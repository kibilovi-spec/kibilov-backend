require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const KEYWORD_MAP = [
  { triggers: ['სამუხრუჭე ხუნდ', 'brake pad'], categoryId: 100030 },
  { triggers: ['სამუხრუჭე დისკ', 'brake disc', 'brake rotor'], categoryId: 100031 },
  { triggers: ['სამუხრუჭე სითხ', 'brake fluid'], categoryId: 102208 },
  { triggers: ['ზეთის ფილტრ', 'oil filter'], categoryId: 100259 },
  { triggers: ['საწვავის ფილტრ', 'fuel filter'], categoryId: 100261 },
  { triggers: ['ჰაერის ფილტრ', 'air filter'], categoryId: 100260 },
  { triggers: ['სალონის ფილტრ', 'cabin filter'], categoryId: 100263 },
  { triggers: ['ანტიფრიზ', 'antifreeze', 'coolant'], categoryId: 706832 },
  { triggers: ['ძრავის ზეთ', 'engine oil', 'motor oil', '5w', '10w', '0w'], categoryId: 102203 },
  { triggers: ['გადაცემათა', 'gear oil', 'transmission'], categoryId: 100259 },
  { triggers: ['ამორტიზატორ', 'shock absorber'], categoryId: 100121 },
  { triggers: ['სამუხრუჭე კოლოდკ', 'brake shoe'], categoryId: 100032 },
  { triggers: ['სამუხრუჭე ბარაბნ', 'brake drum'], categoryId: 100033 },
  { triggers: ['ხახუნის დისკ', 'clutch disc'], categoryId: 100072 },
  { triggers: ['გაბმულობის კომპლ', 'clutch kit'], categoryId: 100071 },
  { triggers: ['სათბობ', 'fuel pump'], categoryId: 100248 },
  { triggers: ['წყლის ტუმბ', 'water pump'], categoryId: 100079 },
  { triggers: ['გენერატორ', 'alternator'], categoryId: 100359 },
  { triggers: ['სტარტერ', 'starter'], categoryId: 100358 },
];

(async () => {
  const products = await prisma.product.findMany({
    where: { isActive: true, autodocCategoryId: null },
    select: { id: true, sku: true, nameKa: true }
  });

  console.log(`კატეგორიის გარეშე: ${products.length}`);
  let matched = 0, skipped = 0;

  for (const p of products) {
    const nameLower = (p.nameKa || '').toLowerCase();
    let found = null;
    for (const g of KEYWORD_MAP) {
      if (g.triggers.some(t => nameLower.includes(t.toLowerCase()))) {
        found = g.categoryId;
        break;
      }
    }
    if (found) {
      await prisma.product.update({
        where: { id: p.id },
        data: { autodocCategoryId: found }
      });
      matched++;
      if (matched % 50 === 0) console.log(`განახლდა: ${matched}`);
    } else {
      skipped++;
    }
  }

  console.log(`\nდასრულდა: ${matched} კატეგორია მიენიჭა | ${skipped} გამოტოვდა`);
  await prisma.$disconnect();
})();
