
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const codes = ['0986461769','0986494387','0986494399','0986494514','0986494518'];
  const products = await prisma.product.findMany({
    where: { alternativeSearchKeys: { hasSome: codes } },
    select: { nameKa: true, sku: true },
    take: 10
  });
  console.log('matched:', products.length);
  products.forEach(p => console.log(' -', p.nameKa.slice(0,60)));
  await prisma.$disconnect();
}
main().catch(console.error);
