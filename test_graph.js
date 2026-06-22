require('dotenv').config();
const graph = require('./src/services/graphEngine');

async function test() {
  console.log('\n=== GRAPH ENGINE TEST ===\n');

  // OEM Chain
  console.log('1. OEM Chain (2115401717):');
  const chain = await graph.getOEMChain('2115401717');
  console.log(`   chain length: ${chain.length}`);
  console.log(`   codes: ${chain.slice(0,5).join(', ')}`);

  // Vehicle OEMs
  console.log('\n2. Vehicle OEMs (Golf 6):');
  const oems = await graph.getVehicleOEMs('8448');
  console.log(`   OEM count: ${oems.length}`);

  // Products by OEM
  console.log('\n3. Products by OEM:');
  const prods = await graph.getProductsByOEMGraph('2115401717');
  console.log(`   products: ${prods.length}`);
  if (prods[0]) console.log(`   example: ${prods[0].nameKa?.substring(0,40)}`);

  console.log('\n✅ Graph Engine მუშაობს!');
  process.exit(0);
}
test().catch(console.error);

// ხელახლა Golf VI test
async function test2() {
  const graph = require('./src/services/graphEngine');
  const oems = await graph.getVehicleOEMs('8800');
  console.log('\nGolf VI (8800) OEMs:', oems.length);
  if (oems.length > 0) {
    const prods = await graph.getProductsByOEMGraph(oems[0]);
    console.log('Products via graph:', prods.length);
  }
  process.exit(0);
}
test2().catch(console.error);
