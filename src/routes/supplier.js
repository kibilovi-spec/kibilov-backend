'use strict';
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { calcPrices } = require('../services/pricing');
const multer = require('multer');
const XLSX = require('xlsx');
const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/supplier/register
router.post('/register', async (req, res) => {
  try {
    const { companyName, contactName, phone, address, taxId, description, email, password } = req.body;
    if (!companyName || !contactName || !phone) return res.status(400).json({ success: false, message: 'შეავსეთ სავალდებულო ველები' });
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email და პაროლი სავალდებულოა' });
    const bcrypt = require('bcryptjs');
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ success: false, message: 'ეს Email უკვე გამოყენებულია' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name: contactName, phone, role: 'USER' }
    });
    const supplier = await prisma.supplier.create({
      data: { userId: user.id, companyName, contactName, phone, address: address||'', taxId: taxId||'', bankAccount: '', status: 'PENDING' }
    });
    try {
      const { notifyNewSupplier } = require('../services/notification');
      await notifyNewSupplier(supplier, user);
    } catch(e) {}
    res.json({ success: true, data: supplier });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/supplier/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success: false, message: 'მომწოდებელი არ მოიძებნა' });
    res.json({ success: true, data: supplier });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/supplier/listings
router.get('/listings', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success: false });
    const listings = await prisma.productListing.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: listings });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/supplier/payouts
router.get('/payouts', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success: false });
    const payouts = await prisma.supplierPayout.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: payouts });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/supplier/upload — Excel ატვირთვა
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(403).json({ success: false, message: 'მომწოდებელი არ ხარ' });
    if (!req.file) return res.status(400).json({ success: false, message: 'ფაილი არ არის' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

    let added = 0, updated = 0, skipped = 0;

    for (const row of rows) {
      const nameKa = row['სახელი'] || row['nameKa'] || row['name'];
      const sku    = row['კოდი']   || row['sku']    || row['code'];
      const brand  = row['ბრენდი'] || row['brand'];
      const price  = parseFloat(row['ფასი'] || row['price'] || 0);
      const stock  = parseInt(row['ნაშთი']  || row['stock'] || 0);

      if (!nameKa || !sku || !price) { skipped++; continue; }

      const { price: retailPrice, b2bPrice } = calcPrices(price);

      const existing = await prisma.productListing.findFirst({
        where: { supplierId: supplier.id, sku }
      });

      if (existing) {
        await prisma.productListing.update({
          where: { id: existing.id },
          data: { nameKa, brand: brand||'', price, stock, status: 'PENDING' }
        });
        updated++;
      } else {
        await prisma.productListing.create({
          data: { supplierId: supplier.id, nameKa, nameEn: nameKa, sku, brand: brand||'', price, stock, status: 'PENDING' }
        });
        added++;
      }
    }

    res.json({ success: true, added, updated, skipped });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

// ── Admin Routes ──────────────────────────────────────────────────────────────
const { requireAdmin } = require('../middleware/auth');

// GET /api/supplier/admin/all
router.get('/admin/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: { user: { select: { name: true, email: true } }, _count: { select: { listings: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: suppliers });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/supplier/admin/listings
router.get('/admin/listings', authenticate, requireAdmin, async (req, res) => {
  try {
    const listings = await prisma.productListing.findMany({
      include: { supplier: { select: { companyName: true, id: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: listings });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/supplier/admin/:id/status
router.patch('/admin/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, commission } = req.body;
    const data = { status };
    if (commission) data.commission = parseFloat(commission);
    const s = await prisma.supplier.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: s });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/supplier/admin/listings/:id/status
router.patch('/admin/listings/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const l = await prisma.productListing.update({ where: { id: req.params.id }, data: { status } });
    res.json({ success: true, data: l });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/supplier/payout-request — გამოტანის მოთხოვნა
router.post('/payout-request', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success: false, message: 'მომწოდებელი არ მოიძებნა' });
    if (supplier.balance <= 0) return res.status(400).json({ success: false, message: 'ბალანსი ნულია' });

    const payout = await prisma.supplierPayout.create({
      data: {
        supplierId: supplier.id,
        amount: supplier.balance,
        status: 'PENDING',
        note: `მოთხოვნა: ${new Date().toLocaleDateString('ka-GE')}`,
      }
    });
    // ბალანსი ნულდება
    await prisma.supplier.update({ where: { id: supplier.id }, data: { balance: 0 } });

    // Admin-ს ეცნობება
    try {
      const { sendTelegram } = require('../services/notification');
      await sendTelegram(`💰 <b>Payout მოთხოვნა</b>\n${supplier.companyName}\nთანხა: ${supplier.balance}₾`);
    } catch(e) {}

    res.json({ success: true, data: payout });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/supplier/admin/payouts — ყველა payout (admin)
router.get('/admin/payouts', authenticate, requireAdmin, async (req, res) => {
  try {
    const payouts = await prisma.supplierPayout.findMany({
      include: { supplier: { select: { companyName: true, bankAccount: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: payouts });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/supplier/admin/payouts/:id — გადახდა
router.patch('/admin/payouts/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, note } = req.body;
    const p = await prisma.supplierPayout.update({
      where: { id: req.params.id },
      data: { status, note }
    });
    res.json({ success: true, data: p });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/supplier/payout-request
router.post('/payout-request', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success: false, message: 'მომწოდებელი არ მოიძებნა' });
    if (supplier.balance <= 0) return res.status(400).json({ success: false, message: 'ბალანსი ნულია' });
    const payout = await prisma.supplierPayout.create({
      data: { supplierId: supplier.id, amount: supplier.balance, status: 'PENDING', note: 'მოთხოვნა' }
    });
    await prisma.supplier.update({ where: { id: supplier.id }, data: { balance: 0 } });
    res.json({ success: true, data: payout });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/supplier/admin/payouts
router.get('/admin/payouts', authenticate, requireAdmin, async (req, res) => {
  try {
    const payouts = await prisma.supplierPayout.findMany({
      include: { supplier: { select: { companyName: true, bankAccount: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: payouts });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/supplier/admin/payouts/:id
router.patch('/admin/payouts/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, note } = req.body;
    const p = await prisma.supplierPayout.update({ where: { id: req.params.id }, data: { status, note } });
    res.json({ success: true, data: p });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
