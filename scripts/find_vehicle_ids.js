
require('dotenv').config();
const autodoc = require('../src/services/autodoc');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MODELS = [
  // MB manufacturerId=74
  { manuId: 74,  name: 'MB E W210',    search: 'E-CLASS (W210)' },
  { manuId: 74,  name: 'MB C W203',    search: 'C-CLASS (W203)' },
  { manuId: 74,  name: 'MB E W211',    search: 'E-CLASS (W211)' },
  { manuId: 74,  name: 'MB Sprinter',  search: 'SPRINTER' },
  { manuId: 74,  name: 'MB ML W163',   search: 'M-CLASS (W163)' },
  // BMW manufacturerId=16
  { manuId: 16,  name: 'BMW 3 E46',    search: '3 (E46)' },
  { manuId: 16,  name: 'BMW 5 E60',    search: '5 (E60)' },
  { manuId: 16,  name: 'BMW 3 F30',    search: '3 (F30)' },
  { manuId: 16,  name: 'BMW X5 E53',   search: 'X5 (E53)' },
  // VW manufacturerId=121
  { manuId: 121, name: 'VW Passat B5', search: 'PASSAT (3B3)' },
  { manuId: 121, name: 'VW Passat B6', search: 'PASSAT (3C2)' },
  { manuId: 121, name: 'VW Touareg',   search: 'TOUAREG (7LA' },
];

async function main() {
  const results = {};
  for (const { manuId, name, search } of MODELS) {
    await sleep(500);
    try {
      const d = await autodoc.getModelsByManufacturer(manuId);
      const model = d.models?.find(m => m.modelName.includes(search));
      if (!model) { console.log('❌', name, '— model not found'); continue; }
      
      await sleep(400);
      const v = await autodoc.getVehicleListByModel(model.modelId);
      const vehicles = v.modelTypes?.slice(0,3) || [];
      vehicles.forEach(veh => {
        console.log('✅', name, '| modelId:', model.modelId, '| vehicleId:', veh.vehicleId, '|', veh.typeEngineName);
      });
    } catch(e) {
      console.log('❌', name, '—', e.message);
    }
  }
}
main().catch(console.error);
