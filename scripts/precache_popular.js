
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const autodoc = require('../src/services/autodoc');
const prisma = new PrismaClient();
const sleep = ms => new Promise(r => setTimeout(r, ms));

const POPULAR_VEHICLES = [
  // Mercedes-Benz
  { vehicleId: '9433',  name: 'MB SL R129' },
  { vehicleId: '4689',  name: 'MB E W210 220D' },
  { vehicleId: '4691',  name: 'MB E W210 200' },
  { vehicleId: '14814', name: 'MB C W203 180' },
  { vehicleId: '14815', name: 'MB C W203 200K' },
  { vehicleId: '11236', name: 'MB E W211 220CDI' },
  { vehicleId: '8670',  name: 'MB Sprinter 901' },
  { vehicleId: '9037',  name: 'MB ML W163 320' },
  // VW
  { vehicleId: '8456',  name: 'VW Golf IV 1.9TDI' },
  { vehicleId: '8460',  name: 'VW Golf IV 1.6' },
  { vehicleId: '8799',  name: 'VW Golf V 1.6' },
  { vehicleId: '8800',  name: 'VW Golf VI 1.4' },
  { vehicleId: '16819', name: 'VW Touareg 3.2' },
  // BMW
  { vehicleId: '8963',  name: 'BMW 3 E46 318i' },
  { vehicleId: '9045',  name: 'BMW 3 E46 320d' },
  { vehicleId: '16022', name: 'BMW 5 E60 525i' },
  { vehicleId: '12470', name: 'BMW 3 F30 328i' },
  { vehicleId: '13042', name: 'BMW X5 E53 4.4' },
  // Toyota
  { vehicleId: '3547',  name: 'Toyota Camry 2.2' },
  { vehicleId: '49415', name: 'Toyota Prius 1.5' },
  { vehicleId: '3857',  name: 'Toyota RAV4 2.0' },
  { vehicleId: '3635',  name: 'Toyota Corolla 1.3' },
  // Hyundai
  { vehicleId: '15129', name: 'Hyundai Elantra 1.6' },
  { vehicleId: '10967', name: 'Hyundai Elantra 1.8' },
  { vehicleId: '12957', name: 'Hyundai Tucson 2.0' },
  { vehicleId: '4558',  name: 'Hyundai Sonata 2.0' },
  // Kia
  { vehicleId: '4579',  name: 'Kia Sportage 2.0' },
  { vehicleId: '4426',  name: 'Kia Sorento 2.5CRDi' },
  { vehicleId: '17947', name: 'Kia Cerato 1.6' },
  // Opel
  { vehicleId: '8994',  name: 'Opel Astra G 1.6' },
  { vehicleId: '9956',  name: 'Opel Astra H 1.4' },
  { vehicleId: '5111',  name: 'Opel Vectra B 1.6' },
  // Mitsubishi
  { vehicleId: '17284', name: 'Mitsubishi Outlander 2.0' },
  { vehicleId: '3274',  name: 'Mitsubishi Lancer 1.2' },
  // Nissan
  { vehicleId: '11136', name: 'Nissan Qashqai 1.5dCi' },
  { vehicleId: '15571', name: 'Nissan X-Trail 2.5' },
  // Honda
  { vehicleId: '8366',  name: 'Honda CR-V 2.0' },
];

const CATEGORIES = [100030, 100259, 100260, 100121, 100579, 100581, 100197, 100267];

async function cacheByVehicleId(vehicleId, name) {
  let totalOem = 0;
  
  // ჯერ vehicle_cache-ში ჩავწეროთ
  try {
    await prisma.$executeRawUnsafe(
      'INSERT INTO vehicle_cache (vehicle_id, vin, manufacturer, model, year, engine) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (vehicle_id) DO NOTHING',
      String(vehicleId), 'PRECACHE_' + String(vehicleId), name.split(' ')[0], name, '', ''
    );
  } catch(e) {}
  
  for (const catId of CATEGORIES) {
    await sleep(300);
    try {
      const existing = await prisma.$queryRawUnsafe(
        'SELECT COUNT(*) as cnt FROM vehicle_oem WHERE vehicle_id=$1 AND category=$2',
        String(vehicleId), String(catId)
      );
      if (parseInt(existing[0].cnt) > 0) continue;

      const artData = await autodoc.getArticlesByVehicle(vehicleId, catId);
      const articleIds = (artData?.articles||[]).map(a=>a.articleId).slice(0,20);
      if (!articleIds.length) continue;

      await sleep(300);
      const oemData = await autodoc.getOemsByArticleIds(articleIds);
      const oemCodes = (oemData?.articles||[])
        .flatMap(a => a.oemNo?.map(o=>o.oemDisplayNo.replace(/[\s\-.]/g,'').toUpperCase())||[])
        .filter((c,i,arr)=>arr.indexOf(c)===i);

      for (const code of oemCodes) {
        await prisma.$executeRawUnsafe(
          'INSERT INTO vehicle_oem (vehicle_id, oem_code, category) VALUES ($1,$2,$3) ON CONFLICT (vehicle_id, oem_code) DO NOTHING',
          String(vehicleId), code, String(catId)
        );
      }
      totalOem += oemCodes.length;
    } catch(e) {}
  }
  const icon = totalOem > 0 ? '✅' : '⚠️';
  console.log(icon + ' ' + name + ' (id:' + vehicleId + ') — ' + totalOem + ' OEM კოდი');
}

async function main() {
  console.log('precache დაიწყო — ' + POPULAR_VEHICLES.length + ' მანქანა...');
  for (const { vehicleId, name } of POPULAR_VEHICLES) {
    await cacheByVehicleId(vehicleId, name);
    await sleep(200);
  }
  const total = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM vehicle_oem');
  const vins  = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM vehicle_cache');
  console.log('\n✅ vehicle_cache: ' + vins[0].cnt);
  console.log('✅ vehicle_oem:   ' + total[0].cnt);
  await prisma.$disconnect();
}
main().catch(console.error);
