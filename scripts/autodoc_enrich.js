const { config } = require('dotenv');
config();
const { PrismaClient } = require('@prisma/client');
const autodoc = require('../src/services/autodoc');
const prisma = new PrismaClient();

async function enrichByVin(vin, categoryId) {
  console.log(`\n🔍 VIN: ${vin}, Category: ${categoryId}`);

  // 1. Vehicle
  const raw = await autodoc.vinCheck(vin);
  const v = raw?.data?.matchingVehicles?.array?.[0];
  if (!v) return console.log('❌ Vehicle not found');
  const vehicle = { vehicleId: v.vehicleId, carName: v.carName, vehicleTypeDescription: v.vehicleTypeDescription };

  // 2. Cache
  await prisma.$executeRaw`
    INSERT INTO vehicle_cache (vehicle_id, vin, manufacturer, model, year, engine)
    VALUES (${String(vehicle.vehicleId)}, ${vin.toUpperCase()}, ${vehicle.carName?.split(' ')[0] || ''}, ${vehicle.vehicleTypeDescription || ''}, '', '')
    ON CONFLICT (vehicle_id) DO UPDATE SET vin = EXCLUDED.vin
  `;
  console.log(`✅ Vehicle cached: ${vehicle.carName}`);

  // 3. Articles
  const artData = await autodoc.getArticlesByVehicle(vehicle.vehicleId, categoryId);
  const articles = artData?.articles || [];
  const articleIds = articles.map(a => a.articleId);
  console.log(`✅ Articles: ${articleIds.length}`);
  if (!articleIds.length) return;

  // 4. OEM კოდები
  const oems = await autodoc.getOemsByArticleIds(articleIds.slice(0, 20));
  const allOemCodes = (oems?.articles || [])
    .flatMap(a => a.oemNo?.map(o => o.oemDisplayNo.replace(/[\s\-\.]/g, '').toUpperCase()) || [])
    .filter((v, i, arr) => arr.indexOf(v) === i);
  console.log(`✅ OEM codes: ${allOemCodes.length} — ${allOemCodes.slice(0,5).join(', ')}`);

  // 5. vehicle_oem
  for (const code of allOemCodes) {
    await prisma.$executeRaw`
      INSERT INTO vehicle_oem (vehicle_id, oem_code, category)
      VALUES (${String(vehicle.vehicleId)}, ${code}, ${String(categoryId)})
      ON CONFLICT (vehicle_id, oem_code) DO NOTHING
    `;
  }

  // 6. Cross References
  const cross = await autodoc.getCrossRefs(articleIds[0]);
  const crossArr = Array.isArray(cross) ? cross : (cross?.articles || []);
  for (const c of crossArr) {
    if (!c.articleNo || !c.supplierName) continue;
    const oem = allOemCodes[0] || '';
    await prisma.$executeRaw`
      INSERT INTO cross_reference (oem_code, article_number, brand)
      VALUES (${oem}, ${c.articleNo}, ${c.supplierName})
      ON CONFLICT (oem_code, article_number, brand) DO NOTHING
    `;
  }
  console.log(`✅ Cross refs: ${crossArr.length}`);

  // 7. Matched products
  const products = await prisma.product.findMany({
    where: { alternativeSearchKeys: { hasSome: allOemCodes } },
    select: { id: true, nameKa: true, sku: true }
  });
  console.log(`✅ Matched products: ${products.length}`);
  products.forEach(p => console.log(`   - ${p.nameKa} (${p.sku})`));
  return { vehicle, oemCodes: allOemCodes, products };
}

// პოპულარული მანქანები Georgia-ში
const VINS = [
  { vin: 'WDBFA68F42F202731', cat: 100030 }, // Mercedes SL — ხუნდი
  { vin: 'WVWZZZ1JZXW000001', cat: 100030 }, // VW Golf — ხუნდი
  { vin: 'WVWZZZ1JZXW000001', cat: 100259 }, // VW Golf — ზეთის ფილტრი
];

(async () => {
  for (const { vin, cat } of VINS) {
    await enrichByVin(vin, cat);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n✅ All done');
})()
.catch(console.error)
.finally(() => prisma.$disconnect());
