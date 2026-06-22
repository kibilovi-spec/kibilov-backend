'use strict';
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');
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
adminRouter.use(authenticate, requireAdmin);

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
      totalWithOem, totalCrossRefs,
      searchTotal, searchFailed,
      garageCount, compatCount, reminderCount
    ] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*) as total, SUM(stock) as total_stock, ROUND(SUM(price * stock), 2) as total_value, ROUND(AVG(price::numeric), 2) as avg_price FROM products WHERE "isActive" = true`.then(r => ({total:Number(r[0]?.total||0),total_stock:Number(r[0]?.total_stock||0),total_value:Number(r[0]?.total_value||0),avg_price:Number(r[0]?.avg_price||0)})),
      prisma.$queryRaw`SELECT COUNT(*) as total, SUM(stock) as total_stock, ROUND(SUM(price * stock), 2) as total_value, ROUND(AVG(price::numeric), 2) as avg_price FROM products WHERE "isActive" = true`.then(r => ({total:Number(r[0]?.total||0),total_stock:Number(r[0]?.total_stock||0),total_value:Number(r[0]?.total_value||0),avg_price:Number(r[0]?.avg_price||0)})),
      prisma.product.count({ where: { alternativeSearchKeys: { isEmpty: false } } }),
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM cross_reference`.then(r => Number(r[0]?.cnt || 0)),
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM search_knowledge`.then(r => Number(r[0]?.cnt || 0)).catch(() => 0),
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM search_knowledge WHERE success = false`.then(r => Number(r[0]?.cnt || 0)).catch(() => 0),
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
  } catch(e) { res.status(500).json({ error: e.message }); }
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
          _count:{ select:{ orders:true }},
          orders:{ select:{ total:true }, where:{ paymentStatus:'PAID' }} }}),
      prisma.user.count({ where }),
    ]);
    const enriched = users.map(u => ({
      ...u, totalSpent: u.orders.reduce((s, o) => s + Number(o.total), 0), orders: undefined
    }));
    res.json({ users: enriched, total });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

