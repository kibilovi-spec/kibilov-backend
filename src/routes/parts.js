'use strict';
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { enrichWithSynonyms, GEO_AUTO_SYNONYMS } = require('../services/synonyms');
const router = express.Router();
const prisma = new PrismaClient();

// SKU normalize
function normalizeKey(input) {
  return input.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
}

// ── SKU Search ────────────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  try {
    const { q = '', makeId, modelId, year, lang = 'ka', page = 1, limit = 20 } = req.query;
    const normalized = normalizeKey(q);
    // ქართული სლენგ mapping
    const synonymKeys = [];
    if (q) {
      for (const [slang, terms] of Object.entries(GEO_AUTO_SYNONYMS)) {
        const allTerms = [slang, ...terms];
        if (allTerms.some(t => q.toLowerCase().includes(t.toLowerCase()))) {
          synonymKeys.push(...allTerms.map(t => normalizeKey(t)));
        }
      }
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isActive: true,
      ...(q && {
        OR: [
          { normalizedSku: normalized },
          { alternativeSearchKeys: { has: normalized } },
          { nameKa: { contains: q, mode: 'insensitive' } },
          { nameEn: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          ...synonymKeys.map(k => ({ alternativeSearchKeys: { has: k } })),
          ...synonymKeys.map(k => ({ normalizedSku: k })),
        ]
      })
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true, sku: true, nameKa: true, nameEn: true, nameRu: true,
          brand: true, price: true, priceOld: true, stock: true,
          images: true, badge: true, rating: true, reviewCount: true,
          oemCodes: true, categoryId: true,
        },
        skip, take: parseInt(limit),
        orderBy: { isFeatured: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    // Zero results — log
    if (q) {
      await prisma.searchLog.create({
        data: {
          query: q,
          resultCount: total,
          makeId: makeId || null,
          modelId: modelId || null,
          year: year ? parseInt(year) : null,
          userId: req.user?.id || null,
        }
      }).catch(() => {});
    }

    res.json({ products, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Fitment Search ────────────────────────────────────────────────────────
router.get('/fitment', async (req, res) => {
  try {
    const { makeId, modelId, year } = req.query;
    if (!makeId || !modelId) return res.status(400).json({ error: 'makeId და modelId სავალდებულოა' });

    const fitments = await prisma.fitmentCache.findMany({
      where: {
        makeId,
        modelId,
        ...(year && {
          yearFrom: { lte: parseInt(year) },
          yearTo:   { gte: parseInt(year) },
        }),
      },
      select: { oemCodes: true, yearFrom: true, yearTo: true, engineId: true },
    });

    const oemCodes = [...new Set(fitments.flatMap(f => f.oemCodes))];

    // OEM codes → products
    const products = oemCodes.length ? await prisma.product.findMany({
      where: {
        isActive: true,
        oemCodes: { hasSome: oemCodes },
      },
      select: {
        id: true, sku: true, nameKa: true, brand: true,
        price: true, stock: true, images: true, badge: true,
      },
      take: 50,
    }) : [];

    res.json({ fitments, oemCodes, products });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Zero Results Top ──────────────────────────────────────────────────────
router.get('/zero-results', async (req, res) => {
  try {
    const top = await prisma.searchLog.groupBy({
      by: ['query'],
      where: { resultCount: 0 },
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: 10,
    });
    res.json(top);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
