'use strict';
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { syncFromFina } = require('../services/fina');
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
  const fees = { RUSTAVI:0, TBILISI:5, MTSKHETA:7, OTHER:10 };
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
    res.json({ totalOrders, todayOrders, pendingOrders,
      totalRevenue: Number(totalRevRaw._sum.total)||0,
      todayRevenue: Number(todayRevRaw._sum.total)||0,
      totalProducts, totalUsers, lowStock, recentOrders, ordersByStatus });
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
    res.json({ synced: result.synced || 0, message: 'FINA sync დასრულდა' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

finaRouter.get('/logs', async (req, res) => {
  try {
    const logs = await prisma.finaSyncLog.findMany({ orderBy:{ syncedAt:'desc' }, take:20 });
    res.json(logs);
  } catch { res.json([]); }
});

module.exports = { deliveryRouter, adminRouter, finaRouter };
