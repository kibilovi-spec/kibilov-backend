'use strict';
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendSupplierListingApproved } = require('../services/email');

// POST /api/support/tickets — supplier ახალ ტიკეტს ქმნის
router.post('/tickets', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(403).json({ error: 'მომწოდებელი არ ხართ' });
    const { subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ error: 'subject და message საჭიროა' });
    const ticket = await prisma.$transaction(async tx => {
      const t = await tx.$queryRaw`
        INSERT INTO support_tickets (id, "supplierId", subject, status, "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${supplier.id}, ${subject}, 'OPEN', NOW(), NOW())
        RETURNING *`;
      await tx.$queryRaw`
        INSERT INTO ticket_messages (id, "ticketId", "senderId", "isAdmin", message, "createdAt")
        VALUES (gen_random_uuid()::text, ${t[0].id}, ${req.user.id}, false, ${message}, NOW())`;
      return t[0];
    });
    res.json({ success: true, data: ticket });
  } catch(e) { console.error('[support.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// GET /api/support/tickets — supplier-ის ტიკეტები
router.get('/tickets', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!supplier) return res.status(403).json({ error: 'მომწოდებელი არ ხართ' });
    const tickets = await prisma.$queryRaw`
      SELECT t.*, 
        (SELECT COUNT(*) FROM ticket_messages WHERE "ticketId"=t.id) as "messageCount",
        (SELECT message FROM ticket_messages WHERE "ticketId"=t.id ORDER BY "createdAt" DESC LIMIT 1) as "lastMessage"
      FROM support_tickets t
      WHERE t."supplierId"=${supplier.id}
      ORDER BY t."updatedAt" DESC`;
    res.json({ success: true, data: tickets });
  } catch(e) { console.error('[support.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// GET /api/support/tickets/:id — ტიკეტის მესიჯები
router.get('/tickets/:id', authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    const tickets = await prisma.$queryRaw`SELECT * FROM support_tickets WHERE id=${req.params.id}`;
    const ticket = tickets[0];
    if (!ticket) return res.status(404).json({ error: 'ტიკეტი არ მოიძებნა' });
    if (req.user.role !== 'ADMIN' && ticket.supplierId !== supplier?.id) return res.status(403).json({ error: 'წვდომა აკრძალულია' });
    const messages = await prisma.$queryRaw`
      SELECT m.*, u.name as "senderName" FROM ticket_messages m
      JOIN users u ON u.id=m."senderId"
      WHERE m."ticketId"=${req.params.id}
      ORDER BY m."createdAt" ASC`;
    res.json({ success: true, data: { ...ticket, messages } });
  } catch(e) { console.error('[support.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// POST /api/support/tickets/:id/reply — პასუხი
router.post('/tickets/:id/reply', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message საჭიროა' });
    const tickets = await prisma.$queryRaw`SELECT * FROM support_tickets WHERE id=${req.params.id}`;
    const ticket = tickets[0];
    if (!ticket) return res.status(404).json({ error: 'ტიკეტი არ მოიძებნა' });
    const isAdmin = req.user.role === 'ADMIN';
    const supplier = isAdmin ? null : await prisma.supplier.findUnique({ where: { userId: req.user.id } });
    if (!isAdmin && ticket.supplierId !== supplier?.id) return res.status(403).json({ error: 'წვდომა აკრძალულია' });
    await prisma.$queryRaw`
      INSERT INTO ticket_messages (id, "ticketId", "senderId", "isAdmin", message, "createdAt")
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${req.user.id}, ${isAdmin}, ${message}, NOW())`;
    await prisma.$queryRaw`
      UPDATE support_tickets SET status=${isAdmin?'IN_PROGRESS':'OPEN'}, "updatedAt"=NOW() WHERE id=${req.params.id}`;
    res.json({ success: true });
  } catch(e) { console.error('[support.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// GET /api/support/admin/tickets — admin ყველა ტიკეტს ხედავს
router.get('/admin/tickets', authenticate, requireAdmin, async (req, res) => {
  try {
    const tickets = await prisma.$queryRaw`
      SELECT t.*, s."companyName",
        (SELECT COUNT(*) FROM ticket_messages WHERE "ticketId"=t.id) as "messageCount",
        (SELECT message FROM ticket_messages WHERE "ticketId"=t.id ORDER BY "createdAt" DESC LIMIT 1) as "lastMessage"
      FROM support_tickets t
      JOIN suppliers s ON s.id=t."supplierId"
      ORDER BY t."updatedAt" DESC`;
    res.json({ success: true, data: tickets });
  } catch(e) { console.error('[support.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// PATCH /api/support/admin/tickets/:id/resolve
router.patch('/admin/tickets/:id/resolve', authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.$queryRaw`UPDATE support_tickets SET status='RESOLVED', "updatedAt"=NOW() WHERE id=${req.params.id}`;
    res.json({ success: true });
  } catch(e) { console.error('[support.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

module.exports = router;
