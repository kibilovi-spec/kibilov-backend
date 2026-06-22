'use strict';
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate, requireAdmin);

// AuditLog helper
async function auditLog(userId, action, target, newValue, req) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      target:    target || null,
      newValue:  newValue || null,
      ip:        req.ip || null,
      userAgent: req.headers['user-agent'] || null,
    }
  }).catch(() => {});
}

// ── Dashboard ─────────────────────────────────────────────────────────────
router.get('/dashboard2', async (req, res) => {
  try {
    const [retail, b2b, pendingB2b, workQueue, zeroResults] =
      await prisma.$transaction([
        prisma.order.count({ where: { user: { role: 'USER' }, status: { not: 'CANCELLED' } } }),
        prisma.order.count({ where: { user: { role: 'ADMIN' }, status: { not: 'CANCELLED' } } }),
        prisma.user.count({ where: { b2bStatus: 'PENDING' } }),
        prisma.product.count({ where: { syncStatus: { not: 'OK' } } }),
        prisma.searchLog.count({ where: { resultCount: 0 } }),
      ]);
    res.json({ metrics: { retail, b2b, pendingB2b }, alerts: { workQueue, zeroResults } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Work Queue ────────────────────────────────────────────────────────────
router.get('/work-queue', async (req, res) => {
  try {
    const [queue, zeroResults] = await Promise.all([
      prisma.product.findMany({
        where: { syncStatus: { not: 'OK' } },
        orderBy: [{ syncStatus: 'asc' }, { syncedAt: 'desc' }],
        take: 100,
        select: {
          id: true, sku: true, nameKa: true,
          syncStatus: true, syncNote: true, syncedAt: true, brand: true,
        },
      }),
      prisma.searchLog.findMany({
        where: { resultCount: 0 },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { query: true, makeId: true, modelId: true, year: true, createdAt: true },
      }),
    ]);
    res.json({ queue, zeroResults });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/work-queue/:id', async (req, res) => {
  try {
    const { syncStatus } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { syncStatus, syncedAt: new Date() },
    });
    await auditLog(req.user.id, 'PRODUCT_SYNC_STATUS_UPDATE', req.params.id, { syncStatus }, req);
    res.json(product);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Price Change Panel ────────────────────────────────────────────────────
router.get('/price-changes', async (req, res) => {
  try {
    const held = await prisma.priceChangeLog.findMany({
      where: { approved: false, autoApproved: false },
      include: {
        product: { select: { nameKa: true, sku: true, brand: true } }
      },
      orderBy: { syncedAt: 'desc' },
    });
    // Group by brand
    const grouped = {};
    for (const item of held) {
      const brand = item.product.brand || 'Unknown';
      if (!grouped[brand]) grouped[brand] = [];
      grouped[brand].push(item);
    }
    res.json({ grouped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/price-changes/bulk', async (req, res) => {
  try {
    const { brand, action } = req.body;
    await prisma.priceChangeLog.updateMany({
      where: { approved: false, product: { brand } },
      data: { approved: action === 'APPROVE', approvedBy: req.user.id },
    });
    if (action === 'APPROVE') {
      const changes = await prisma.priceChangeLog.findMany({
        where: { approved: true, product: { brand } },
        select: { productId: true, newPrice: true },
      });
      await prisma.$transaction(
        changes.map(c => prisma.product.update({
          where: { id: c.productId },
          data: { price: c.newPrice },
        }))
      );
    }
    await auditLog(req.user.id, `PRICE_HOLD_${action}`, brand, { brand, action }, req);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── B2B Requests ──────────────────────────────────────────────────────────
router.get('/b2b/requests', async (req, res) => {
  try {
    const pending = await prisma.user.findMany({
      where: { b2bStatus: 'PENDING' },
      orderBy: { b2bAppliedAt: 'asc' },
      take: 50,
      select: {
        id: true, name: true, email: true, phone: true,
        b2bAppliedAt: true, b2bTier: true,
      },
    });
    const now = Date.now();
    res.json({
      requests: pending.map(u => ({
        ...u,
        slaHours: Math.floor((now - new Date(u.b2bAppliedAt).getTime()) / 36e5),
        slaStatus:
          now - new Date(u.b2bAppliedAt).getTime() > 72 * 36e5 ? 'SENIOR_72H' :
          now - new Date(u.b2bAppliedAt).getTime() > 48 * 36e5 ? 'ESCALATE_48H' :
          now - new Date(u.b2bAppliedAt).getTime() > 24 * 36e5 ? 'REMINDER_24H' :
          'OK',
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/b2b/requests/:id', async (req, res) => {
  try {
    const { action, tier } = req.body;
    const data = action === 'APPROVE'
      ? { b2bStatus: 'APPROVED', b2bTier: tier || 'STANDARD', role: 'USER' }
      : { b2bStatus: 'REJECTED' };
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    await auditLog(req.user.id, `B2B_${action}`, req.params.id, { action, tier }, req);
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AuditLog ──────────────────────────────────────────────────────────────
router.get('/audit-logs', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });
    res.json(logs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Partner Garage ────────────────────────────────────────────────────────
router.patch('/garages/:id', async (req, res) => {
  try {
    const { isPartnerGarage, garageCity } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isPartnerGarage, garageCity },
    });
    await auditLog(req.user.id, 'GARAGE_PARTNER_TOGGLE', req.params.id, { isPartnerGarage, garageCity }, req);
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// GET /api/admin/search-analytics — search_knowledge table
router.get('/search-analytics', async (req, res) => {
  try {
    const popular = await prisma.$queryRaw`
      SELECT
        query,
        normalized,
        category_id,
        COUNT(*) as search_count,
        SUM(result_count) as total_results,
        AVG(result_count) as avg_results,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count,
        MAX(created_at) as last_searched
      FROM search_knowledge
      GROUP BY query, normalized, category_id
      ORDER BY search_count DESC
      LIMIT 50
    `;

    const notFound = await prisma.$queryRaw`
      SELECT
        query,
        normalized,
        COUNT(*) as search_count
      FROM search_knowledge
      WHERE success = false
      GROUP BY query, normalized
      ORDER BY search_count DESC
      LIMIT 20
    `;

    const stats = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total_searches,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
        ROUND(AVG(CASE WHEN success THEN 100 ELSE 0 END), 1) as success_rate,
        COUNT(DISTINCT DATE(created_at)) as active_days
      FROM search_knowledge
    `;

    const daily = await prisma.$queryRaw`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as searches,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful
      FROM search_knowledge
      WHERE created_at > NOW() - INTERVAL '14 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    res.json({
      popular: popular.map(p => ({...p, search_count: Number(p.search_count), success_count: Number(p.success_count), total_results: Number(p.total_results)})),
      notFound: notFound.map(p => ({...p, search_count: Number(p.search_count)})),
      stats: stats[0] ? {...stats[0], total_searches: Number(stats[0].total_searches), successful: Number(stats[0].successful)} : {},
      daily: daily.map(d => ({...d, searches: Number(d.searches), successful: Number(d.successful)}))
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});


// ── OEM Gap Dashboard ────────────────────────────────────────────────────────
router.get('/oem-gaps', async (req, res) => {
  try {
    const [missingOem, missingCross, byCategory, topMissing] = await Promise.all([
      prisma.product.count({ where: { oemCodes: { isEmpty: true } } }),
      prisma.product.count({ where: { alternativeSearchKeys: { isEmpty: true } } }),
      prisma.$queryRaw`
        SELECT c."nameKa" as category, COUNT(p.id) as total,
          SUM(CASE WHEN array_length(p."oemCodes", 1) IS NULL OR array_length(p."oemCodes", 1) = 0 THEN 1 ELSE 0 END) as missing_oem
        FROM products p
        LEFT JOIN categories c ON p."categoryId" = c.id
        WHERE p."isActive" = true
        GROUP BY c."nameKa" ORDER BY missing_oem DESC LIMIT 10
      `,
      prisma.product.findMany({
        where: { oemCodes: { isEmpty: true }, isActive: true },
        select: { id: true, nameKa: true, brand: true, sku: true },
        take: 20, orderBy: { createdAt: 'desc' }
      })
    ]);
    res.json({
      missingOem, missingCross,
      total: await prisma.product.count({ where: { isActive: true } }),
      byCategory: byCategory.map(r => ({ ...r, total: Number(r.total), missing_oem: Number(r.missing_oem) })),
      topMissing
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Vehicle Coverage Dashboard ───────────────────────────────────────────────
router.get('/vehicle-coverage', async (req, res) => {
  try {
    const topVehicles = await prisma.$queryRaw`
      SELECT vc.manufacturer, vc.model, COUNT(vo.id) as parts_count
      FROM vehicle_oem vo
      JOIN vehicle_cache vc ON vc.vehicle_id = vo.vehicle_id
      WHERE vc.manufacturer IS NOT NULL
      GROUP BY vc.manufacturer, vc.model
      ORDER BY parts_count DESC LIMIT 20
    `;
    const garageTop = await prisma.$queryRaw`
      SELECT make, model, COUNT(*) as garage_count
      FROM user_vehicles
      GROUP BY make, model
      ORDER BY garage_count DESC LIMIT 10
    `;
    const vinSearches = await prisma.$queryRaw`
      SELECT manufacturer as manufacturer, COUNT(*) as searches
      FROM vehicle_cache
      WHERE manufacturer IS NOT NULL AND manufacturer != ''
      GROUP BY manufacturer
      ORDER BY searches DESC LIMIT 10
    `;
    res.json({
      topVehicles: topVehicles.map(r => ({...r, parts_count: Number(r.parts_count)})),
      garageTop: garageTop.map(r => ({...r, garage_count: Number(r.garage_count)})),
      vinSearches: vinSearches.map(r => ({...r, searches: Number(r.searches)})),
      totalVehicles: await prisma.$queryRaw`SELECT COUNT(DISTINCT vehicle_id) as cnt FROM vehicle_oem`.then(r => Number(r[0]?.cnt || 0))
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Search Failures Panel ────────────────────────────────────────────────────
router.get('/search-failures', async (req, res) => {
  try {
    const failures = await prisma.$queryRaw`
      SELECT query, normalized, COUNT(*) as cnt,
        MAX(created_at) as last_searched
      FROM search_knowledge
      WHERE success = false
      GROUP BY query, normalized
      ORDER BY cnt DESC LIMIT 30
    `;
    const successRate = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
        ROUND(AVG(CASE WHEN success THEN 100 ELSE 0 END), 1) as rate
      FROM search_knowledge
    `;
    const trending = await prisma.$queryRaw`
      SELECT query, COUNT(*) as cnt
      FROM search_knowledge
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY query ORDER BY cnt DESC LIMIT 10
    `;
    res.json({
      failures: failures.map(r => ({...r, cnt: Number(r.cnt)})),
      successRate: successRate[0] ? {
        total: Number(successRate[0].total),
        successful: Number(successRate[0].successful),
        rate: Number(successRate[0].rate)
      } : {},
      trending: trending.map(r => ({...r, cnt: Number(r.cnt)}))
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Inventory Intelligence ───────────────────────────────────────────────────
router.get('/inventory', async (req, res) => {
  try {
    const [slowMovers, fastMovers, stockRisk, overstock, byBrand] = await Promise.all([
      // slow movers — მარაგი > 10, ფასი < საშუალო
      prisma.product.findMany({
        where: { stock: { gt: 10 }, isActive: true },
        orderBy: { stock: 'desc' },
        take: 20,
        select: { id: true, nameKa: true, brand: true, sku: true, stock: true, price: true }
      }),
      // fast movers — ბოლოვდება (stock 1-5)
      prisma.product.findMany({
        where: { stock: { gte: 1, lte: 5 }, isActive: true },
        orderBy: { stock: 'asc' },
        take: 20,
        select: { id: true, nameKa: true, brand: true, sku: true, stock: true, price: true }
      }),
      // stock risk — stock = 0
      prisma.product.count({ where: { stock: 0, isActive: true } }),
      // overstock — stock > 50
      prisma.product.count({ where: { stock: { gt: 50 }, isActive: true } }),
      // by brand
      prisma.$queryRaw`
        SELECT brand,
          COUNT(*) as total,
          SUM(stock) as total_stock,
          ROUND(SUM(price * stock), 0) as total_value
        FROM products WHERE "isActive" = true
        GROUP BY brand ORDER BY total_value DESC LIMIT 15
      `
    ]);
    const stats = await prisma.$queryRaw`
      SELECT
        SUM(stock) as total_stock,
        ROUND(SUM(price * stock), 0) as total_value,
        COUNT(*) FILTER (WHERE stock = 0) as out_of_stock,
        COUNT(*) FILTER (WHERE stock > 0) as in_stock
      FROM products WHERE "isActive" = true
    `;
    res.json({
      slowMovers, fastMovers, stockRisk, overstock,
      byBrand: byBrand.map(r => ({...r, total: Number(r.total), total_stock: Number(r.total_stock), total_value: Number(r.total_value)})),
      stats: stats[0] ? {
        totalStock: Number(stats[0].total_stock),
        totalValue: Number(stats[0].total_value),
        outOfStock: Number(stats[0].out_of_stock),
        inStock: Number(stats[0].in_stock)
      } : {}
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// ── Conversion Funnel ────────────────────────────────────────────────────────
router.get('/funnel', async (req, res) => {
  try {
    const [totalUsers, usersWithOrders, totalOrders, paidOrders,
           totalCartItems, cartUsers] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.user.count({ where: { role: 'USER', orders: { some: {} } } }),
      prisma.order.count(),
      prisma.order.count({ where: { paymentStatus: 'PAID' } }),
      prisma.cartItem.count(),
      prisma.cart.count({ where: { items: { some: {} } } }),
    ]);
    const searches = await prisma.$queryRaw`
      SELECT COUNT(*) as total, SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful
      FROM search_knowledge
    `.catch(() => [{ total: 0, successful: 0 }]);

    const totalSearches = Number(searches[0]?.total || 0);
    const convRate = totalUsers > 0 ? ((paidOrders / totalUsers) * 100).toFixed(1) : 0;

    res.json({
      funnel: [
        { stage: 'მომხმარებლები', value: totalUsers, icon: '👥' },
        { stage: 'ძებნა', value: totalSearches, icon: '🔍' },
        { stage: 'კალათა', value: cartUsers, icon: '🛒' },
        { stage: 'შეკვეთა', value: totalOrders, icon: '📦' },
        { stage: 'გადახდა', value: paidOrders, icon: '💰' },
      ],
      convRate,
      cartAbandon: cartUsers > 0 ? (((cartUsers - totalOrders) / cartUsers) * 100).toFixed(1) : 0,
      orderConv: totalUsers > 0 ? ((totalOrders / totalUsers) * 100).toFixed(1) : 0,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── System Observability ──────────────────────────────────────────────────────
router.get('/system', async (req, res) => {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - start;

    const redisStart = Date.now();
    let redisLatency = null;
    let redisKeys = 0;
    try {
      const Redis = require('ioredis');
      const r = new Redis({ host: '127.0.0.1', port: 6379, lazyConnect: true });
      await r.ping();
      redisLatency = Date.now() - redisStart;
      redisKeys = await r.dbsize();
      await r.disconnect();
    } catch(e) {}

    const mem = process.memoryUsage();
    res.json({
      db: { latency: dbLatency, status: dbLatency < 100 ? 'ok' : 'slow' },
      redis: { latency: redisLatency, keys: redisKeys, status: redisLatency !== null ? 'ok' : 'down' },
      process: {
        uptime: Math.round(process.uptime()),
        memory: Math.round(mem.heapUsed / 1024 / 1024),
        memoryTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      env: process.env.NODE_ENV,
      ts: new Date().toISOString(),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Demand Forecast ───────────────────────────────────────────────────────────
router.get('/forecast', async (req, res) => {
  try {
    const topSearched = await prisma.$queryRaw`
      SELECT query, normalized, COUNT(*) as cnt, category_id
      FROM search_knowledge
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY query, normalized, category_id
      ORDER BY cnt DESC LIMIT 20
    `;
    const lowStockHighDemand = await prisma.product.findMany({
      where: { stock: { lte: 5 }, isActive: true },
      orderBy: { stock: 'asc' },
      take: 15,
      select: { id: true, nameKa: true, brand: true, sku: true, stock: true, price: true }
    }).then(prods => prods.map(p => ({...p, search_count: 0})));
    const categoryDemand = await prisma.$queryRaw`
      SELECT category_id, COUNT(*) as searches
      FROM search_knowledge
      WHERE created_at > NOW() - INTERVAL '7 days'
      AND category_id IS NOT NULL
      GROUP BY category_id ORDER BY searches DESC LIMIT 10
    `;
    res.json({
      topSearched: topSearched.map(r => ({...r, cnt: Number(r.cnt)})),
      lowStockHighDemand: lowStockHighDemand.map(r => ({...r, search_count: Number(r.search_count)})),
      categoryDemand: categoryDemand.map(r => ({...r, searches: Number(r.searches)})),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Supplier Sync Status ──────────────────────────────────────────────────────
router.get('/sync', async (req, res) => {
  try {
    const logs = await prisma.finaSyncLog.findMany({
      orderBy: { syncedAt: 'desc' }, take: 10
    }).catch(() => []);
    const lastImport = await prisma.$queryRaw`
      SELECT MAX("createdAt") as last_import, COUNT(*) as total
      FROM products WHERE "isActive" = true
    `;
    res.json({
      finaLogs: logs,
      lastImport: lastImport[0] ? {
        date: lastImport[0].last_import,
        total: Number(lastImport[0].total)
      } : null,
      autodoc: { status: 'ok', plan: 'Pro', requests: '~20,000/month' },
      redis: { status: 'ok', caches: ['VIN', 'search', 'compatibility'] },
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/import-batches
router.get('/import-batches', requireAdmin, async (req, res) => {
  try {
    const batches = await prisma.$queryRaw`
      SELECT id, filename, imported_at, product_count, imported_by
      FROM import_batches ORDER BY imported_at DESC LIMIT 20
    `;
    const nullCount = await prisma.$queryRaw`
      SELECT COUNT(*) as cnt FROM products WHERE import_batch_id IS NULL AND "isActive"=true
    `;
    const result = batches.map(b => ({
      id: Number(b.id),
      filename: b.filename,
      importedAt: b.imported_at,
      productCount: Number(b.product_count || 0),
      importedBy: b.imported_by,
    }));
    if (Number(nullCount[0].cnt) > 0) {
      result.push({
        id: -1,
        filename: 'batch-ის გარეშე',
        importedAt: null,
        productCount: Number(nullCount[0].cnt),
        importedBy: 'system',
      });
    }
    res.json(result);
  } catch(e) { res.status(500).json({error: e.message}); }
});

// DELETE /api/admin/import-batches/:id
router.delete('/import-batches/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // products-ს import_batch_id null-ზე დაუყენებს ON DELETE SET NULL
    await prisma.$executeRaw`DELETE FROM import_batches WHERE id = ${id}`;
    res.json({ success: true });
  } catch(e) { res.status(500).json({error: e.message}); }
});


// GET /api/admin/data-quality — AI Data Quality Dashboard
router.get('/data-quality', requireAdmin, async (req, res) => {
  try {
    const [stats] = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE images IS NULL OR images = '{}') as no_image,
        COUNT(*) FILTER (WHERE autodoc_category_id IS NULL) as no_category,
        COUNT(*) FILTER (WHERE "oemCodes" IS NULL OR "oemCodes" = '{}') as no_oem,
        COUNT(*) FILTER (WHERE stock = 0) as out_of_stock,
        COUNT(*) FILTER (WHERE "isActive" = false) as inactive
      FROM products
    `;
    res.json({
      success: true,
      data: {
        total: Number(stats.total),
        noImage: Number(stats.no_image),
        noCategory: Number(stats.no_category),
        noOem: Number(stats.no_oem),
        outOfStock: Number(stats.out_of_stock),
        inactive: Number(stats.inactive),
        imagePercent: Math.round((1 - Number(stats.no_image) / Number(stats.total)) * 100),
        categoryPercent: Math.round((1 - Number(stats.no_category) / Number(stats.total)) * 100),
        oemPercent: Math.round((1 - Number(stats.no_oem) / Number(stats.total)) * 100),
      }
    });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;

// PATCH /api/admin/products/:id/images
router.patch('/products/:id/images', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const { imageUrl } = req.body;
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'პროდუქტი ვერ მოიძებნა' });
    const images = Array.isArray(product.images) ? product.images : [];
    if (!images.includes(imageUrl)) images.unshift(imageUrl);
    await prisma.product.update({
      where: { id: req.params.id },
      data: { images: images.slice(0, 5) },
    });
    res.json({ ok: true, images });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/admin/users/:id/b2b
router.patch('/users/:id/b2b', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const { b2bStatus, b2bDiscount, b2bTier } = req.body;
    await prisma.user.update({
      where: { id: req.params.id },
      data: { b2bStatus, b2bDiscount: parseInt(b2bDiscount)||0, b2bTier },
    });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Search Quality Dashboard ──────────────────────────────────────────────────
router.get('/search-quality', async (req, res) => {
  try {
    const [vehicleStats, oemStats, searchStats, topFailed, topSuccess] = await Promise.all([
      // Vehicle resolution
      prisma.$queryRaw`
        SELECT COUNT(*) as total,
          COUNT(CASE WHEN manufacturer IS NOT NULL AND manufacturer != '' THEN 1 END) as resolved
        FROM vehicle_cache
      `,
      // OEM coverage
      prisma.$queryRaw`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN array_length("oemCodes",1) > 0 THEN 1 END) as with_oem,
          COUNT(CASE WHEN array_length("alternativeSearchKeys",1) > 0 THEN 1 END) as with_keys
        FROM products WHERE "isActive" = true
      `,
      // Search success rate
      prisma.$queryRaw`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
          ROUND(AVG(CASE WHEN success THEN 100.0 ELSE 0 END), 1) as rate,
          ROUND(AVG(result_count), 1) as avg_results
        FROM search_knowledge
      `,
      // Top failed searches
      prisma.$queryRaw`
        SELECT query, COUNT(*) as cnt
        FROM search_knowledge WHERE success = false
        GROUP BY query ORDER BY cnt DESC LIMIT 10
      `,
      // Top successful
      prisma.$queryRaw`
        SELECT query, COUNT(*) as cnt, ROUND(AVG(result_count),1) as avg_results
        FROM search_knowledge WHERE success = true
        GROUP BY query ORDER BY cnt DESC LIMIT 10
      `
    ]);

    const v = vehicleStats[0];
    const o = oemStats[0];
    const s = searchStats[0];

    res.json({
      vehicleResolution: {
        total: Number(v?.total || 0),
        resolved: Number(v?.resolved || 0),
        rate: v?.total > 0 ? Math.round((Number(v.resolved) / Number(v.total)) * 100) : 0
      },
      oemCoverage: {
        total: Number(o?.total || 0),
        withOem: Number(o?.with_oem || 0),
        withKeys: Number(o?.with_keys || 0),
        rate: o?.total > 0 ? Math.round((Number(o.with_oem) / Number(o.total)) * 100) : 0
      },
      searchSuccess: {
        total: Number(s?.total || 0),
        successful: Number(s?.successful || 0),
        rate: Number(s?.rate || 0),
        avgResults: Number(s?.avg_results || 0)
      },
      topFailed: topFailed.map(r => ({...r, cnt: Number(r.cnt)})),
      topSuccess: topSuccess.map(r => ({...r, cnt: Number(r.cnt), avg_results: Number(r.avg_results)}))
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Daily Visitors endpoint ───────────────────────────────────────────────────
router.get('/daily-visitors', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const [todayVisitors, weekVisitors, todaySearches, totalOrders] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(DISTINCT session_id) as cnt FROM site_visits WHERE created_at >= ${today} AND created_at < ${tomorrow}`,
      prisma.$queryRaw`SELECT COUNT(DISTINCT session_id) as cnt FROM site_visits WHERE created_at >= ${new Date(Date.now()-7*86400000)}`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM search_knowledge WHERE created_at >= ${today}`,
      prisma.order.count({ where: { createdAt: { gte: today } } }),
    ]);
    // daily chart (last 7 days)
    const chart = await prisma.$queryRaw`
      SELECT DATE(created_at) as date, COUNT(DISTINCT session_id) as visitors
      FROM site_visits
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at) ORDER BY date ASC
    `;
    res.json({
      today: Number(todayVisitors[0]?.cnt || 0),
      week: Number(weekVisitors[0]?.cnt || 0),
      todaySearches: Number(todaySearches[0]?.cnt || 0),
      todayOrders: totalOrders,
      chart: chart.map(r => ({ date: r.date, visitors: Number(r.visitors) }))
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
