require('dotenv').config();
const autodoc = require('./src/services/autodoc');
async function test() {
  const bmw = (await autodoc.getManufacturersByType(1)).manufacturers.find(m => m.manufacturerName === 'BMW');
  const models = (await autodoc.getModelsByManufacturer(bmw.manufacturerId)).models;
  // 2005 წლის BMW მოდელები
  const y2005 = models.filter(m => {
    const from = m.modelYearFrom ? new Date(m.modelYearFrom).getFullYear() : 0;
    const to = m.modelYearTo ? new Date(m.modelYearTo).getFullYear() : 9999;
    return from <= 2005 && to >= 2005;
  });
  console.log('BMW 2005 models:', y2005.map(m=>m.modelName).join(', '));
}
test().catch(console.error);
