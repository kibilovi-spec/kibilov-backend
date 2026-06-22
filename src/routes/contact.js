'use strict';
const express = require('express');
const router = express.Router();
const { sendEmail, sendWhatsApp } = require('../services/notification');

router.post('/', async (req, res) => {
  const { name, phone, message } = req.body;
  if (!name || !phone || !message) {
    return res.status(400).json({ error: 'ყველა ველი სავალდებულოა' });
  }
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPhone = process.env.ADMIN_WHATSAPP;

    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `კონტაქტის შეტყობინება — ${name}`,
        html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#1a3a8f;padding:20px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0">📩 კონტაქტის შეტყობინება</h2>
  </div>
  <div style="border:1px solid #ddd;border-top:none;padding:20px;border-radius:0 0 8px 8px">
    <p><strong>სახელი:</strong> ${name}</p>
    <p><strong>ტელეფონი:</strong> ${phone}</p>
    <p><strong>შეტყობინება:</strong></p>
    <p style="background:#f8f9fa;padding:12px;border-radius:8px">${message}</p>
  </div>
</div>`
      });
    }

    if (adminPhone) {
      await sendWhatsApp(adminPhone, `📩 კონტაქტი\n👤 ${name}\n📞 ${phone}\n💬 ${message}`);
    }

    res.json({ success: true });
  } catch (e) {
    console.error('[Contact Error]', e.message);
    res.status(500).json({ error: 'შეცდომა' });
  }
});

module.exports = router;
