const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/reference/lookup?make=toyota&model=camry&year=2008&part=oil+filter
router.get('/lookup', async (req, res) => {
  try {
    let { make, model, year, part } = req.query;
    if (make) make = String(make).slice(0, 50);
    if (model) model = String(model).slice(0, 50);
    if (part) part = String(part).slice(0, 100);
    if (!make || !part) return res.status(400).json({ error: 'make and part required' });

    const makeLow = make.toLowerCase();
    const modelLow = (model||'').toLowerCase();
    const yearNum = parseInt(year) || 0;
    const partLow = part.toLowerCase();

    // 1. generation resolve
    const { resolveGeneration, normalizePartType } = require('../services/referenceDb');
    const generation = resolveGeneration(makeLow, modelLow, yearNum);
    const partNorm = normalizePartType(partLow);

    // 2. DB lookup
    let codes = [];
    if (generation) {
      const rows = await prisma.referenceOem.findMany({
        where: { make: makeLow, model: modelLow, generation, partType: { contains: partNorm, mode: 'insensitive' } },
        orderBy: { id: 'asc' }
      });
      codes = rows.map(r => [r.brand, r.code, r.description]);
    }

    // fallback — without generation
    if (!codes.length) {
      const rows = await prisma.referenceOem.findMany({
        where: { make: makeLow, model: modelLow, partType: { contains: partNorm, mode: 'insensitive' } },
        orderBy: { id: 'asc' },
        take: 5
      });
      codes = rows.map(r => [r.brand, r.code, r.description]);
    }

    // capacity from description
    let capacity = null;
    for (const [,,desc] of codes) {
      const m = (desc||'').match(/cap:\s*([\d.]+)\s*L/i);
      if (m) { capacity = m[1] + 'L'; break; }
    }

    res.json({ make: makeLow, model: modelLow, generation, part: partNorm, codes, capacity });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/reference/service?make=toyota&model=camry&km=120000
router.get('/service', async (req, res) => {
  try {
    const { make, model, km } = req.query;
    if (!make || !km) return res.status(400).json({ error: 'make and km required' });
    const kmNum = parseInt(km);
    const makeLow = make.toLowerCase();
    const modelLow = (model||'').toLowerCase();

    const rows = await prisma.serviceInterval.findMany({
      where: {
        AND: [
          { OR: [{ make: makeLow }, { make: 'all' }] },
          { OR: [{ model: modelLow }, { model: 'all' }] },
          { kmFrom: { lte: kmNum } },
          { OR: [{ kmTo: { gte: kmNum } }, { kmTo: null }] }
        ]
      },
      orderBy: [{ priority: 'asc' }, { kmFrom: 'asc' }]
    });

    res.json({ make: makeLow, model: modelLow, km: kmNum, intervals: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/reference/engine?code=CAYC
router.get('/engine', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'code required' });
    const rows = await prisma.engineMapping.findMany({
      where: { engineCode: { equals: code.toUpperCase(), mode: 'insensitive' } }
    });
    res.json({ code, vehicles: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

// GET /api/reference/intelligence?make=mercedes&model=c-class&generation=w204&engine=OM651
router.get('/intelligence', async (req, res) => {
  try {
    const { make, model, generation, engine } = req.query;
    if (!make || !model) return res.status(400).json({ error: 'make and model required' });
    const rows = await prisma.partsIntelligence.findMany({
      where: {
        make: make.toLowerCase(),
        model: model.toLowerCase(),
        ...(generation ? { generation: generation.toLowerCase() } : {}),
        ...(engine ? { OR: [{ engineCode: engine.toUpperCase() }, { engineCode: null }] } : {})
      },
      orderBy: { frequency: 'desc' },
      take: 8
    });
    res.json({ make, model, generation, engine, parts: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/reference/popular?make=mercedes&model=c-class
router.get('/popular', async (req, res) => {
  try {
    const { make, model, limit } = req.query;
    const lim = parseInt(limit) || 10;
    const where = {};
    if (make) where.make = { contains: make, mode: 'insensitive' };
    if (model) where.model = { contains: model, mode: 'insensitive' };
    const logs = await prisma.$queryRaw`
      SELECT part_en, part_ka, make, model,
             COUNT(*) as search_count,
             SUM(CASE WHEN found THEN 1 ELSE 0 END) as found_count
      FROM search_log
      WHERE part_en IS NOT NULL
      ${make ? prisma.$queryRaw`AND LOWER(make) LIKE ${'%'+make.toLowerCase()+'%'}` : prisma.$queryRaw``}
      GROUP BY part_en, part_ka, make, model
      ORDER BY search_count DESC
      LIMIT ${lim}
    `;
    res.json({ popular: logs });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/search-analytics
router.get('/search-analytics', async (req, res) => {
  try {
    const popular = await prisma.$queryRaw`
      SELECT part_en, part_ka, make, model,
             COUNT(*)::int as search_count,
             SUM(CASE WHEN found THEN 1 ELSE 0 END)::int as found_count
      FROM search_log
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY part_en, part_ka, make, model
      ORDER BY search_count DESC
      LIMIT 20
    `;
    const notFound = await prisma.$queryRaw`
      SELECT part_en, part_ka, make, model, COUNT(*)::int as search_count
      FROM search_log
      WHERE found = false AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY part_en, part_ka, make, model
      ORDER BY search_count DESC
      LIMIT 10
    `;
    res.json({ popular, notFound });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/reference/compatibility?code=GDB3445
router.get('/compatibility', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'code required' });
    const rows = await prisma.referenceOem.findMany({
      where: { code: { equals: code, mode: 'insensitive' } },
      select: { make: true, model: true, generation: true, partType: true },
      orderBy: [{ make: 'asc' }, { model: 'asc' }]
    });
    res.json({ code, compatible: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
