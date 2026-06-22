
require('dotenv').config();
const autodoc = require('../src/services/autodoc');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MODELS = [
  // Toyota manufacturerId=?
  { manuName: 'TOYOTA', name: 'Toyota Camry', search: 'CAMRY' },
  { manuName: 'TOYOTA', name: 'Toyota Prius', search: 'PRIUS' },
  { manuName: 'TOYOTA', name: 'Toyota RAV4',  search: 'RAV 4' },
  { manuName: 'TOYOTA', name: 'Toyota Corolla', search: 'COROLLA' },
  // Hyundai
  { manuName: 'HYUNDAI', name: 'Hyundai Elantra', search: 'ELANTRA' },
  { manuName: 'HYUNDAI', name: 'Hyundai Tucson',  search: 'TUCSON' },
  { manuName: 'HYUNDAI', name: 'Hyundai Sonata',  search: 'SONATA' },
  { manuName: 'HYUNDAI', name: 'Hyundai Santa Fe',search: 'SANTA FE' },
  // Kia
  { manuName: 'KIA', name: 'Kia Sportage', search: 'SPORTAGE' },
  { manuName: 'KIA', name: 'Kia Sorento',  search: 'SORENTO' },
  { manuName: 'KIA', name: 'Kia Cerato',   search: 'CERATO' },
  // Opel
  { manuName: 'OPEL', name: 'Opel Astra G', search: 'ASTRA G' },
  { manuName: 'OPEL', name: 'Opel Astra H', search: 'ASTRA H' },
  { manuName: 'OPEL', name: 'Opel Vectra B',search: 'VECTRA B' },
  // Mitsubishi
  { manuName: 'MITSUBISHI', name: 'Mitsubishi Outlander', search: 'OUTLANDER' },
  { manuName: 'MITSUBISHI', name: 'Mitsubishi Lancer',    search: 'LANCER' },
  // Nissan
  { manuName: 'NISSAN', name: 'Nissan Qashqai', search: 'QASHQAI' },
  { manuName: 'NISSAN', name: 'Nissan X-Trail', search: 'X-TRAIL' },
  // Honda
  { manuName: 'HONDA', name: 'Honda CR-V', search: 'CR-V' },
  // VW Passat
  { manuName: 'VW', name: 'VW Passat B5', search: 'PASSAT (3B' },
  { manuName: 'VW', name: 'VW Passat B6', search: 'PASSAT (3C' },
  // BMW F30
  { manuName: 'BMW', name: 'BMW 3 F30', search: '3 (F3' },
];

async function main() {
  // ჯერ manufacturer IDs
  const manuData = await autodoc.getManufacturersByType(1);
  const manuMap = {};
  manuData.manufacturers?.forEach(m => {
    manuMap[m.manufacturerName] = m.manufacturerId;
  });

  for (const { manuName, name, search } of MODELS) {
    const manuId = manuMap[manuName];
    if (!manuId) { console.log('❌', name, '— manu not found:', manuName); continue; }
    await sleep(400);
    try {
      const d = await autodoc.getModelsByManufacturer(manuId);
      const model = d.models?.find(m => m.modelName.includes(search));
      if (!model) { console.log('❌', name, '— model not found, search:', search); continue; }
      
      await sleep(300);
      const v = await autodoc.getVehicleListByModel(model.modelId);
      const vehicles = v.modelTypes?.slice(0,2) || [];
      vehicles.forEach(veh => {
        console.log('✅', name, '| vehicleId:', veh.vehicleId, '|', veh.typeEngineName);
      });
    } catch(e) {
      console.log('❌', name, '—', e.message);
    }
  }
}
main().catch(console.error);
