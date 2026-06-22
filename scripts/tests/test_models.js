require('dotenv').config();
const autodoc = require('./src/services/autodoc');
async function test() {
  const bmw = (await autodoc.getManufacturersByType(1)).manufacturers.find(m => m.manufacturerName === 'BMW');
  const models = (await autodoc.getModelsByManufacturer(bmw.manufacturerId)).models;
  const s3 = models.filter(m => m.modelName.includes('3 Series') || m.modelName.includes('3-Series'));
  console.log('BMW 3 Series:', s3.slice(0,5).map(m=>m.modelName+'('+m.modelId+')').join(', '));

  const ford = (await autodoc.getManufacturersByType(1)).manufacturers.find(m => m.manufacturerName === 'FORD');
  console.log('FORD id:', ford?.manufacturerId);
  const fmodels = (await autodoc.getModelsByManufacturer(ford.manufacturerId)).models;
  const transit = fmodels.filter(m => m.modelName.toLowerCase().includes('transit'));
  console.log('Transit models:', transit.slice(0,5).map(m=>m.modelName).join(', '));
}
test().catch(console.error);
