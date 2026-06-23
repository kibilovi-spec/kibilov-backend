const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/search', async (req, res) => {
  try {
    const [total, zeros, topQueries, topBrands, topParts, daily] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM search_analytics`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM search_analytics WHERE results_count = 0`,
      prisma.$queryRaw`SELECT query, COUNT(*)::int as count FROM search_analytics GROUP BY query ORDER BY count DESC LIMIT 20`,
      prisma.$queryRaw`SELECT brand, COUNT(*)::int as count FROM search_analytics WHERE brand IS NOT NULL GROUP BY brand ORDER BY count DESC LIMIT 10`,
      prisma.$queryRaw`SELECT part_ka, COUNT(*)::int as count FROM search_analytics WHERE part_ka IS NOT NULL GROUP BY part_ka ORDER BY count DESC LIMIT 10`,
      prisma.$queryRaw`SELECT DATE(created_at) as date, COUNT(*)::int as searches, COUNT(CASE WHEN results_count=0 THEN 1 END)::int as zero_results FROM search_analytics WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY DATE(created_at) ORDER BY date DESC`,
    ]);
    const totalCount = total[0]?.count || 0;
    const zeroCount = zeros[0]?.count || 0;
    res.json({
      summary: {
        totalSearches: totalCount,
        zeroResults: zeroCount,
        zeroRate: totalCount > 0 ? ((zeroCount / totalCount) * 100).toFixed(1) + '%' : '0%',
      },
      topQueries, topBrands, topParts, daily,
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/click', async (req, res) => {
  try {
    const { analyticsId, productId, position } = req.body;
    if (analyticsId) {
      await prisma.$executeRaw`UPDATE search_analytics SET clicked=true, clicked_product_id=${productId||null}, position_clicked=${position||null} WHERE id=${analyticsId}`;
    }
    res.json({ success: true });
  } catch(e) {
    console.error('CLICK ERROR:', e.message);
    res.json({ success: false, error: e.message });
  }
});

router.post('/cart', async (req, res) => {
  try {
    const { analyticsId, productId } = req.body;
    if (analyticsId) {
      await prisma.$executeRaw`UPDATE search_analytics SET cart_added=true, clicked_product_id=COALESCE(clicked_product_id,${productId||null}) WHERE id=${analyticsId}`;
    }
    res.json({ success: true });
  } catch(e) {
    console.error('CART ERROR:', e.message);
    res.json({ success: false, error: e.message });
  }
});

router.post('/visit', async (req, res) => {
  try {
    const { sessionId, path: visitPath, referrer } = req.body;
    if (!sessionId) return res.json({ ok: false });
    const cache = require('../services/cache');
    const { PrismaClient } = require('@prisma/client');
    const _prisma = global._visitPrisma || (global._visitPrisma = new PrismaClient());
    const dateStr = new Date().toISOString().split('T')[0];
    const key = `visit:${sessionId}:${dateStr}`;
    const exists = await cache.get(key);
    if (!exists) {
      await cache.set(key, '1', 1800);
      await _prisma.$executeRaw`
        INSERT INTO site_visits (session_id, path, referrer)
        VALUES (${sessionId}, ${visitPath||'/'}, ${referrer||null})
      `;
    }
    res.json({ ok: true });
  } catch(e) { console.error('visit error:', e.message); res.json({ ok: false }); }
});


// POST /analytics/impressions — product show tracking
router.post('/impressions', async (req, res) => {
  try {
    const { analyticsId, products } = req.body;
    // products = [{productId, position}, ...]
    if (analyticsId && Array.isArray(products) && products.length > 0) {
      for (const p of products.slice(0, 20)) {
        if (!p.productId) continue;
        await prisma.$executeRaw`INSERT INTO search_impressions (analytics_id, product_id, position) VALUES (${analyticsId}, ${p.productId}, ${p.position||0}) ON CONFLICT DO NOTHING`;
      }
    }
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false });
  }
});
module.exports = router;
