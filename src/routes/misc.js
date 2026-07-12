'use strict';
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, requireStaffOrAdmin } = require('../middleware/auth');
const { syncFromFina } = require('../services/fina');
const cache = require('../services/cache');
const prisma = new PrismaClient();

// ── DELIVERY ──────────────────────────────────────────────────────────────────
const deliveryRouter = express.Router();
const DEFAULT_ZONES = [
  { zone:'RUSTAVI',  fee:0,  freeFrom:150, enabled:true, estimatedDays:1 },
  { zone:'TBILISI',  fee:5,  freeFrom:150, enabled:true, estimatedDays:1 },
  { zone:'MTSKHETA', fee:7,  freeFrom:150, enabled:true, estimatedDays:2 },
  { zone:'OTHER',    fee:10, freeFrom:150, enabled:true, estimatedDays:3 },
];

deliveryRouter.get('/zones', async (req, res) => {
  try {
    const dbZones = await prisma.deliveryZoneConfig.findMany().catch(() => []);
    res.json(dbZones.length ? dbZones : DEFAULT_ZONES);
  } catch { res.json(DEFAULT_ZONES); }
});

deliveryRouter.post('/calculate', (req, res) => {
  const { zone = 'OTHER', subtotal = 0 } = req.body;
  const FREE = Number(process.env.FREE_DELIVERY_THRESHOLD) || 150;
  const fees = { RUSTAVI:0, TBILISI:5, MTSKHETA:7, GORI:8, KUTAISI:10, OTHER:10 };
  const fee = subtotal >= FREE ? 0 : (fees[zone] ?? 10);
  res.json({ fee, isFree: subtotal >= FREE, freeFrom: FREE });
});

deliveryRouter.put('/zones/:zone', authenticate, requireAdmin, async (req, res) => {
  const { zone } = req.params;
  const { fee, freeFrom, enabled, estimatedDays } = req.body;
  try {
    const updated = await prisma.deliveryZoneConfig.upsert({
      where: { zone },
      update: { fee: parseFloat(fee), freeFrom: parseFloat(freeFrom), enabled: Boolean(enabled), estimatedDays: parseInt(estimatedDays) },
      create: { zone, fee: parseFloat(fee)||0, freeFrom: parseFloat(freeFrom)||150, enabled: Boolean(enabled), estimatedDays: parseInt(estimatedDays)||1 },
    });
    res.json(updated);
  } catch(e) { res.json({ zone, fee, freeFrom, enabled, estimatedDays }); }
});

// ── ADMIN ─────────────────────────────────────────────────────────────────────
const adminRouter = express.Router();
adminRouter.use(authenticate, requireStaffOrAdmin);

