const { config } = require('dotenv');
config();
const autodoc = require('./src/services/autodoc');

async function test() {
  console.log('=== 1. VIN → Vehicle ===');
  const vehicle = await autodoc.getVehicleByVin('WDBFA68F42F202731');
  console.log(vehicle.carName, '| vehicleId:', vehicle.vehicleId);

  console.log('\n=== 2. Vehicle → Articles (Brake Pad) ===');
  const articles = await autodoc.getArticlesByVehicle(vehicle.vehicleId, 100030);
  console.log('Articles:', articles.length, '| first 3:', articles.slice(0,3));

  console.log('\n=== 3. Articles → OEM Codes ===');
  const oems = await autodoc.getOemByArticleIds(articles.slice(0,3));
  const codes = oems.flatMap(a => a.oemNo?.map(o => o.oemDisplayNo) || []);
  console.log('OEM codes:', codes.slice(0,8));

  console.log('\n=== 4. Cross References ===');
  const cross = await autodoc.getCrossReferences(articles[0]);
  console.log('Cross refs:', cross.slice(0,3).map(c => `${c.supplierName} ${c.articleNo}`));

  console.log('\n=== 5. Media ===');
  const media = await autodoc.getArticleMedia(articles[0]);
  console.log('Images:', media.slice(0,2));
}

test().catch(console.error);
