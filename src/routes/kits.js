'use strict';
const express = require('express');
const { prisma } = require('../middleware/auth');
const router = express.Router();

const REPAIR_KITS = {
  'timing_kit': {
    ka: 'ტაიმინგის კომპლექტი',
    parts: ['timing_belt', 'tensioner', 'water_pump'],
    keywords: ['მატოს', 'timing', 'ремень', 'ტაიმინგ'],
    categoryIds: [100452, 100454, 100091]
  },
  'brake_kit_front': {
    ka: 'წინა სამუხრუჭე კომპლექტი',
    parts: ['brake_pads_front', 'brake_discs_front'],
    keywords: ['წინა ხუნდი', 'წინა დისკი', 'front brake'],
    categoryIds: [100030, 100032]
  },
  'brake_kit_rear': {
    ka: 'უკანა სამუხრუჭე კომპლექტი',
    parts: ['brake_pads_rear', 'brake_discs_rear'],
    keywords: ['უკანა ხუნდი', 'უკანა დისკი', 'rear brake'],
    categoryIds: [100030, 100032]
  },
  'oil_service_kit': {
    ka: 'ზეთის შეცვლის კომპლექტი',
    parts: ['oil_filter', 'drain_plug', 'engine_oil'],
    keywords: ['ზეთის ფილტ', 'oil filter', 'масло'],
    categoryIds: [100259]
  },
  'suspension_kit': {
    ka: 'საავარიო ნაკრები',
    parts: ['shock_absorber', 'spring', 'bearing'],
    keywords: ['ამორტ', 'suspension', 'стойка'],
    categoryIds: [100121, 100126, 100579]
  },
};

// GET /api/kits — ყველა kit
router.get('/', (req, res) => {
  res.json({ success: true, data: REPAIR_KITS });
});

// GET /api/kits/:kitId/products?make=VW&model=Golf&year=2011
router.get('/:kitId/products', async (req, res) => {
  try {
    const { kitId } = req.params;
    const { make, model, year } = req.query;
    const kit = REPAIR_KITS[kitId];
    if (!kit) return res.status(404).json({ success: false, message: 'kit ვერ მოიძებნა' });

    const keywords = kit.keywords;
    const products = await prisma.product.findMany({
      where: {
        OR: keywords.map(kw => ({ nameKa: { contains: kw, mode: 'insensitive' } })),
        stock: { gt: 0 }
      },
      take: 20,
      select: { id: true, nameKa: true, price: true, stock: true, images: true, oemCodes: true }
    });

    // vehicle filter if provided
    let filtered = products;
    if (make && model) {
      const makeU = make.toUpperCase();
      const modelU = model.toUpperCase();
      const hasVehicleFilter = filtered.filter(p => {
        const name = (p.nameKa || '').toUpperCase();
        return name.includes(makeU) || name.includes(modelU);
      });
      if (hasVehicleFilter.length > 0) filtered = hasVehicleFilter;
    }

    const total = filtered.reduce((sum, p) => sum + parseFloat(p.price || '0'), 0);

    res.json({
      success: true,
      kit: { id: kitId, ...kit },
      products: filtered,
      total: total.toFixed(2),
      savings: (total * 0.05).toFixed(2)
    });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
