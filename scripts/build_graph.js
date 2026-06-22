require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔗 Building OEM Graph from existing data...\n');

  // 1. vehicle_oem → vehicle_part_map
  const vehicleOems = await prisma.$queryRaw`
    SELECT vehicle_id, oem_code FROM vehicle_oem LIMIT 5000
  `;
  console.log(`vehicle_oem records: ${vehicleOems.length}`);

  let vpm = 0;
  for (const row of vehicleOems) {
    try {
      await prisma.$executeRaw`
        INSERT INTO vehicle_part_map (vehicle_id, part_category_id, oem_code)
        VALUES (${row.vehicle_id}, 0, ${row.oem_code})
        ON CONFLICT (vehicle_id, oem_code) DO NOTHING
      `;
      vpm++;
    } catch(e) {}
  }
  console.log(`✅ vehicle_part_map: ${vpm} entries`);

  // 2. products oemCodes → oem_graph + product_oem_link
  const products = await prisma.product.findMany({
    where: { oemCodes: { isEmpty: false } },
    select: { id: true, oemCodes: true, brand: true, nameKa: true }
  });
  console.log(`products with OEM: ${products.length}`);

  let oem_nodes = 0, pol = 0;
  for (const p of products) {
    for (let i = 0; i < p.oemCodes.length; i++) {
      const code = p.oemCodes[i].replace(/[\s\-\.]/g,'').toUpperCase();
      if (!code || code.length < 4) continue;
      try {
        await prisma.$executeRaw`
          INSERT INTO oem_graph (oem_code, brand, category_id)
          VALUES (${code}, ${p.brand||'Generic'}, 0)
          ON CONFLICT (oem_code) DO NOTHING
        `;
        oem_nodes++;
      } catch(e) {}
      try {
        await prisma.$executeRaw`
          INSERT INTO product_oem_link (product_id, oem_code, is_primary)
          VALUES (${p.id}, ${code}, ${i===0})
          ON CONFLICT (product_id, oem_code) DO NOTHING
        `;
        pol++;
      } catch(e) {}
    }
  }
  console.log(`✅ oem_graph nodes: ${oem_nodes}`);
  console.log(`✅ product_oem_link: ${pol} entries`);

  // 3. cross_reference → oem_edges
  const crossRefs = await prisma.$queryRaw`
    SELECT oem_code, article_number, brand FROM cross_reference
  `;
  let edges = 0;
  for (const cr of crossRefs) {
    try {
      await prisma.$executeRaw`
        INSERT INTO oem_edges (oem_from, oem_to, relation, brand_to)
        VALUES (${cr.oem_code}, ${cr.article_number}, 'equivalent', ${cr.brand})
        ON CONFLICT (oem_from, oem_to) DO NOTHING
      `;
      edges++;
    } catch(e) {}
  }
  console.log(`✅ oem_edges: ${edges} edges`);

  // Summary
  const stats = await prisma.$queryRaw`
    SELECT 
      (SELECT COUNT(*) FROM vehicle_part_map) as vpm,
      (SELECT COUNT(*) FROM oem_graph) as oem_nodes,
      (SELECT COUNT(*) FROM oem_edges) as oem_edges,
      (SELECT COUNT(*) FROM product_oem_link) as pol
  `;
  console.log('\n📊 Graph Statistics:');
  console.log(`   vehicle_part_map:  ${stats[0].vpm}`);
  console.log(`   oem_graph nodes:   ${stats[0].oem_nodes}`);
  console.log(`   oem_edges:         ${stats[0].oem_edges}`);
  console.log(`   product_oem_link:  ${stats[0].pol}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
