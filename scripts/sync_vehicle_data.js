'use strict';
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const https = require('https');

const API_KEY = '98fcf77b13msh4c667e538cb11e8p15f12djsn70f2d789b288';
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const DELAY = 350;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'GET', hostname: HOST, path,
      headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': HOST }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const makes = await prisma.$queryRaw`
    SELECT id, name, autodoc_id FROM vehicle_makes 
    WHERE autodoc_id IS NOT NULL ORDER BY name
  `;
  console.log(`Makes to sync: ${makes.length}`);

  let totalModels = 0, totalEngines = 0;

  for (const make of makes) {
    try {
      const data = await apiGet(`/api/models/list/type-id/1/manufacturer-id/${make.autodoc_id}/lang-id/4/country-filter-id/63`);
      const models = data.models || [];
      if (!models.length) { await sleep(DELAY); continue; }

      console.log(`${make.name}: ${models.length} models`);

      for (const m of models) {
        const modelId = String(m.modelId || m.id);
        const modelName = m.modelName || m.name;
        if (!modelId || !modelName) continue;

        const imageUrl = `https://fsn1.your-objectstorage.com/tecdoc2025/models/${modelId}.jpg`;

        await prisma.$executeRaw`
          INSERT INTO vehicle_models (id, "makeId", name, autodoc_model_id, image_url)
          VALUES (${modelId}, ${make.id}, ${modelName}, ${parseInt(modelId)}, ${imageUrl})
          ON CONFLICT (id) DO UPDATE SET 
            name = EXCLUDED.name,
            image_url = EXCLUDED.image_url
        `;
        totalModels++;

        await sleep(DELAY);

        try {
          const engData = await apiGet(`/api/types/type-id/1/list-vehicles-types/${modelId}/lang-id/4/country-filter-id/63`);
          const types = engData.modelTypes || [];
          if (!types.length) continue;

          const years = types.map(t => t.constructionIntervalStart).filter(Boolean).map(t => parseInt(t.substring(0,4)));
          const yearEnds = types.map(t => t.constructionIntervalEnd).filter(Boolean).map(t => parseInt(t.substring(0,4)));
          const yearFrom = years.length ? Math.min(...years) : null;
          const yearTo = yearEnds.length ? Math.max(...yearEnds) : null;

          if (yearFrom) {
            await prisma.$executeRaw`
              UPDATE vehicle_models SET "yearFrom"=${yearFrom}, "yearTo"=${yearTo} WHERE id=${modelId}
            `;
          }

          for (const t of types) {
            if (!t.vehicleId) continue;
            const yf = t.constructionIntervalStart ? parseInt(t.constructionIntervalStart.substring(0,4)) : null;
            const yt = t.constructionIntervalEnd ? parseInt(t.constructionIntervalEnd.substring(0,4)) : null;
            await prisma.$executeRaw`
              INSERT INTO vehicle_engines (vehicle_id, model_id, make, model_name, engine_name, year_from, year_to, fuel_type, power_kw, capacity)
              VALUES (${t.vehicleId}, ${modelId}, ${make.name}, ${modelName}, ${t.typeEngineName||null}, ${yf}, ${yt}, ${t.fuelType||null}, ${t.powerKw?parseFloat(t.powerKw):null}, ${t.capacityLt?String(t.capacityLt):null})
              ON CONFLICT (vehicle_id) DO UPDATE SET 
                engine_name=EXCLUDED.engine_name,
                year_from=EXCLUDED.year_from,
                year_to=EXCLUDED.year_to,
                fuel_type=EXCLUDED.fuel_type,
                power_kw=EXCLUDED.power_kw,
                capacity=EXCLUDED.capacity
            `;
            totalEngines++;
          }
        } catch(e) { console.error(`  Engine error ${modelId}:`, e.message); }

        await sleep(DELAY);
      }
    } catch(e) { console.error(`Make error ${make.name}:`, e.message); }
    await sleep(600);
  }

  console.log(`\nDone! Models: ${totalModels}, Engines: ${totalEngines}`);
  await prisma.$disconnect();
}

main().catch(console.error);