adminRouter.get('/dashboard', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [totalOrders, todayOrders, pendingOrders, totalRevRaw, todayRevRaw,
           totalProducts, totalUsers, lowStock, recentOrders, statusGroups] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: today }}}),
      prisma.order.count({ where: { status: 'PENDING' }}),
      prisma.order.aggregate({ where: { paymentStatus:'PAID' }, _sum:{ total:true }}),
      prisma.order.aggregate({ where: { paymentStatus:'PAID', createdAt:{ gte:today }}, _sum:{ total:true }}),
      prisma.product.count({ where: { isActive:true }}),
      prisma.user.count(),
      prisma.product.count({ where: { stock:{ lte:5 }, isActive:true }}),
      prisma.order.findMany({ take:10, orderBy:{ createdAt:'desc' },
        include:{ user:{ select:{ name:true, email:true }}, items:true }}),
      prisma.order.groupBy({ by:['status'], _count:{ id:true }}),
    ]);
    const ordersByStatus = Object.fromEntries(statusGroups.map(r => [r.status, r._count.id]));

    // Kibilov-specific stats
    const [
      catalogStats,
      totalWithOem,
      totalCrossRefs,
      _crossRefCount,
      searchTotal, searchFailed,
      garageCount, compatCount, reminderCount
    ] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*) as total, SUM(stock) as total_stock, ROUND(SUM(price * stock), 2) as total_value, ROUND(AVG(price::numeric), 2) as avg_price FROM products WHERE "isActive" = true`.then(r => ({total:Number(r[0]?.total||0),total_stock:Number(r[0]?.total_stock||0),total_value:Number(r[0]?.total_value||0),avg_price:Number(r[0]?.avg_price||0)})),
      prisma.$queryRaw`SELECT COUNT(*) as total, SUM(stock) as total_stock, ROUND(SUM(price * stock), 2) as total_value, ROUND(AVG(price::numeric), 2) as avg_price FROM products WHERE "isActive" = true`.then(r => ({total:Number(r[0]?.total||0),total_stock:Number(r[0]?.total_stock||0),total_value:Number(r[0]?.total_value||0),avg_price:Number(r[0]?.avg_price||0)})),
      prisma.product.count({ where: { alternativeSearchKeys: { isEmpty: false } } }),
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM cross_reference`.then(r => Number(r[0]?.cnt || 0)),
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM search_analytics`.then(r => Number(r[0]?.cnt || 0)).catch(() => 0),
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM search_analytics WHERE "resultCount" = 0`.then(r => Number(r[0]?.cnt || 0)).catch(() => 0),
      prisma.userVehicle.count().catch(() => 0),
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM compatibility_cache`.then(r => Number(r[0]?.cnt || 0)).catch(() => 0),
      prisma.maintenanceReminder.count().catch(() => 0),
    ]);

    const successRate = searchTotal > 0 ? Math.round((searchTotal - searchFailed) / searchTotal * 100) : 0;

    // Top searches
    const topSearches = await prisma.$queryRaw`
      SELECT query, COUNT(*) as cnt FROM search_knowledge
      GROUP BY query ORDER BY cnt DESC LIMIT 5
    `.catch(() => []);

    res.json({
      totalOrders, todayOrders, pendingOrders,
      totalRevenue: Number(totalRevRaw._sum.total)||0,
      todayRevenue: Number(todayRevRaw._sum.total)||0,
      totalProducts, totalUsers, lowStock, recentOrders, ordersByStatus,
      catalogStats: {
        total: Number(catalogStats?.total || 0),
        totalStock: Number(catalogStats?.total_stock || 0),
        totalValue: Number(catalogStats?.total_value || 0),
        avgPrice: Number(catalogStats?.avg_price || 0),
      },
      catalogStats: {
        total: Number(catalogStats?.total || 0),
        totalStock: Number(catalogStats?.total_stock || 0),
        totalValue: Number(catalogStats?.total_value || 0),
        avgPrice: Number(catalogStats?.avg_price || 0),
      },
      oemCoverage: {
        total: totalProducts,
        withOem: totalWithOem,
        withoutOem: totalProducts - totalWithOem,
        crossRefs: totalCrossRefs
      },
      searchStats: {
        total: searchTotal,
        failed: searchFailed,
        aiSearches: 0,
        successRate,
        topSearches: topSearches.map(r => ({ query: r.query, cnt: Number(r.cnt) }))
      },
      vehicleStats: {
        garages: garageCount,
        compatibilityChecks: compatCount,
        topVehicles: []
      },
      maintenanceReminders: reminderCount,
      systemHealth: {
        backend: true, db: true, autodoc: true, telegram: true
      }
    });
  } catch(e) { console.error('[misc.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

adminRouter.get('/users', async (req, res) => {
  try {
    const { page=1, limit=20, search } = req.query;
    const where = search ? { OR:[
      { name:{ contains:search, mode:'insensitive' }},
      { email:{ contains:search, mode:'insensitive' }},
      { phone:{ contains:String(search) }},
    ]} : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, skip:(parseInt(page)-1)*parseInt(limit), take:parseInt(limit),
        orderBy:{ createdAt:'desc' },
        select:{ id:true, name:true, email:true, phone:true, role:true, isActive:true, createdAt:true,
          isPartnerGarage:true, garageCity:true, b2bTier:true,
          _count:{ select:{ orders:true }},
          orders:{ select:{ total:true }, where:{ paymentStatus:'PAID' }} }}),
      prisma.user.count({ where }),
    ]);
    const enriched = users.map(u => ({
      ...u, totalSpent: u.orders.reduce((s, o) => s + Number(o.total), 0), orders: undefined
    }));
    res.json({ users: enriched, total });
  } catch(e) { console.error('[misc.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

adminRouter.patch('/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const u = await prisma.user.update({ where:{ id:req.params.id }, data:{ role:req.body.role }});
    res.json(u);
  } catch(e) { console.error('[misc.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});
adminRouter.patch('/users/:id/garage', async (req, res) => {
  try {
    const { isPartnerGarage, garageCity } = req.body;
    const data = {};
    if (isPartnerGarage !== undefined) data.isPartnerGarage = !!isPartnerGarage;
    if (garageCity !== undefined) data.garageCity = garageCity || null;
    const u = await prisma.user.update({ where:{ id:req.params.id }, data });
    res.json(u);
  } catch(e) { console.error('[misc.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

adminRouter.patch('/products/:id/stock', async (req, res) => {
  try {
    const p = await prisma.product.update({ where:{ id:req.params.id }, data:{ stock:parseInt(req.body.stock) }});
    res.json(p);
  } catch(e) { console.error('[misc.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

adminRouter.get('/orders', async (req, res) => {
  try {
    const { page=1, limit=20, status, search } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) where.OR = [
      { user:{ name:{ contains:search, mode:'insensitive' }}},
      { user:{ email:{ contains:search, mode:'insensitive' }}},
      { user:{ phone:{ contains:String(search) }}},
    ];
    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where, skip:(parseInt(page)-1)*parseInt(limit), take:parseInt(limit),
        orderBy:{ createdAt:'desc' },
        include:{ user:{ select:{ name:true, email:true, phone:true }},
          items:{ include:{ product:true }}, address:true }}),
      prisma.order.count({ where }),
    ]);
    res.json({ orders, total });
  } catch(e) { console.error('[misc.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// ── FINA ──────────────────────────────────────────────────────────────────────
const finaRouter = express.Router();
finaRouter.use(authenticate, requireAdmin);

finaRouter.post('/sync', async (req, res) => {
  try {
    const result = await syncFromFina();
    // stock განახლდა — search cache გავწმინდოთ
    await cache.flush('search:*');
    await cache.flush('compat:*');
    res.json({ synced: result.synced || 0, message: 'FINA sync დასრულდა, cache გაწმინდულია' });
  } catch(e) { console.error('[misc.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

finaRouter.get('/logs', async (req, res) => {
  try {
    const logs = await prisma.finaSyncLog.findMany({ orderBy:{ syncedAt:'desc' }, take:20 });
    res.json(logs);
  } catch { res.json([]); }
});


const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10485760 } });
adminRouter.post('/products/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file missing' });

    const { processFinaExcel } = require('../services/finaImportEngine');
    const markup = parseFloat(req.body.markup || '0') || 0;
    const { normalized, rejected, errors, reviewQueue } = await processFinaExcel(req.file.buffer, { markup });

    // bulk fetch existing SKUs
    const skus = normalized.map(r => r.sku);
    const existing = await prisma.product.findMany({
      where: { sku: { in: skus } },
      select: { id: true, sku: true, dataLocked: true }
    });
    const existingMap = new Map(existing.map(e => [e.sku, e]));

    // არსებული SKU → განახლება (არა დუბლიკატის შექმნა — ეს ადრე დაწერილი იყო,
    // მაგრამ toUpdate არასდროს ივსებოდა, ამიტომ ყოველი ხელახალი import ქმნიდა
    // ახალ დუბლიკატს ყოველი უკვე-არსებული SKU-სთვის)
    const toUpdate = [];
    const toCreate = [];
    for (const r of normalized) {
      if (existingMap.has(r.sku)) toUpdate.push(r);
      else toCreate.push(r);
    }

    // batch update — chunks of 100
    let updated = 0;
    const CHUNK = 100;

    // chunked update
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const chunk = toUpdate.slice(i, i + CHUNK);
      await prisma.$transaction(
        chunk.map(r => {
          const ex = existingMap.get(r.sku);
          // 🔒 თუ პროდუქტი ხელით არის შესწორებული (dataLocked), ბრენდსა
          // და OEM/ბარკოდს აღარ ვეხებით — მხოლოდ ფასი/მარაგი განახლდება
          return prisma.product.update({
            where: { id: ex.id },
            data: {
              nameKa: r.nameKa, price: r.price, stock: r.stock,
              ...(ex.dataLocked ? {} : {
                brand: r.brand !== 'Generic' ? r.brand : undefined,
                ...(r.oemCodes?.length ? { oemCodes: r.oemCodes, alternativeSearchKeys: r.alternativeSearchKeys } : {}),
                ...(r.barcode ? { barcode: r.barcode } : {})
              })
            }
          });
        })
      );
      updated += chunk.length;
    }

    // create import batch record (always — even if only updates)
    const totalCount = toCreate.length + toUpdate.length;
    const rejectedReport = rejected.length ? JSON.stringify(rejected.map(r => ({
      sku: r.sku, nameKa: r.nameKa, oemCodes: r.oemCodes, crossCodes: r.crossCodes,
      confidence: r.confidence, method: r.method, reason: r.reason,
    }))) : null;
    const batchResult = await prisma.$queryRaw`
      INSERT INTO import_batches (filename, product_count, imported_by, rejected_report, rejected_count)
      VALUES (${req.file.originalname || 'excel_import'}, ${totalCount}, 'admin', ${rejectedReport}, ${rejected.length})
      RETURNING id
    `;
    const batchId = batchResult[0]?.id || null;

    // chunked create
    let added = 0;
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      const chunk = toCreate.slice(i, i + CHUNK);
      const result = await prisma.product.createMany({
        data: chunk.map(r => {
          const d = { ...r, isActive: true };
          if (!d.oemCodes) delete d.oemCodes;
          if (!d.alternativeSearchKeys) delete d.alternativeSearchKeys;
          delete d.import_batch_id;
          return d;
        }),
        skipDuplicates: true
      });
      added += result.count;
    }

    // batch_id განახლება
    if (batchId) {
      try {
        await prisma.$queryRawUnsafe('UPDATE products SET import_batch_id=$1 WHERE sku = ANY($2)', batchId, skus);
      } catch(e) { console.log('batch id skip:', e.message); }
    }
    // cache გავწმინდოთ
    try { if (cache && cache.flush) await cache.flush('search:*'); } catch(e) { console.log('cache flush skip'); }

    const autoMatched = normalized.filter(r => r.autodocCategoryId && !reviewQueue.find(q => q.sku === r.sku)).length;
    const reviewCount = reviewQueue.length;
    const unknown = normalized.filter(r => !r.autodocCategoryId).length;
    const accuracy = normalized.length > 0 ? Math.round((autoMatched / normalized.length) * 100) : 0;

    res.json({
      added, updated, errors,
      total: normalized.length + rejected.length + errors.length,
      batchId,
      rejected: rejected.length,
      rejectedReportUrl: (rejected.length && batchId) ? `/api/admin/import-batches/${batchId}/rejected-report` : null,
      report: {
        total: normalized.length,
        autoMatched,
        review: reviewCount,
        unknown,
        accuracy: accuracy + '%'
      },
      reviewQueue
    });
  } catch(e) { console.error('[misc.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

module.exports = { deliveryRouter, adminRouter, finaRouter };

// POST /api/admin/upload-image
const uploadImg = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5242880 } });
adminRouter.post('/upload-image', uploadImg.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'ფაილი არ არის' });
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'kibilov/products' },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(req.file.buffer);
    });
    res.json({ url: result.secure_url });
  } catch(e) { console.error('[misc.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// POST /api/admin/bulk-image-upload — ფოლდერით სურათების ატვირთვა, SKU-ს მიხედვით
// ავტომატური დაკავშირება პროდუქტთან. ფაილის სახელი = SKU (+ არჩევითი "_2","-3"
// და ა.შ. სუფიქსი მრავალი სურათისთვის). jer ზუსტ SKU-დამთხვევას ვცდით,
// რომ დეფისიანი SKU-ები (მაგ. L1063-900) არასწორად არ დაიჭრას.
const bulkImg = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5242880 } });
async function findProductForFilename(prisma, base) {
  let product = await prisma.product.findFirst({ where: { sku: { equals: base, mode: 'insensitive' } } });
  if (product) return product;
  const stripped = base.replace(/[_\-]\s?\d{1,2}$/, '');
  if (stripped !== base) {
    product = await prisma.product.findFirst({ where: { sku: { equals: stripped, mode: 'insensitive' } } });
    if (product) return product;
  }
  return null;
}
adminRouter.post('/bulk-image-upload', bulkImg.array('images', 500), async (req, res) => {
  try {
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'ფაილები არ არის' });
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // ჯერ თითოეულ ფაილს ვუკავშირებთ პროდუქტს (ან ვნიშნავთ, ვერ მოიძებნა)
    const byProduct = new Map(); // productId -> { product, files: [] }
    const unmatched = [];
    for (const file of req.files) {
      const base = file.originalname.replace(/\.[^.]+$/, '').trim();
      const product = await findProductForFilename(prisma, base);
      if (!product) { unmatched.push(file.originalname); continue; }
      if (!byProduct.has(product.id)) byProduct.set(product.id, { product, files: [] });
      byProduct.get(product.id).files.push(file);
    }

    const matched = [];
    const errors = [];
    for (const { product, files } of byProduct.values()) {
      const urls = [];
      for (const file of files) {
        try {
          const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({ folder: 'kibilov/products' }, (error, result) => error ? reject(error) : resolve(result));
            stream.end(file.buffer);
          });
          urls.push(result.secure_url);
        } catch (e) { errors.push(`${product.sku}: ${e.message}`); }
      }
      if (urls.length) {
        const existingImages = product.images || [];
        const newImages = [...existingImages, ...urls].slice(0, 5);
        await prisma.product.update({ where: { id: product.id }, data: { images: newImages } });
        matched.push({ sku: product.sku, nameKa: product.nameKa, count: urls.length });
      }
    }

    res.json({ success: true, matched, unmatched, errors, totalFiles: req.files.length });
  } catch (e) {
    console.error('[misc.js bulk-image-upload]', e);
    res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' });
  }
});

// POST /api/admin/fina-import
adminRouter.post('/fina-import', async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const fs = require('fs');
    const results = [];

    const files = [
      { path: '/tmp/tamazuka.xlsx', name: 'თამაზუკა' },
      { path: '/tmp/kakha.xlsx',    name: 'კახაბერი' },
    ];

    for (const file of files) {
      if (!fs.existsSync(file.path)) {
        results.push({ name: file.name, error: 'ფაილი არ მოიძებნა' });
        continue;
      }
      const wb = XLSX.readFile(file.path);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const all = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const hi = all.findIndex(r => r && r.includes('კოდი'));
      if (hi === -1) { results.push({ name: file.name, error: 'FINA ფორმატი არ არის' }); continue; }
      const h = all[hi];
      const si = h.indexOf('კოდი');
      const ni = h.indexOf('დასახელება');
      const sti = h.indexOf('საბოლოო ნაშთი');
      const pi = h.findIndex(x => x && String(x) === 'ერთეულის ფასი');
      // create batch record for this file
      const safeFilename = Buffer.from(uploaded.originalname || f.name, 'latin1').toString('utf-8');
      const batchRes = await prisma.$queryRaw`
        INSERT INTO import_batches (filename, product_count, imported_by)
        VALUES (${safeFilename}, 0, 'admin')
        RETURNING id
      `;
      const batchId = batchRes[0]?.id || null;
      let added = 0, updated = 0;
      for (let i = hi + 1; i < all.length; i++) {
        const r = all[i];
        if (!r || !r[si]) continue;
        const sku = String(r[si]).trim();
        const nameKa = String(r[ni]).trim();
        const price = parseFloat(r[pi] || 0);
        const stock = parseInt(r[sti] || 0);
        if (!sku || !nameKa) continue;
        const ex = await prisma.product.findFirst({ where: { sku } });
        const b2bPrice = price >= 500 ? parseFloat((price * 0.85).toFixed(2)) : parseFloat((price * 0.90).toFixed(2));
        if (ex) {
          await prisma.product.update({ where: { id: ex.id }, data: { nameKa, price, stock, b2bPrice } });
          await prisma.$queryRawUnsafe('UPDATE products SET import_batch_id=$1 WHERE id=$2', batchId, ex.id);
          updated++;
        } else {
          const created = await prisma.product.create({ data: { sku, nameKa, nameEn: nameKa, nameRu: nameKa, price, stock, b2bPrice, brand: 'Generic', isActive: true } });
          await prisma.$queryRawUnsafe('UPDATE products SET import_batch_id=$1 WHERE id=$2', batchId, created.id);
          added++;
        }
      }
      results.push({ name: file.name, added, updated });
    }
    res.json({ success: true, results });
  } catch(e) { console.error('[misc.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// POST /api/admin/fina-import-upload — 100%-Gate + ასინქრონული (Cloudflare 100წ timeout-ის გვერდის ავლით)
const uploadFina = multer({ storage: multer.memoryStorage(), limits: { fileSize: 104857600 } });

async function __finaNotifyTelegram(text) {
  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8905815997:AAEmJshz49xjpUqmFPryLGGXPSmB6XSiDW8';
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1867994078';
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
    });
  } catch (e) { console.error('[fina-import-upload telegram]', e.message); }
}

async function __runFinaImportBackground(fileInputs) {
  const { processFinaExcel } = require('../services/finaImportEngine');
  const results = [];
  for (const f of fileInputs) {
    if (!f.buffer) { results.push({ name: f.name, error: 'ფაილი არ აირჩიე' }); continue; }
    try {
      const { normalized, rejected, errors } = await processFinaExcel(f.buffer, { markup: 0 });
      if (!normalized.length && !rejected.length && errors.length) {
        results.push({ name: f.name, error: errors[0].error });
        continue;
      }
      const rejectedReport = rejected.length ? JSON.stringify(rejected.map(r => ({
        sku: r.sku, nameKa: r.nameKa, oemCodes: r.oemCodes, crossCodes: r.crossCodes,
        confidence: r.confidence, method: r.method, reason: r.reason,
      }))) : null;
      const batchRes = await prisma.$queryRaw`
        INSERT INTO import_batches (filename, product_count, imported_by, rejected_report, rejected_count)
        VALUES (${f.originalname}, ${normalized.length}, 'admin', ${rejectedReport}, ${rejected.length})
        RETURNING id
      `;
      const batchId = batchRes[0]?.id || null;
      let added = 0, updated = 0;
      for (const row of normalized) {
        const ex = await prisma.product.findFirst({ where: { sku: row.sku } });
        const price = row.price;
        const b2bPrice = price >= 500 ? parseFloat((price * 0.85).toFixed(2)) : parseFloat((price * 0.90).toFixed(2));
        // 🔒 თუ პროდუქტი ხელით არის შესწორებული (dataLocked), ბრენდსა და
        // OEM/ბარკოდს/კატეგორიას აღარ ვეხებით — მხოლოდ ფასი/მარაგი განახლდება
        const isLocked = ex?.dataLocked === true;
        const data = {
          nameKa: row.nameKa, nameEn: row.nameEn, nameRu: row.nameRu,
          price, stock: row.stock, b2bPrice,
          ...(isLocked ? {} : {
            brand: row.brand || 'Generic',
            autodocCategoryId: row.autodocCategoryId || null,
            categoryConfidence: row.categoryConfidence || null,
            categoryMethod: row.categoryMethod || null,
            ...(row.oemCodes?.length ? { oemCodes: row.oemCodes, alternativeSearchKeys: row.alternativeSearchKeys } : {}),
            ...(row.barcode ? { barcode: row.barcode } : {}),
          }),
        };
        if (ex) {
          await prisma.product.update({ where: { id: ex.id }, data });
          await prisma.$queryRawUnsafe('UPDATE products SET import_batch_id=$1 WHERE id=$2', batchId, ex.id);
          updated++;
        } else {
          const created = await prisma.product.create({ data: { sku: row.sku, isActive: true, ...data } });
          await prisma.$queryRawUnsafe('UPDATE products SET import_batch_id=$1 WHERE id=$2', batchId, created.id);
          added++;
        }
      }
      results.push({ name: f.name, added, updated, rejected: rejected.length, batchId });
    } catch (e) {
      console.error('[fina-import-upload background]', f.name, e);
      results.push({ name: f.name, error: e.message });
    }
  }
  const summary = results.map(r => r.error
    ? `❌ ${r.name}: ${r.error}`
    : `✅ ${r.name}: დამატებული ${r.added}, განახლებული ${r.updated}, rejected ${r.rejected}${r.batchId ? ` (batch #${r.batchId})` : ''}`
  ).join('\n');
  await __finaNotifyTelegram(`📂 <b>FINA Import დასრულდა</b>\n\n${summary}`);
  console.log('[fina-import-upload] background job finished:', JSON.stringify(results));
  return results;
}

let __finaImportJobStatus = { status: 'idle', startedAt: null, fileNames: [], result: null };

// GET /api/admin/fina-import-status — ცოცხალი სტატუსი frontend-ის polling-ისთვის
adminRouter.get('/fina-import-status', authenticate, requireAdmin, (req, res) => {
  const elapsedSec = __finaImportJobStatus.startedAt
    ? Math.round((Date.now() - __finaImportJobStatus.startedAt) / 1000) : null;
  res.json({ ...__finaImportJobStatus, elapsedSec });
});

adminRouter.post('/fina-import-upload', uploadFina.fields([{name:'tamazuka'},{name:'kakha'}]), async (req, res) => {
  try {
    const fileInputs = [
      { key: 'tamazuka', name: 'თამაზუკა' },
      { key: 'kakha',    name: 'კახაბერი' },
    ].map(f => {
      const uploaded = req.files?.[f.key]?.[0];
      return {
        name: f.name,
        buffer: uploaded ? uploaded.buffer : null,
        originalname: uploaded ? Buffer.from(uploaded.originalname || f.name, 'latin1').toString('utf-8') : f.name,
      };
    });

    if (!fileInputs.some(f => f.buffer)) {
      return res.json({ success: true, results: fileInputs.map(f => ({ name: f.name, error: 'ფაილი არ აირჩიე' })) });
    }

    if (__finaImportJobStatus.status === 'processing') {
      const elapsedSec = Math.round((Date.now() - __finaImportJobStatus.startedAt) / 1000);
      return res.json({
        success: false,
        status: 'already_processing',
        message: `Import უკვე მუშაობს (დაწყებული ${Math.floor(elapsedSec/60)} წუთის წინ) — მოითმინეთ დასრულებას, ხელახლა არ ატვირთოთ`,
        elapsedSec,
      });
    }

    __finaImportJobStatus = { status: 'processing', startedAt: Date.now(), fileNames: fileInputs.filter(f=>f.buffer).map(f=>f.originalname), result: null };

    res.json({
      success: true,
      status: 'processing',
      message: 'Import დაწყებულია ფონურ რეჟიმში — შედეგებს Telegram-ზე მიხვდებით რამდენიმე წუთში',
    });

    __runFinaImportBackground(fileInputs)
      .then(results => { __finaImportJobStatus = { status: 'idle', startedAt: null, fileNames: [], result: results }; })
      .catch(e => {
        console.error('[fina-import-upload background fatal]', e);
        __finaImportJobStatus = { status: 'idle', startedAt: null, fileNames: [], result: [{ error: e.message }] };
      });
  } catch(e) { console.error('[misc.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// POST /api/misc/price-request
deliveryRouter.post('/price-request', async (req, res) => {
  const { name, phone, product, productId, sku } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8905815997:AAEmJshz49xjpUqmFPryLGGXPSmB6XSiDW8';
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1867994078';
    const text = `💰 ფასის მოთხოვნა\n\n👤 სახელი: ${name || '—'}\n📞 ტელეფონი: ${phone}\n🔩 ნაწილი: ${product || '—'}\n🔗 ${productId ? 'https://kibilov.ge/products/' + productId : '—'}\n📋 SKU: ${sku || '—'}`;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
    });
    res.json({ ok: true });
  } catch(e) { console.error('[misc.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

adminRouter.get('/categories-export', async (req, res) => {
  try {
    const { generate } = require('../services/gen_template');
    const buf = await generate(res);
    res.setHeader('Content-Disposition', 'attachment; filename=kibilov_import.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch(e) { console.error('[misc.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});
