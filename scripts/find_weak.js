
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.product.findMany({
  where: { oemCodes: { isEmpty: false } },
  select: { id: true, nameKa: true, sku: true, oemCodes: true, alternativeSearchKeys: true, price: true, stock: true }
}).then(products => {
  const weak = products.filter(p => {
    const altSet = new Set(p.alternativeSearchKeys.map(k => k.toUpperCase().replace(/[\s\-.]/g,'')));
    const oemSet = new Set(p.oemCodes.map(k => k.toUpperCase().replace(/[\s\-.]/g,'')));
    const diff = [...altSet].filter(k => !oemSet.has(k));
    return diff.length === 0;
  });
  console.log('გაუმდიდრებელი:', weak.length);
  require('fs').writeFileSync('/tmp/weak_products.json', JSON.stringify(weak, null, 2));
  console.log('შენახულია: /tmp/weak_products.json');
}).finally(() => prisma.$disconnect());
