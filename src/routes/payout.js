const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/payout/my - ჩემი payout ისტორია
router.get('/my', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(403).json({ error: 'მომწოდებელი არ ხართ' });
    const payouts = await prisma.supplierPayout.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: payouts, balance: supplier.balance });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// POST /api/payout/request - გატანის მოთხოვნა
router.post('/request', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(403).json({ error: 'მომწოდებელი არ ხართ' });
    if (supplier.balance < 10) return res.status(400).json({ error: 'მინიმალური გატანა 10₾' });
    const payout = await prisma.supplierPayout.create({
      data: { supplierId: supplier.id, amount: supplier.balance, status: 'PENDING', note: req.body.note || '' }
    });
    await prisma.supplier.update({ where: { id: supplier.id }, data: { balance: 0 } });
    res.json({ success: true, data: payout });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// ADMIN: GET /api/payout/admin/all
router.get('/admin/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const payouts = await prisma.supplierPayout.findMany({
      include: { supplier: { include: { user: { select: { email: true, name: true } } } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: payouts });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// ADMIN: PATCH /api/payout/admin/:id
router.patch('/admin/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const payout = await prisma.supplierPayout.update({
      where: { id: req.params.id },
      data: { status: req.body.status, note: req.body.note || undefined }
    });
    res.json({ success: true, data: payout });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
