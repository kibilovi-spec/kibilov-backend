const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cache = require('../services/cache');
const autodoc = require('../services/autodoc');

// GET /api/catalog/makes
router.get('/makes', async (req, res) => {
  try {
    const cacheKey = 'catalog:makes';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const raw = await autodoc.getManufacturersByType(1);
    const manus = (raw?.manufacturers || []).map(m => ({
      id: String(m.manufacturerId),
      name: m.manufacturerName,
      autodoc_id: m.manufacturerId,
    }));

    await cache.set(cacheKey, manus, 86400);
    res.json({ success: true, data: manus });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/catalog/models?makeId=ID
router.get('/models', async (req, res) => {
  try {
    const { makeId } = req.query;
    if (!makeId) return res.status(400).json({ error: 'makeId საჭიროა' });

    const cacheKey = `catalog:models:${makeId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const KEY = process.env.RAPIDAPI_KEY;
    const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
    const r = await fetch(`https://${HOST}/api/models/list/type-id/1/manufacturer-id/${makeId}/lang-id/4/country-filter-id/63`, {
      headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST }
    });
    const raw = await r.json();
    const models = (raw?.models || raw || []).map(m => ({
      id: String(m.modelId || m.id),
      name: m.modelName || m.name,
      yearFrom: m.yearOfConstructionFrom || null,
      yearTo: m.yearOfConstructionTo || null,
      autodoc_id: m.modelId || m.id,
    })).sort((a, b) => (a.name||'').localeCompare(b.name||''));

    await cache.set(cacheKey, models, 86400);
    res.json({ success: true, data: models });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/catalog/years?modelId=ID
router.get('/years', async (req, res) => {
  try {
    const { modelId } = req.query;
    if (!modelId) return res.status(400).json({ error: 'modelId საჭიროა' });

    const cacheKey = `catalog:years:${modelId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    // vehicles სია
    const raw = await autodoc.getVehicleListByModel(modelId);
    const types = raw?.modelTypes || [];
    
    // პირველი vehicle-ის details-დან წლები
    const yearSet = new Set();
    const sampleIds = [...new Set(types.map(v => v.vehicleId))].slice(0, 3);
    for (const vid of sampleIds) {
      try {
        const det = await autodoc.getVehicleDetails(vid);
        const d = det?.vehicleTypeDetails;
        if (d?.constructionIntervalStart) {
          const from = parseInt(d.constructionIntervalStart.substring(0,4));
          const to = d.constructionIntervalEnd ? parseInt(d.constructionIntervalEnd.substring(0,4)) : new Date().getFullYear();
          for (let y = to; y >= from; y--) yearSet.add(y);
        }
      } catch(e) {}
    }

    const years = [...yearSet].sort((a,b) => b-a);
    await cache.set(cacheKey, years, 86400);
    res.json({ success: true, data: years });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// GET /api/catalog/engines?modelId=UUID&year=2008
router.get('/engines', async (req, res) => {
  try {
    const { modelId, year } = req.query;
    if (!modelId) return res.status(400).json({ error: 'modelId საჭიროა' });

    // 1. vehicle_variants-ში ვეძებთ
    let rows = [];
    if (year) {
      const y = parseInt(year);
      rows = await prisma.$queryRaw`
        SELECT vehicle_id, name, engine, fuel, power_hp, power_kw, year_from, year_to
        FROM vehicle_variants
        WHERE model_id = ${modelId}
          AND (year_from IS NULL OR year_from <= ${y})
          AND (year_to   IS NULL OR year_to   >= ${y})
        ORDER BY engine ASC
      `;
    } else {
      rows = await prisma.$queryRaw`
        SELECT vehicle_id, name, engine, fuel, power_hp, power_kw, year_from, year_to
        FROM vehicle_variants
        WHERE model_id = ${modelId}
        ORDER BY engine ASC
      `;
    }

    // 2. ცარიელია — Autodoc API-დან წამოვიღოთ
    if (!rows.length) {
      const autodoc = require('../services/autodoc');
      const raw = await autodoc.getVehicleListByModel(modelId);
      const types = raw?.modelTypes || [];
      for (const v of types) {
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO vehicle_variants (vehicle_id, model_id, make_id, name, engine, fuel, year_from, year_to)
             SELECT $1, $2, vm.make_id, $3, $4, $5, $6, $7
             FROM vehicle_models vm WHERE vm.id = $2
             ON CONFLICT DO NOTHING`,
            String(v.vehicleId), modelId,
            (v.modelName||'') + ' ' + (v.typeEngineName||''),
            v.typeEngineName||'', v.fuelType||'',
            v.yearFrom ? parseInt(v.yearFrom) : null,
            v.yearTo ? parseInt(v.yearTo) : null
          );
        } catch(e) {}
      }
      rows = types.map(v => ({
        vehicle_id: String(v.vehicleId),
        name: (v.modelName||'') + ' ' + (v.typeEngineName||''),
        engine: v.typeEngineName || '',
        fuel: v.fuelType || '',
        year_from: v.yearFrom ? parseInt(v.yearFrom) : null,
        year_to: v.yearTo ? parseInt(v.yearTo) : null,
      }));
      if (year) {
        const y = parseInt(year);
        rows = rows.filter(r => (!r.year_from || r.year_from <= y) && (!r.year_to || r.year_to >= y));
      }
    }

    res.json({ success: true, data: rows });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/catalog/compatibility-count?vehicleId=19942
router.get('/compatibility-count', async (req, res) => {
  try {
    const { vehicleId } = req.query;
    if (!vehicleId) return res.status(400).json({ error: 'vehicleId საჭიროა' });

    const oemRows = await prisma.$queryRaw`
      SELECT oem_code FROM vehicle_oem WHERE vehicle_id = ${String(vehicleId)}
    `;

    if (!oemRows.length) {
      return res.json({ success: true, count: 0, vehicleId });
    }

    const oemCodes = oemRows.map(r => r.oem_code);
    const countRows = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count
      FROM products
      WHERE "alternativeSearchKeys" && ${oemCodes}::text[]
    `;

    res.json({ success: true, count: countRows[0]?.count || 0, vehicleId });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// GET /api/catalog/resolve?make=BMW&model=E90&year=2008
router.get('/resolve', async (req, res) => {
  try {
    const { make, model, year } = req.query;
    if (!make) return res.status(400).json({ error: 'make საჭიროა' });

    // 1. vehicle_variants-ში ვეძებთ
    let variants = [];
    if (year) {
      const y = parseInt(year);
      variants = await prisma.$queryRaw`
        SELECT vv.vehicle_id, vv.name, vv.engine, vv.fuel,
               vv.year_from, vv.year_to, vv.vehicle_slug,
               vm.name as model_name, vmk.name as make_name
        FROM vehicle_variants vv
        JOIN vehicle_models vm  ON vv.model_id = vm.id
        JOIN vehicle_makes  vmk ON vv.make_id  = vmk.id
        WHERE UPPER(vmk.name) LIKE UPPER(${`%${make}%`})
          AND UPPER(vm.name)  LIKE UPPER(${`%${model}%`})
          AND (vv.year_from IS NULL OR vv.year_from <= ${y})
          AND (vv.year_to   IS NULL OR vv.year_to   >= ${y})
        LIMIT 10
      `;
    } else if (model) {
      variants = await prisma.$queryRaw`
        SELECT vv.vehicle_id, vv.name, vv.engine, vv.fuel,
               vv.year_from, vv.year_to, vv.vehicle_slug,
               vm.name as model_name, vmk.name as make_name
        FROM vehicle_variants vv
        JOIN vehicle_models vm  ON vv.model_id = vm.id
        JOIN vehicle_makes  vmk ON vv.make_id  = vmk.id
        WHERE UPPER(vmk.name) LIKE UPPER(${`%${make}%`})
          AND UPPER(vm.name)  LIKE UPPER(${`%${model}%`})
        LIMIT 10
      `;
    }

    // 2. vehicle_cache-ში ვეძებთ (precached vehicle_ids)
    const cached = await prisma.$queryRaw`
      SELECT vehicle_id, manufacturer, model as model_name, year, engine
      FROM vehicle_cache
      WHERE UPPER(manufacturer) LIKE UPPER(${`%${make}%`})
        AND UPPER(model) LIKE UPPER(${`%${model || ''}%`})
      LIMIT 5
    `;

    // 3. make/model IDs
    const makeRow = await prisma.$queryRaw`
      SELECT id, name FROM vehicle_makes
      WHERE UPPER(name) LIKE UPPER(${`%${make}%`})
      LIMIT 1
    `;
    const modelRow = model ? await prisma.$queryRaw`
      SELECT vm.id, vm.name, vm."yearFrom", vm."yearTo"
      FROM vehicle_models vm
      JOIN vehicle_makes vmk ON vm."makeId" = vmk.id
      WHERE UPPER(vmk.name) LIKE UPPER(${`%${make}%`})
        AND UPPER(vm.name)  LIKE UPPER(${`%${model}%`})
      ORDER BY vm."yearFrom" DESC NULLS LAST
      LIMIT 1
    ` : [];

    const bestVehicleId = variants[0]?.vehicle_id || cached[0]?.vehicle_id || null;

    res.json({
      success:   true,
      vehicleId: bestVehicleId,
      makeId:    makeRow[0]?.id    || null,
      makeName:  makeRow[0]?.name  || make,
      modelId:   modelRow[0]?.id   || null,
      modelName: modelRow[0]?.name || model,
      variants:  variants.slice(0, 5),
      cached:    cached.slice(0, 3),
    });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/catalog/category-images — category-სთვის პირველი პროდუქტის სურათი
router.get('/category-images', async (req, res) => {
  try {
    const CLOUDINARY_BASE = '/images/categories';
    const SLUGS = ['brakes','oils-fluids','amortizacia','savali','body','engines',
                   'clutch','electrics','driveshaft','filters','cooling','tires',
                   'steering','accessories','glass'];
    const map = {};
    for (const slug of SLUGS) {
      map[slug] = `${CLOUDINARY_BASE}/${slug}.png`;
    }
    res.json({ success: true, data: map });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;

// GET /api/catalog/category-counts?vehicleId=XXX
// materialized view + Redis cache
router.get('/category-counts', async (req, res) => {
  try {
    const { vehicleId } = req.query;
    if (!vehicleId) return res.json({ success: true, data: {} });

    const cacheKey = `cat_counts:${vehicleId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached, fromCache: true });

    const rows = await prisma.$queryRaw`
      SELECT slug, oem_count
      FROM vehicle_category_stats
      WHERE vehicle_id = ${String(vehicleId)}
      ORDER BY oem_count DESC
    `;

    const counts = {};
    for (const row of rows) {
      counts[row.slug] = parseInt(row.oem_count);
    }

    await cache.set(cacheKey, counts, 86400); // 24 საათი
    res.json({ success: true, data: counts });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
