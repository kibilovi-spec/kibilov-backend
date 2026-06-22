
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { oemCodes: { isEmpty: false } },
    select: { id: true, nameKa: true, sku: true, oemCodes: true, alternativeSearchKeys: true }
  });

  const noMatch = products.filter(p => {
    const altSet = new Set(p.alternativeSearchKeys.map(k => k.toUpperCase().replace(/[\s\-.]/g,'')));
    const oemSet = new Set(p.oemCodes.map(k => k.toUpperCase().replace(/[\s\-.]/g,'')));
    const diff = [...altSet].filter(k => !oemSet.has(k));
    return diff.length === 0;
  });

  console.log('წასაშლელი:', noMatch.length);
  const ids = noMatch.map(p => p.id);
  
  const deleted = await prisma.product.deleteMany({
    where: { id: { in: ids } }
  });
  console.log('წაიშალა:', deleted.count);
  await prisma.$disconnect();
}
main().catch(console.error);
