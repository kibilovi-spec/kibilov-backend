const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  // Priority: BMW + 3 Series products
  const res = await p.product.findMany({
    where: {
      AND: [
        { alternativeSearchKeys: { hasSome: ['BMW'] } },
        { OR: [
          { nameKa: { contains: 'სამუხრუჭე', mode: 'insensitive' } },
          { alternativeSearchKeys: { hasSome: ['სამუხრუჭე ხუნდი'] } }
        ]}
      ],
      stock: { gt: 0 }
    },
    take: 5,
    select: { nameKa: true, alternativeSearchKeys: true }
  });
  console.log('BMW brake products:', res.length);
  res.forEach(x => console.log(' -', x.nameKa.slice(0,55)));
  await p.$disconnect();
}
main();
