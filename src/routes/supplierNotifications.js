'use strict';
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');

// GET /api/supplier/notifications
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.json({ success: true, data: [], unread: 0 });
    const notifications = await prisma.$queryRaw`
      SELECT * FROM supplier_notifications 
      WHERE "supplierId"=${supplier.id} 
      ORDER BY "createdAt" DESC LIMIT 20`;
    const unread = notifications.filter((n) => !n.isRead).length;
    res.json({ success: true, data: notifications, unread });
  } catch(e) { console.error('[supplierNotifications.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// PATCH /api/supplier/notifications/read-all
router.patch('/notifications/read-all', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.json({ success: true });
    await prisma.$queryRaw`UPDATE supplier_notifications SET "isRead"=true WHERE "supplierId"=${supplier.id}`;
    res.json({ success: true });
  } catch(e) { console.error('[supplierNotifications.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// PATCH /api/supplier/notifications/:id/read
router.patch('/notifications/:id/read', authenticate, async (req, res) => {
  try {
    await prisma.$queryRaw`UPDATE supplier_notifications SET "isRead"=true WHERE id=${req.params.id}`;
    res.json({ success: true });
  } catch(e) { console.error('[supplierNotifications.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

module.exports = router;
