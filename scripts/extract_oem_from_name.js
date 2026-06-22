// nameKa-დან OEM კოდების extraction და oemCodes/alternativeSearchKeys-ში შენახვა
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function extractCodes(nameKa) {
  if (!nameKa) return [];
  // | გამყოფი ნიშნის შემდეგ მოდის კოდები
  const pipeIdx = nameKa.indexOf('|');
  if (pipeIdx === -1) return [];
  const codesStr = nameKa.slice(pipeIdx + 1);
  // მძიმით გამყოფი კოდები
  const codes = codesStr.split(',')
    .map(c => c.replace(/[\|\[\]]/g, '').trim())
    .filter(c => c.length >= 3 && c.length <= 30)
    .filter(c => /[A-Z0-9]/i.test(c));
  return [...new Set(codes)];
}

(async () => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, nameKa: true }
  });

  console.log(`სულ პროდუქტი: ${products.length}`);
  let updated = 0, skipped = 0;

  for (const p of products) {
    const codes = extractCodes(p.nameKa);
    if (codes.length === 0) { skipped++; continue; }

    // SKU-ც დავამატოთ პირველ კოდად
    const allCodes = [...new Set([p.sku, ...codes])].filter(Boolean);

    await prisma.product.update({
      where: { id: p.id },
      data: {
        oemCodes: allCodes,
        alternativeSearchKeys: allCodes,
      }
    });
    updated++;
    if (updated % 100 === 0) console.log(`განახლდა: ${updated}`);
  }

  console.log(`\nდასრულდა: ${updated} განახლდა | ${skipped} გამოტოვდა`);
  await prisma.$disconnect();
})();
