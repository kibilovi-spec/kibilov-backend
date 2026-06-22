const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const vehicles = await prisma.userVehicle.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: vehicles });
  } catch(e) { res.status(500).json({ error: e.message }); }
  finally { await prisma.$disconnect(); }
});

router.post('/', authenticate, async (req, res) => {
  const prisma = new PrismaClient();
  try {
    console.log('GARAGE POST body:', JSON.stringify(req.body));
    const { brand, model, year, engine, fuelType, vehicleId } = req.body;
    if (!brand) return res.status(400).json({ error: 'brand required' });
    if (!model) return res.status(400).json({ error: 'model required' });
    const vehicle = await prisma.userVehicle.create({
      data: {
        userId: req.user.id,
        make: brand,
        model: model,
        year: year ? parseInt(year) : new Date().getFullYear(),
        engine: engine || null,
        fuelType: fuelType || null,
        vehicleId: vehicleId ? String(vehicleId) : null,
      }
    });
    res.json({ vehicle, nickname: `${brand} ${model} ${year||''}`.trim() });
  } catch(e) { res.status(500).json({ error: e.message }); }
  finally { await prisma.$disconnect(); }
});

router.delete('/:id', authenticate, async (req, res) => {
  const prisma = new PrismaClient();
  try {
    await prisma.userVehicle.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
  finally { await prisma.$disconnect(); }
});

module.exports = router;
