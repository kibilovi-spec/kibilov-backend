require('dotenv').config();
const autodoc = require('./src/services/autodoc');
async function test() {
  const makes = (await autodoc.getManufacturersByType(1)).manufacturers;
  
  // BMW exact
  const bmw = makes.find(m => m.manufacturerName === 'BMW');
  console.log('BMW exact:', bmw?.manufacturerName, bmw?.manufacturerId);
  
  const bmwModels = (await autodoc.getModelsByManufacturer(16)).models;
  // "3" ან "3 Series" alias
  const alias = '3';
  const mod = bmwModels.find(m => m.modelName.startsWith(alias + ' ') || m.modelName === alias);
  console.log('BMW 3 mod:', mod?.modelName, mod?.modelId);
  
  // VW Golf 6
  const vw = makes.find(m => m.manufacturerName === 'VW');
  const vwModels = (await autodoc.getModelsByManufacturer(121)).models;
  const golf6 = vwModels.find(m => m.modelName.includes('GOLF VI'));
  console.log('Golf 6:', golf6?.modelName, golf6?.modelId);
}
test().catch(console.error);
