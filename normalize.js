const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizeKey(input) {
  return input.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
}

async function main() {
  const products = await prisma.product.findMany({
    where: { normalizedSku: null },
    select: { id: true, sku: true },
  });
  console.log(`განახლება: ${products.length} პროდუქტი`);
  let updated = 0;
  for (const p of products) {
    await prisma.product.update({
      where: { id: p.id },
      data: { normalizedSku: normalizeKey(p.sku) },
    });
    updated++;
  }
  console.log(`✅ განახლდა: ${updated}`);
  await prisma.$disconnect();
}

main().catch(console.error);
