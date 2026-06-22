
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe(
    "SELECT oem_code FROM vehicle_oem WHERE vehicle_id = $1 AND category = $2 LIMIT 5",
    '8456', '100030'
  );
  console.log('result:', result.length, result.slice(0,3));
  await prisma.$disconnect();
}
main().catch(console.error);
