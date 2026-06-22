const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// POST /api/leads
router.post('/', async (req, res) => {
  try {
    const { phone, oemCode, partName, make, model, year, message } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const lead = await prisma.lead.create({
      data: { phone, oemCode: oemCode||null, partName: partName||null, make: make||null, model: model||null, year: year||null, message: message||null }
    });
    // email notification
    try {
      const emailService = require('../services/email');
      await emailService.sendEmail({
        to: 'kibilovi@gmail.com',
        subject: `🔔 ახალი ლიდი — ${partName||oemCode||'ნაწილი'}`,
        html: `<h3>ახალი მოთხოვნა</h3>
          <p><b>ტელეფონი:</b> ${phone}</p>
          <p><b>ნაწილი:</b> ${partName||'-'}</p>
          <p><b>OEM კოდი:</b> ${oemCode||'-'}</p>
          <p><b>მანქანა:</b> ${make||''} ${model||''} ${year||''}</p>
          <p><b>შეტყობინება:</b> ${message||'-'}</p>`
      });
    } catch(emailErr) { console.log('email error:', emailErr.message); }
    res.json({ success: true, id: lead.id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/leads (admin)
router.get('/', async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    res.json(leads);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/leads/:id
router.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const lead = await prisma.lead.update({ where: { id: parseInt(req.params.id) }, data: { status } });
    res.json(lead);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
