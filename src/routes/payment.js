'use strict';
const express = require('express');
const axios   = require('axios');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const router  = express.Router();
const prisma  = new PrismaClient();

// ─── BOG Payment ───────────────────────────────────────────────────────────────
// BOG uses OAuth2 + REST API
// Docs: https://developer.bog.ge

async function getBogToken() {
  const resp = await axios.post('https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token', 
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id:     process.env.BOG_CLIENT_ID,
      client_secret: process.env.BOG_CLIENT_SECRET,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }}
  );
  return resp.data.access_token;
}

// POST /api/payment/bog/init
router.post('/bog/init', authenticate, async (req, res) => {
  const { orderId } = req.body;
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user.id }, include: { items: true }});
  if (!order) return res.status(404).json({ success: false, message: 'შეკვეთა არ მოიძებნა' });

  try {
    // In development/test mode — simulate payment URL
    if (!process.env.BOG_CLIENT_ID || process.env.BOG_ENVIRONMENT === 'test') {
      const simulatedUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/success?order=${orderId}&method=bog&sim=1`;
      await prisma.order.update({ where: { id: orderId }, data: { paymentUrl: simulatedUrl, paymentMethod: 'bog' }});
      return res.json({ success: true, paymentUrl: simulatedUrl, orderId });
    }

    const token = await getBogToken();
    const resp = await axios.post('https://api.bog.ge/payments/v1/ecommerce/orders',
      {
        callback_url: process.env.BOG_CALLBACK_URL,
        purchase_units: {
          currency: 'GEL',
          total_amount: Number(order.total),
          basket: order.items.map(i => ({
            product_id:   i.productId,
            unit_price:   Number(i.price),
            quantity:     i.qty,
            product_name: i.nameKa,
          })),
        },
        redirect_urls: {
          success: `${process.env.CLIENT_URL}/payment/success?order=${orderId}`,
          fail:    `${process.env.CLIENT_URL}/payment/fail?order=${orderId}`,
        },
      },
      { headers: { Authorization: `Bearer ${token}` }}
    );

    const paymentUrl = resp.data._links?.redirect?.href;
    const paymentId  = resp.data.id;
    await prisma.order.update({ where: { id: orderId }, data: { paymentUrl, paymentId, paymentMethod: 'bog' }});
    res.json({ success: true, paymentUrl, orderId });
  } catch (e) {
    console.error('[BOG] Error:', e.response?.data || e.message);
    res.status(500).json({ success: false, message: 'BOG გადახდის შეცდომა' });
  }
});

// POST /api/payment/bog/callback (webhook from BOG)
router.post('/bog/callback', async (req, res) => {
  try {
    const { order_id, status, payment_hash } = req.body;
    const order = await prisma.order.findFirst({ where: { paymentId: order_id }});
    if (!order) return res.status(404).send('Order not found');

    const paymentStatus = status === 'completed' ? 'PAID' : status === 'failed' ? 'FAILED' : 'PENDING';
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus, status: paymentStatus === 'PAID' ? 'CONFIRMED' : order.status },
    });
    res.status(200).send('OK');
  } catch (e) {
    console.error('[BOG Callback]', e.message);
    res.status(500).send('Error');
  }
});

// ─── TBC Payment ───────────────────────────────────────────────────────────────
async function getTbcToken() {
  const resp = await axios.post('https://identity.tbcbank.ge/connect/token',
    new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     process.env.TBC_CLIENT_ID,
      client_secret: process.env.TBC_CLIENT_SECRET,
      scope:         'online_payments',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }}
  );
  return resp.data.access_token;
}

// POST /api/payment/tbc/init
router.post('/tbc/init', authenticate, async (req, res) => {
  const { orderId } = req.body;
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user.id }});
  if (!order) return res.status(404).json({ success: false, message: 'შეკვეთა არ მოიძებნა' });

  try {
    if (!process.env.TBC_CLIENT_ID || process.env.TBC_ENVIRONMENT === 'test') {
      const simulatedUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/success?order=${orderId}&method=tbc&sim=1`;
      await prisma.order.update({ where: { id: orderId }, data: { paymentUrl: simulatedUrl, paymentMethod: 'tbc' }});
      return res.json({ success: true, paymentUrl: simulatedUrl, orderId });
    }

    const token = await getTbcToken();
    const resp  = await axios.post('https://api.tbcbank.ge/v1/tpay/payments',
      {
        amount: { currency: 'GEL', total: Number(order.total), subtotal: Number(order.subtotal) },
        returnurl:  `${process.env.CLIENT_URL}/payment/success?order=${orderId}`,
        extra:       orderId,
        installmentProducts: [],
      },
      { headers: { Authorization: `Bearer ${token}`, 'apikey': process.env.TBC_CLIENT_ID }}
    );

    const paymentUrl = resp.data.links?.find(l => l.rel === 'approval_url')?.href;
    const paymentId  = resp.data.payId;
    await prisma.order.update({ where: { id: orderId }, data: { paymentUrl, paymentId, paymentMethod: 'tbc' }});
    res.json({ success: true, paymentUrl, orderId });
  } catch (e) {
    console.error('[TBC] Error:', e.response?.data || e.message);
    res.status(500).json({ success: false, message: 'TBC გადახდის შეცდომა' });
  }
});

// POST /api/payment/tbc/callback
router.post('/tbc/callback', async (req, res) => {
  try {
    const { payId, status } = req.body;
    const order = await prisma.order.findFirst({ where: { paymentId: payId }});
    if (!order) return res.status(404).send('Not found');
    const paymentStatus = status === 'Succeeded' ? 'PAID' : status === 'Failed' ? 'FAILED' : 'PENDING';
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus, status: paymentStatus === 'PAID' ? 'CONFIRMED' : order.status },
    });
    res.status(200).send('OK');
  } catch (e) {
    res.status(500).send('Error');
  }
});

// GET /api/payment/status/:orderId
router.get('/status/:orderId', authenticate, async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.orderId, userId: req.user.id },
    select: { id: true, paymentStatus: true, status: true, orderNumber: true },
  });
  if (!order) return res.status(404).json({ success: false, message: 'შეკვეთა არ მოიძებნა' });
  res.json({ success: true, data: order });
});

module.exports = router;
