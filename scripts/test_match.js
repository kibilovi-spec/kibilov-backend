
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT oem_code FROM vehicle_oem WHERE vehicle_id = $1 AND category = $2",
    '8456', '100030'
  );
  const oemCodes = rows.map(r => r.oem_code);
  console.log('OEM codes count:', oemCodes.length);
  console.log('sample:', oemCodes.slice(0,5));

  const products = await prisma.product.findMany({
    where: { alternativeSearchKeys: { hasSome: oemCodes } },
    select: { nameKa: true, sku: true },
    take: 10
  });
  console.log('matched products:', products.length);
  products.forEach(p => console.log(' -', p.nameKa.slice(0,60)));
  await prisma.$disconnect();
}
main().catch(console.error);
