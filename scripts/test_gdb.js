
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.findFirst({
    where: { nameKa: { contains: 'GDB 1807' } },
    select: { nameKa: true, sku: true, oemCodes: true, alternativeSearchKeys: true }
  });
  if (p) {
    console.log('nameKa:', p.nameKa.slice(0,60));
    console.log('oemCodes:', p.oemCodes);
    console.log('altKeys (all):', p.alternativeSearchKeys);
  }
  await prisma.$disconnect();
}
main().catch(console.error);
