
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { nameKa: { contains: 'Golf', mode: 'insensitive' } },
    select: { nameKa: true, sku: true, alternativeSearchKeys: true },
    take: 5
  });
  products.forEach(p => {
    console.log(p.nameKa.slice(0,60));
    console.log('keys sample:', p.alternativeSearchKeys.slice(0,5));
    console.log('---');
  });
  await prisma.$disconnect();
}
main().catch(console.error);
