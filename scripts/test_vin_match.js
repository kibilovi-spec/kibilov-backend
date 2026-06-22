
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const autodoc = require('../src/services/autodoc');
const prisma = new PrismaClient();
const sleep = ms => new Promise(r => setTimeout(r, ms));

const TEST_VINS = [
  { vin: 'WVWZZZ1JZ3W000001', name: 'VW Golf IV' },
  { vin: 'WVWZZZ1KZ9W000001', name: 'VW Golf VI' },
  { vin: 'WDBFA68F42F202731', name: 'Mercedes SL R129' },
  { vin: 'WBA3A5C50DF000001', name: 'BMW 3 Series' },
  { vin: 'WAUZZZ8K0BA000001', name: 'Audi A4 B8' },
];

async function main() {
  const results = [];

  for (const { vin, name } of TEST_VINS) {
    try {
      const raw = await autodoc.vinCheck(vin);
      const v = raw?.data?.matchingVehicles?.array?.[0];
      if (!v) { results.push({ name, vin, error: 'vehicle not found' }); continue; }

      await sleep(500);
      const artData = await autodoc.getArticlesByVehicle(v.vehicleId, 100030);
      const articleIds = (artData?.articles || []).map(a => a.articleId).slice(0, 20);
      if (!articleIds.length) { results.push({ name, vin, vehicleId: v.vehicleId, error: 'no articles' }); continue; }

      await sleep(500);
      const oemData = await autodoc.getOemsByArticleIds(articleIds);
      const oemCodes = (oemData?.articles || [])
        .flatMap(a => a.oemNo?.map(o => o.oemDisplayNo.replace(/[\s\-.]/g,'').toUpperCase()) || [])
        .filter((c,i,arr) => arr.indexOf(c) === i);

      const matched = await prisma.product.findMany({
        where: { alternativeSearchKeys: { hasSome: oemCodes } },
        select: { id: true, nameKa: true },
        take: 5
      });

      results.push({ name, vin, vehicleId: v.vehicleId, oemCodes: oemCodes.length, matched: matched.length, products: matched.map(p => p.nameKa.slice(0,50)) });
      await sleep(1000);
    } catch(e) {
      results.push({ name, vin, error: e.message });
    }
  }

  require('fs').writeFileSync('/tmp/vin_test.json', JSON.stringify(results, null, 2));
  results.forEach(r => {
    console.log('---');
    console.log(r.name, '|', r.vehicleId || 'N/A');
    console.log('OEM კოდები:', r.oemCodes || 0, '| მოიძებნა:', r.matched || 0);
    (r.products || []).forEach(p => console.log('  -', p));
  });
  await prisma.$disconnect();
}
main().catch(console.error);
