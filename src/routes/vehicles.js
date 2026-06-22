'use strict';
const express = require('express');
const { prisma, authenticate } = require('../middleware/auth');
const cache = require('../services/cache');
const router = express.Router();

// GET /api/vehicles
router.get('/', authenticate, async (req, res) => {
  const vehicles = await prisma.userVehicle.findMany({
    where: { userId: req.user.id },
    orderBy: [{ isMain: 'desc' }, { createdAt: 'desc' }],
  });
  res.json({ success: true, data: vehicles });
});

// POST /api/vehicles
router.post('/', authenticate, async (req, res) => {
  const { make, model, year, engine, fuelType, displacement, isMain } = req.body;
  if (!make || !model || !year) return res.status(422).json({ success: false, message: 'მარკა, მოდელი და წელი სავალდებულოა' });

  if (isMain) {
    await prisma.userVehicle.updateMany({ where: { userId: req.user.id }, data: { isMain: false } });
  }

  const vehicle = await prisma.userVehicle.create({
    data: { userId: req.user.id, make, model, year: parseInt(year), engine: engine || `${displacement||''} ${fuelType||''}`.trim(), fuelType, displacement, isMain: isMain || false },
  });
  res.status(201).json({ success: true, data: vehicle });
});

// PUT /api/vehicles/:id/main — set as main
router.put('/:id/main', authenticate, async (req, res) => {
  await prisma.userVehicle.updateMany({ where: { userId: req.user.id }, data: { isMain: false } });
  const v = await prisma.userVehicle.update({ where: { id: req.params.id }, data: { isMain: true } });
  res.json({ success: true, data: v });
});

// DELETE /api/vehicles/:id
router.delete('/:id', authenticate, async (req, res) => {
  await prisma.userVehicle.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ success: true });
});



// GET /api/vehicles/compatibility?productId=xxx
router.get('/compatibility', authenticate, async (req, res) => {
  const { productId } = req.query;
  if (!productId) return res.status(400).json({ success: false, message: 'productId საჭიროა' });
  try {
    // ძირითადი მანქანა
    const mainVehicle = await prisma.userVehicle.findFirst({
      where: { userId: req.user.id, isMain: true }
    });
    if (!mainVehicle) return res.json({ success: true, status: 'no_vehicle', badge: null });

    // პროდუქტის OEM კოდები
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { oemCodes: true, alternativeSearchKeys: true, categoryId: true }
    });
    if (!product) return res.json({ success: true, status: 'no_product', badge: null });

    // vehicle_oem-ში შევამოწმოთ vehicleId-OEM კავშირი
    const vehicleCache = await prisma.$queryRaw`
      SELECT vehicle_id FROM vehicle_cache
      WHERE manufacturer ILIKE ${mainVehicle.make + '%'}
      AND model ILIKE ${'%' + mainVehicle.model + '%'}
      LIMIT 5
    `;

    if (!vehicleCache.length) {
      return res.json({
        success: true,
        status: 'vin_required',
        badge: 'yellow',
        message: 'VIN-ით გადაამოწმეთ',
        vehicle: `${mainVehicle.make} ${mainVehicle.model} ${mainVehicle.year}`
      });
    }

    const vehicleIds = vehicleCache.map(v => v.vehicle_id);

    // product_oem_map-ში შევამოწმოთ
    const oemMatch = await prisma.$queryRaw`
      SELECT COUNT(*) as cnt FROM product_oem_map
      WHERE product_id = ${productId}
      AND vehicle_id = ANY(${vehicleIds}::text[])
    `;

    const cnt = parseInt(oemMatch[0]?.cnt || '0');

    if (cnt > 0) {
      return res.json({
        success: true, status: 'compatible', badge: 'green',
        message: '✅ თავსებადია თქვენს მანქანასთან',
        vehicle: `\${mainVehicle.make} \${mainVehicle.model} \${mainVehicle.year}`
      });
    }

    // alternativeSearchKeys-ში OEM match
    const allOems = [...(product.oemCodes || []), ...(product.alternativeSearchKeys || [])];
    const vehicleOems = await prisma.$queryRaw`
      SELECT oem_code FROM vehicle_oem
      WHERE vehicle_id = ANY(${vehicleIds}::text[])
      LIMIT 500
    `;
    const vehicleOemSet = new Set(vehicleOems.map(r => r.oem_code?.replace(/\s/g, '').toUpperCase()));
    const hasMatch = allOems.some(o => vehicleOemSet.has(o?.replace(/\s/g, '').toUpperCase()));

    if (hasMatch) {
      return res.json({
        success: true, status: 'compatible', badge: 'green',
        message: '✅ თავსებადია თქვენს მანქანასთან',
        vehicle: `\${mainVehicle.make} \${mainVehicle.model} \${mainVehicle.year}`
      });
    }

    return res.json({
      success: true, status: 'vin_required', badge: 'yellow',
      message: '⚠️ VIN-ით გადაამოწმეთ',
      vehicle: `\${mainVehicle.make} \${mainVehicle.model} \${mainVehicle.year}`
    });

  } catch(e) {
    return res.json({ success: true, status: 'vin_required', badge: 'yellow', message: '⚠️ VIN-ით გადაამოწმეთ' });
  }
});



