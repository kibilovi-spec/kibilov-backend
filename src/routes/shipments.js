'use strict';
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { dispatchCourier } = require('../services/dispatchService');
const router = express.Router();
const prisma = new PrismaClient();

// GET /api/shipments/mine — მომწოდებლის საკუთარი, ჯერ დაუდასტურებელი shipment-ები
router.get('/mine', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(404).json({ success: false, message: 'მომწოდებელი არ მოიძებნა' });

    const shipments = await prisma.shipment.findMany({
      where: { supplierId: supplier.id },
      include: { items: { include: { orderItem: true } }, order: { select: { orderNumber: true, customerName: true, customerPhone: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: shipments });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/shipments/:id/ready — მომწოდებელი ადასტურებს რომ ნაწილი მზადაა აღებისთვის
router.post('/:id/ready', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment არ მოიძებნა' });
    if (!supplier || shipment.supplierId !== supplier.id) {
      return res.status(403).json({ success: false, message: 'წვდომა აკრძალულია' });
    }
    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: { status: 'READY_FOR_PICKUP', readyAt: new Date() },
    });
    // კურიერის მოძებნის მცდელობა (ჯერ STUB — ხელით დამუშავებას საჭიროებს)
    const dispatchResult = await dispatchCourier(updated);
    res.json({ success: true, data: updated, dispatch: dispatchResult });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/admin/shipments — ადმინის ხედი ყველა shipment-ზე
router.get('/admin/all', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'მხოლოდ ადმინისთვის' });
    const shipments = await prisma.shipment.findMany({
      include: {
        items: { include: { orderItem: true } },
        order: { select: { orderNumber: true, customerName: true, customerPhone: true } },
        supplier: { select: { companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: shipments });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/admin/shipments/:id/ready — ადმინი ადასტურებს (საკუთარი მაღაზიის ნაწილებისთვის)
router.post('/admin/:id/ready', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'მხოლოდ ადმინისთვის' });
    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment არ მოიძებნა' });
    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: { status: 'READY_FOR_PICKUP', readyAt: new Date() },
    });
    const dispatchResult = await dispatchCourier(updated);
    res.json({ success: true, data: updated, dispatch: dispatchResult });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
