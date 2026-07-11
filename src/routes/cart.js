'use strict';
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

async function getOrCreateCart(userId) {
  return prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: { items: { include: { product: true } } },
  });
}

function enrichCart(cart, lang = 'ka') {
  const items = cart.items
    .filter(i => i.product && i.product.isActive)
    .map(item => {
      const p = item.product;
      const name = lang === 'en' ? (p.nameEn || p.nameKa) : lang === 'ru' ? (p.nameRu || p.nameKa) : p.nameKa;
      return {
        id: item.id,
        productId: p.id,
        sku: p.sku,
        brand: p.brand,
        name,
        price: Number(p.price),
        images: p.images,
        inStock: p.stock > 0,
        stockLeft: p.stock,
        quantity: item.qty,   // ← always expose as `quantity` for frontend
        lineTotal: Number(p.price) * item.qty,
      };
    });

  const subtotal  = items.reduce((s, i) => s + i.lineTotal, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  return { items, itemCount, subtotal, freeDeliveryThreshold: Number(process.env.FREE_DELIVERY_THRESHOLD) || 150 };
}

// GET /api/cart
router.get('/', async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    res.json({ success: true, data: enrichCart(cart, req.query.lang) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Dynamic reservation TTL by B2B tier
function getReservationMinutes(user) {
  if (!user || !user.b2bTier) return 10; // Retail/Guest
  if (user.b2bTier === 'FOUNDING') return 45;
  if (user.b2bTier === 'HIGH_VALUE') return 30;
  if (user.b2bTier === 'STANDARD') return 20;
  return 10;
}

// რეალურად ხელმისაწვდომი მარაგი — ფიზიკური stock მინუს აქტიური (ვადაგაუვლელი,
// დაუდასტურებელი) ჯავშნები. excludeReservationId — თუ ვანახლებთ არსებულ
// ჯავშანს, მისი საკუთარი ძველი qty არ უნდა ჩაითვალოს "სხვისად დაკავებულად"
async function getAvailableStock(productId, excludeReservationId = null) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { stock: true } });
  if (!product) return 0;
  const reserved = await prisma.stockReservation.aggregate({
    where: {
      productId,
      confirmed: false,
      expiresAt: { gt: new Date() },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    _sum: { qty: true },
  });
  return product.stock - (reserved._sum.qty || 0);
}

// POST /api/cart  (add item)
router.post('/', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const qty = parseInt(quantity) || 1;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) return res.status(404).json({ success: false, message: 'პროდუქტი არ მოიძებნა' });

    const cart = await getOrCreateCart(req.user.id);
    const existing = cart.items.find(i => i.productId === productId);
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { b2bTier: true } });
    const ttlMinutes = getReservationMinutes(dbUser);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    if (existing) {
      const newQty = existing.qty + qty;
      const existingRes = await prisma.stockReservation.findFirst({ where: { cartItemId: existing.id, confirmed: false } });
      const available = await getAvailableStock(productId, existingRes?.id || null);
      if (newQty > available) return res.status(422).json({ success: false, message: `მარაგში მხოლოდ ${available} ცალია ხელმისაწვდომი` });
      await prisma.cartItem.update({ where: { id: existing.id }, data: { qty: newQty } });
      if (existingRes) {
        await prisma.stockReservation.update({ where: { id: existingRes.id }, data: { qty: newQty, expiresAt, userTier: dbUser?.b2bTier || null } });
      } else {
        await prisma.stockReservation.create({ data: { productId, cartItemId: existing.id, qty: newQty, expiresAt, userTier: dbUser?.b2bTier || null } });
      }
    } else {
      const available = await getAvailableStock(productId);
      if (qty > available) return res.status(422).json({ success: false, message: `მარაგში ${available} ცალია ხელმისაწვდომი` });
      const newItem = await prisma.cartItem.create({ data: { cartId: cart.id, productId, qty } });
      await prisma.stockReservation.create({ data: { productId, cartItemId: newItem.id, qty, expiresAt, userTier: dbUser?.b2bTier || null } });
      // Analytics: cart_added
      try {
        // analyticsId passed from frontend
        const analyticsId = req.body.analyticsId || null;
        if (analyticsId) {
          await prisma.$executeRaw`UPDATE search_analytics SET cart_added=true WHERE id=${analyticsId}`;
        }
      } catch(e) {}
    }

    const updated = await getOrCreateCart(req.user.id);
    res.json({ success: true, message: 'კალათაში დაემატა', data: enrichCart(updated, req.query.lang) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT /api/cart/:productId  (update quantity)
router.put('/:productId', async (req, res) => {
  try {
    const { quantity } = req.body;
    const qty = parseInt(quantity);
    const cart = await getOrCreateCart(req.user.id);
    const item = cart.items.find(i => i.productId === req.params.productId);
    if (!item) return res.status(404).json({ success: false, message: 'ნაწილი კალათში არ არის' });

    const existingRes = await prisma.stockReservation.findFirst({ where: { cartItemId: item.id, confirmed: false } });

    if (qty <= 0) {
      await prisma.cartItem.delete({ where: { id: item.id } });
      if (existingRes) await prisma.stockReservation.delete({ where: { id: existingRes.id } }).catch(() => {});
    } else {
      const available = await getAvailableStock(req.params.productId, existingRes?.id || null);
      if (qty > available) return res.status(422).json({ success: false, message: `მარაგში მხოლოდ ${available} ცალია ხელმისაწვდომი` });
      await prisma.cartItem.update({ where: { id: item.id }, data: { qty } });
      const dbUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { b2bTier: true } });
      const expiresAt = new Date(Date.now() + getReservationMinutes(dbUser) * 60 * 1000);
      if (existingRes) {
        await prisma.stockReservation.update({ where: { id: existingRes.id }, data: { qty, expiresAt } });
      } else {
        await prisma.stockReservation.create({ data: { productId: req.params.productId, cartItemId: item.id, qty, expiresAt, userTier: dbUser?.b2bTier || null } });
      }
    }
    const updated = await getOrCreateCart(req.user.id);
    res.json({ success: true, data: enrichCart(updated, req.query.lang) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/cart/:productId  (remove item)
router.delete('/:productId', async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    const item = cart.items.find(i => i.productId === req.params.productId);
    if (item) {
      await prisma.stockReservation.deleteMany({ where: { cartItemId: item.id } });
      await prisma.cartItem.delete({ where: { id: item.id } });
    }
    const updated = await getOrCreateCart(req.user.id);
    res.json({ success: true, data: enrichCart(updated, req.query.lang) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/cart  (clear all)
router.delete('/', async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    const itemIds = cart.items.map(i => i.id);
    if (itemIds.length) await prisma.stockReservation.deleteMany({ where: { cartItemId: { in: itemIds } } });
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    const updated = await getOrCreateCart(req.user.id);
    res.json({ success: true, data: enrichCart(updated) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
