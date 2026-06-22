'use strict';
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

// GET /api/garages — partner garages list
router.get('/', async (req, res) => {
  try {
    const { city } = req.query;
    const garages = await prisma.user.findMany({
      where: {
        isPartnerGarage: true,
        isActive: true,
        ...(city && { garageCity: { contains: city, mode: 'insensitive' } }),
      },
      select: {
        id: true, name: true, phone: true,
        garageCity: true, b2bTier: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(garages);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