adminRouter.patch('/users/:id/role', async (req, res) => {
  try {
    const u = await prisma.user.update({ where:{ id:req.params.id }, data:{ role:req.body.role }});
    res.json(u);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

adminRouter.patch('/products/:id/stock', async (req, res) => {
  try {
    const p = await prisma.product.update({ where:{ id:req.params.id }, data:{ stock:parseInt(req.body.stock) }});
    res.json(p);
  } catch(e) { res.status(500).json({ error: e.message }); }
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
  } catch(e) { res.status(500).json({ error: e.message }); }
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
  } catch(e) { res.status(500).json({ error: e.message }); }
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
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    if (!rows.length) return res.status(400).json({ error: 'ფაილი ცარიელია' });

    const errors = [];

    // FINA format helpers
    const parseFina = (raw) => {
      // B სვეტი: "წინა კალოტკა MB W210 | GDB1205, TRW1015 |"
      const s = String(raw || '').trim();
      const oemMatch = s.match(/\|([^|]+)\|/);
      const oemCodes = oemMatch
        ? oemMatch[1].split(',').map(c => c.replace(/[\s\-\.]/g,'').toUpperCase()).filter(c => c.length >= 4)
        : [];
      const nameKa = s.split('|')[0].trim();
      return { nameKa, oemCodes };
    };

    const extractBrand = (nameKa) => {
      // მანქანის მარკა nameKa-დან
      const brands = ['MB','Mercedes','BMW','VW','Volkswagen','Toyota','Hyundai','Kia','Opel',
        'Ford','Nissan','Mazda','Honda','Subaru','Lexus','Audi','Renault','Peugeot',
        'Citroen','Skoda','Volvo','Mitsubishi','Chevrolet','Land Rover','Jeep'];
      const upper = nameKa.toUpperCase();
      for (const b of brands) {
        if (upper.includes(b.toUpperCase())) return b === 'MB' ? 'Mercedes-Benz' : b;
      }
      return 'Generic';
    };

    // normalize rows — FINA format support
    const normalized = rows.map((row, i) => {
      // FINA სვეტები: A=კოდი, B=დასახელება, C=რაოდ, D=ფასი
      const sku = String(row['A — კოდი'] || row.SKU || row.sku || row.A || '').trim();
      const rawB = String(row['B — დასახელება (OEM კოდებით)'] || row.nameKa || row.name || row.B || '').trim();

      if (!sku || !rawB) { errors.push({ row: i+2, sku, error: 'SKU ან დასახელება ცარიელია' }); return null; }

      const { nameKa, oemCodes } = parseFina(rawB);
      const markup = parseFloat(req.body.markup || '0') || 0;
      const rawPrice = isNaN(parseFloat(row['D — ფასი (₾)'] || row.price || row.D)) ? null : parseFloat(row['D — ფასი (₾)'] || row.price || row.D);
      let price = null;
      if (rawPrice !== null) {
        if (markup > 0) {
          // round to nearest integer (5.49 → 5, 5.51 → 6)
          price = Math.round(rawPrice * (1 + markup/100));
        } else {
          price = parseFloat(rawPrice.toFixed(2));
        }
      }
      const stock = isNaN(parseInt(row['C — რაოდენობა'] || row.stock || row.C)) ? 0 : parseInt(row['C — რაოდენობა'] || row.stock || row.C);

      if (price === null) { errors.push({ row: i+2, sku, error: 'ფასი არასწორია' }); return null; }

      // E სვეტი — ბრენდი (თუ მითითებულია, პრიორიტეტი აქვს extractBrand-ზე)
      const brandFromE = String(row['E — ბრენდი'] || row.brand || row.Brand || row.E || '').trim();
      const brand = brandFromE || extractBrand(nameKa);

      return {
        sku, nameKa,
        nameEn: nameKa,
        nameRu: nameKa,
        price, stock,
        brand,
        oemCodes: oemCodes.length ? oemCodes : undefined,
        alternativeSearchKeys: oemCodes.length ? oemCodes : undefined,
      };
    }).filter(Boolean);

    // bulk fetch existing SKUs
    const skus = normalized.map(r => r.sku);
    const existing = await prisma.product.findMany({
      where: { sku: { in: skus } },
      select: { id: true, sku: true }
    });
    const existingMap = new Map(existing.map(e => [e.sku, e.id]));

    // duplicate SKU → rename with brand suffix, save both
    const toUpdate = [];
    const toCreate = normalized.map(r => {
      if (existingMap.has(r.sku)) {
        const brandSuffix = (r.brand && r.brand !== 'Generic') ? r.brand.toUpperCase().replace(/\s+/g, '-') : '2';
        const newSku = r.sku + '-' + brandSuffix;
        return { ...r, sku: newSku, nameKa: r.nameKa + ' [დუბლ: ' + r.sku + ']' };
      }
      return r;
    });

    // batch update — chunks of 100
    let updated = 0;
    const CHUNK = 100;

    // chunked update
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const chunk = toUpdate.slice(i, i + CHUNK);
      await prisma.$transaction(
        chunk.map(r => prisma.product.update({
          where: { id: existingMap.get(r.sku) },
          data: {
            nameKa: r.nameKa, price: r.price, stock: r.stock,
            brand: r.brand !== 'Generic' ? r.brand : undefined,
            ...(r.oemCodes?.length ? { oemCodes: r.oemCodes, alternativeSearchKeys: r.alternativeSearchKeys } : {})
          }
        }))
      );
      updated += chunk.length;
    }

    // create import batch record (always — even if only updates)
    const totalCount = toCreate.length + toUpdate.length;
    const batchResult = await prisma.$queryRaw`
      INSERT INTO import_batches (filename, product_count, imported_by)
      VALUES (${req.file.originalname || 'excel_import'}, ${totalCount}, 'admin')
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

    res.json({ added, updated, errors, total: rows.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
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
  } catch(e) { res.status(500).json({ error: e.message }); }
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
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/fina-import-upload
const uploadFina = multer({ storage: multer.memoryStorage(), limits: { fileSize: 104857600 } });
adminRouter.post('/fina-import-upload', uploadFina.fields([{name:'tamazuka'},{name:'kakha'}]), async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const results = [];
    const files = [
      { key: 'tamazuka', name: 'თამაზუკა' },
      { key: 'kakha',    name: 'კახაბერი' },
    ];
    for (const f of files) {
      const uploaded = req.files?.[f.key]?.[0];
      if (!uploaded) { results.push({ name: f.name, error: 'ფაილი არ აირჩიე' }); continue; }
      const wb = XLSX.read(uploaded.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const all = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const hi = all.findIndex(r => r && r.includes('კოდი'));
      if (hi === -1) { results.push({ name: f.name, error: 'FINA ფორმატი არ არის' }); continue; }
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
      results.push({ name: f.name, added, updated });
    }
    res.json({ success: true, results });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
