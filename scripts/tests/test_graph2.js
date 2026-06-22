require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  // პირდაპირ DB query
  const rows = await prisma.$queryRaw`
    SELECT oem_code FROM vehicle_part_map 
    WHERE vehicle_id = ${'8800'} LIMIT 5
  `;
  console.log('Golf VI (8800) direct query:', rows.length, 'OEMs');
  console.log('example:', rows.slice(0,3).map(r=>r.oem_code).join(', '));

  // graph engine
  const graph = require('./src/services/graphEngine');
  const oems = await graph.getVehicleOEMs('8800');
  console.log('getVehicleOEMs:', oems.length);

  await prisma.$disconnect();
  process.exit(0);
}
test().catch(console.error);