// GET /api/vehicles/why-this-part?productId=xxx — "Why this part?" AI explanation
router.get('/why-this-part', authenticate, async (req, res) => {
  const { productId } = req.query;
  try {
    const mainVehicle = await prisma.userVehicle.findFirst({ where: { userId: req.user.id, isMain: true } });
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { nameKa: true, oemCodes: true, alternativeSearchKeys: true }
    });
    if (!product || !mainVehicle) return res.json({ success: false });

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const r = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `მომხმარებელს ჰყავს ${mainVehicle.make} ${mainVehicle.model} ${mainVehicle.year}.
პროდუქტია: ${product.nameKa}
OEM: ${(product.oemCodes || []).slice(0,3).join(', ')}

დაწერე მოკლე ქართული ახსნა (2-3 წინადადება) რატომ არის ეს ნაწილი სწორი არჩევანი.
მხოლოდ ტექსტი, emoji-ს გარეშე.`
      }]
    });

    res.json({ success: true, explanation: r.content[0].text });
  } catch(e) {
    res.json({ success: false, explanation: null });
  }
});

module.exports = router;

// GET /api/vehicles/makes — მარკების სია (Autodoc)
router.get('/makes', async (req, res) => {
  try {
    const cache = require('../services/cache');
    const autodoc = require('../services/autodoc');
    const cacheKey = 'vehicles:makes';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached });
    const raw = await autodoc.getManufacturersByType(1);
    const makes = (raw?.manufacturers || []).map(m => m.manufacturerName).filter(Boolean).sort();
    await cache.set(cacheKey, makes, 86400);
    res.json({ success: true, data: makes });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/vehicles/models?make=Toyota — მოდელების სია (DB-იდან)
router.get('/models', async (req, res) => {
  const { make } = req.query;
  if (!make) return res.status(422).json({ success: false, message: 'make საჭიროა' });
  try {
    const makeRow = await prisma.$queryRaw`
      SELECT id FROM vehicle_makes WHERE LOWER(name) = LOWER(${make}) LIMIT 1
    `;
    if (!makeRow.length) return res.json({ success: true, data: [] });
    const makeId = makeRow[0].id;
    const rows = await prisma.$queryRaw`
      SELECT id, name, "yearFrom", "yearTo", image_url
      FROM vehicle_models
      WHERE "makeId" = ${makeId}
      ORDER BY name
    `;
    const models = rows.map(m => ({
      id: m.id,
      name: m.yearFrom ? `${m.name} (${m.yearFrom}${m.yearTo && m.yearTo !== m.yearFrom ? '-'+m.yearTo : ''})` : m.name,
      nameRaw: m.name,
      yearFrom: m.yearFrom,
      yearTo: m.yearTo,
      imageUrl: m.image_url,
    }));
    res.json({ success: true, data: models });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/vehicles/engines?make=Toyota&model=Camry&year=2019 (DB-იდან)
router.get('/engines', async (req, res) => {
  const { make, model, year } = req.query;
  if (!make || !model) return res.status(422).json({ success: false, message: 'make, model საჭიროა' });
  try {
    const yearNum = parseInt(year) || 0;
    // Find model_id by name (strip year from name if present)
    const makeRow = await prisma.$queryRaw`
      SELECT id FROM vehicle_makes WHERE LOWER(name) = LOWER(${make}) LIMIT 1
    `;
    if (!makeRow.length) return res.json({ success: true, data: [] });
    const makeId = makeRow[0].id;

    const modelClean = model.replace(/\s*\(.*\)\s*$/, '').trim();
    const modelRows = await prisma.$queryRaw`
      SELECT id FROM vehicle_models 
      WHERE "makeId" = ${makeId} AND (
        LOWER(name) = LOWER(${model}) OR 
        name ILIKE ${model + '%'} OR
        name ILIKE ${modelClean + '%'}
      )
      LIMIT 10
    `;
    if (!modelRows.length) return res.json({ success: true, data: [] });

    const modelIds = modelRows.map(m => m.id);
    let engines;
    if (yearNum) {
      engines = await prisma.$queryRaw`
        SELECT DISTINCT engine_name, fuel_type, power_kw, capacity, vehicle_id
        FROM vehicle_engines
        WHERE model_id = ANY(${modelIds})
        AND (year_from IS NULL OR year_from <= ${yearNum})
        AND (year_to IS NULL OR year_to >= ${yearNum})
        ORDER BY engine_name
      `;
    } else {
      engines = await prisma.$queryRaw`
        SELECT DISTINCT engine_name, fuel_type, power_kw, capacity, vehicle_id
        FROM vehicle_engines
        WHERE model_id = ANY(${modelIds})
        ORDER BY engine_name
      `;
    }
    res.json({ success: true, data: engines.map(e => ({
      vehicle_id: e.vehicle_id,
      name: e.engine_name,
      engine: e.engine_name,
      fuelType: e.fuel_type,
      powerKw: e.power_kw,
      capacity: e.capacity,
    }))});
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/vehicles/vin?vin=1HGCM82633A004352
router.get('/vin', async (req, res) => {
  const { vin } = req.query;
  if (!vin || vin.length !== 17) {
    return res.status(400).json({ success: false, message: 'VIN კოდი 17 სიმბოლო უნდა იყოს' });
  }
  try {
    const vinResolver = require('../services/vinResolver');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const resolved = await vinResolver.resolveVIN(vin, prisma);
    await prisma.$disconnect();
    if (!resolved) throw new Error('VIN ვერ მოიძებნა');
    // tecdoc_multi — რამდენიმე vehicle
    if (resolved.source === 'tecdoc_multi') {
      return res.json({ success: true, source: 'tecdoc_multi', vehicles: resolved.vehicles, vehicleId: resolved.vehicles?.[0]?.vehicleId });
    }
    if (!resolved.make) throw new Error('VIN ვერ მოიძებნა');
    const vehicle = {
      make: resolved.make,
      model: resolved.model || null,
      year: resolved.year || null,
      bodyClass: resolved.body || null,
      driveType: null,
      engineCyl: null,
      displacement: resolved.engine || null,
      fuelType: resolved.fuel || null,
      transmission: null,
      plantCountry: null,
    };
    let score = 0;
    if (vehicle.make)  score += 30;
    if (vehicle.model) score += 30;
    if (vehicle.year)  score += 20;
    if (vehicle.displacement) score += 10;
    if (vin.length === 17) score += 10;
    const confidence = score >= 95 ? 'high' : score >= 70 ? 'medium' : 'low';
    const confidenceMsg =
      score >= 95 ? '✅ მანქანა დადასტურებულია' :
      score >= 70 ? '⚠️ წელი გადაამოწმეთ' :
      '❌ VIN ხელით შეიყვანეთ';
    const prisma2 = new PrismaClient();
    const vehicleId = await vinResolver.resolveVehicleId(resolved, prisma2, vin.toUpperCase());
    await prisma2.$disconnect();
    res.json({ success: true, data: { vehicle, score, confidence, confidenceMsg, vehicleId } });
  } catch(e) {
    res.status(503).json({ success: false, message: 'VIN lookup მიუწვდომელია', showManual: true });
  }
});

// GET /api/vehicles/years?make=BMW&model=3 (E90)
router.get('/years', async (req, res) => {
  const { make, model } = req.query;
  if (!make || !model) return res.status(422).json({ success: false });
  try {
    const autodoc = require('../services/autodoc');
    const mfgRaw = await autodoc.getManufacturersByType(1);
    const mfg = (mfgRaw?.manufacturers || []).find(m => m.manufacturerName.toLowerCase() === make.toLowerCase());
    if (!mfg) return res.json({ success: true, data: [] });
    const modRaw = await autodoc.getModelsByManufacturer(mfg.manufacturerId);
    const mod = (modRaw?.models || []).find(m => m.modelName === model);
    if (!mod) return res.json({ success: true, data: [] });
    const from = parseInt((mod.modelYearFrom || '').substring(0,4)) || 2000;
    const to = parseInt((mod.modelYearTo || '').substring(0,4)) || new Date().getFullYear();
    const years = [];
    for (let y = to; y >= from; y--) years.push(y);
    res.json({ success: true, data: years });
  } catch(e) {
    res.json({ success: true, data: [] });
  }
});

// GET /api/vehicles/resolve?make=BMW&model=3 (E90)&year=2010
router.get('/resolve', async (req, res) => {
  const { make, model, year } = req.query;
  if (!make || !model) return res.status(422).json({ success: false });
  try {
    const autodoc = require('../services/autodoc');
    const mfgRaw = await autodoc.getManufacturersByType(1);
    const mfg = (mfgRaw?.manufacturers || []).find(m => m.manufacturerName.toLowerCase() === make.toLowerCase());
    if (!mfg) return res.json({ success: false });
    const modRaw = await autodoc.getModelsByManufacturer(mfg.manufacturerId);
    const yearNum = parseInt(year);
    const allMods = (modRaw?.models || []).filter(m => m.modelName === model);
    let mod = yearNum ? allMods.find(m => {
      const from = parseInt((m.modelYearFrom||'').substring(0,4))||0;
      const to = parseInt((m.modelYearTo||'').substring(0,4))||9999;
      return from <= yearNum && yearNum <= to;
    }) : null;
    if (!mod) mod = allMods[0];
    if (!mod) return res.json({ success: false });
    const vehs = await autodoc.getVehicleListTypes(mod.modelId);
    const vehicleId = vehs?.modelTypes?.[0]?.vehicleId || mod.modelId;
    res.json({ success: true, makeId: mfg.manufacturerId, modelId: mod.modelId, vehicleId: String(vehicleId) });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});
