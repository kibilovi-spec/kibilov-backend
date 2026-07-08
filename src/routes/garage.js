'use strict';
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/garage — ყველა მანქანა
router.get('/', authenticate, async (req, res) => {
  try {
    const vehicles = await prisma.userVehicle.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'desc' }]
    });
    // model image lookup
    const enriched = await Promise.all(vehicles.map(async (v) => {
      try {
        const modelRow = await prisma.$queryRaw`
          SELECT id FROM vehicle_models 
          WHERE LOWER(name) = LOWER(${v.model}) 
          LIMIT 1
        `;
        const modelId = modelRow?.[0]?.id;
        return {
          ...v,
          modelId: modelId || null,
          modelImageUrl: modelId 
            ? 'https://fsn1.your-objectstorage.com/tecdoc2025/models/' + modelId + '.jpg'
            : null,
        };
      } catch { return { ...v, modelId: null, modelImageUrl: null }; }
    }));
    res.json({ success: true, data: enriched });
  } catch(e) { console.error('GARAGE ERROR:', e.message, e.stack?.split('\n')[1]); res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/garage — მანქანის დამატება
router.post('/', authenticate, async (req, res) => {
  try {
    const { brand, model, year, engine, fuelType, vehicleId } = req.body;
    if (!brand) return res.status(400).json({ success: false, message: 'brand required' });
    if (!model) return res.status(400).json({ success: false, message: 'model required' });
    // year optional — model სახელში წლები ჩანს

    // პირველი მანქანა ავტომატურად მთავარია
    const existing = await prisma.userVehicle.count({ where: { userId: req.user.id } });
    const vehicle = await prisma.userVehicle.create({
      data: {
        userId: req.user.id,
        make: brand,
        model: model,
        year: year ? parseInt(year) : null,
        engine: engine || null,
        fuelType: fuelType || null,
        vehicleId: vehicleId ? String(vehicleId) : null,
        isMain: existing === 0,
      }
    });
    res.json({ success: true, data: vehicle });
  } catch(e) { console.error('GARAGE POST ERROR:', e.message); res.status(500).json({ success: false, message: e.message }); }
});

// PATCH /api/garage/:id/main — მთავარ მანქანად დაყენება
router.patch('/:id/main', authenticate, async (req, res) => {
  try {
    await prisma.userVehicle.updateMany({
      where: { userId: req.user.id },
      data: { isMain: false }
    });
    await prisma.userVehicle.update({
      where: { id: req.params.id },
      data: { isMain: true }
    });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/garage/:id/parts — ამ მანქანის ნაწილები
router.get('/:id/parts', authenticate, async (req, res) => {
  try {
    const vehicle = await prisma.userVehicle.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!vehicle) return res.status(404).json({ success: false, message: 'მანქანა ვერ მოიძებნა' });
    if (!vehicle.vehicle_id) return res.json({ success: true, data: [], message: 'vehicleId არ არის' });

    // OEM კოდების მიხედვით ნაწილები
    const oemCodes = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT oem_code FROM vehicle_oem WHERE vehicle_id = $1 LIMIT 100
    `, parseInt(vehicle.vehicle_id));

    const codes = oemCodes.map((r) => r.oem_code);
    if (!codes.length) return res.json({ success: true, data: [] });

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        oemCodes: { hasSome: codes }
      },
      take: 20,
      orderBy: { stock: 'desc' }
    });
    res.json({ success: true, data: products, vehicleId: vehicle.vehicle_id });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/garage/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.userVehicle.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;

// GET /api/garage/vehicle-categories/:vehicleId
router.get('/vehicle-categories/:vehicleId', authenticate, async (req, res) => {
  try {
    const axios = require('axios');
    const HEADERS = {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com',
    };
    const r = await axios.get(
      `https://autodoc-parts-catalog.p.rapidapi.com/api/category/type-id/1/products-groups-variant-1/${req.params.vehicleId}/lang-id/4`,
      { headers: HEADERS, timeout: 10000 }
    );
    const cats = r.data?.categories || [];
    // top level კატეგორიები
    const top = cats.filter(c => c.level === 1).map(c => ({
      id: c.categoryId1,
      name: c.categoryName1,
    }));
    const unique = Array.from(new Map(top.map(c => [c.id, c])).values());
    res.json({ success: true, data: unique });
  } catch(e) { res.json({ success: true, data: [] }); }
});
