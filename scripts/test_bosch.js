
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const testCodes = ['0986461769', '0 986 461 769', 'GDB1807', 'GDB 1807'];
  const products = await prisma.product.findMany({
    where: { alternativeSearchKeys: { hasSome: testCodes } },
    select: { nameKa: true, sku: true },
    take: 5
  });
  console.log('matched:', products.length);
  products.forEach(p => console.log(' -', p.nameKa.slice(0,60)));
  await prisma.$disconnect();
}
main().catch(console.error);
