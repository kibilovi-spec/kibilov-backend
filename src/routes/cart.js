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

// POST /api/cart  (add item)
router.post('/', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const qty = parseInt(quantity) || 1;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) return res.status(404).json({ success: false, message: 'პროდუქტი არ მოიძებნა' });
    if (product.stock < qty) return res.status(422).json({ success: false, message: `მარაგში ${product.stock} ცალია` });

    const cart = await getOrCreateCart(req.user.id);
    const existing = cart.items.find(i => i.productId === productId);

    if (existing) {
      const newQty = existing.qty + qty;
      if (newQty > product.stock) return res.status(422).json({ success: false, message: `მარაგში მხოლოდ ${product.stock} ცალია` });
      await prisma.cartItem.update({ where: { id: existing.id }, data: { qty: newQty } });
    } else {
      await prisma.cartItem.create({ data: { cartId: cart.id, productId, qty } });
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

    if (qty <= 0) {
      await prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      await prisma.cartItem.update({ where: { id: item.id }, data: { qty } });
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
    if (item) await prisma.cartItem.delete({ where: { id: item.id } });
    const updated = await getOrCreateCart(req.user.id);
    res.json({ success: true, data: enrichCart(updated, req.query.lang) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/cart  (clear all)
router.delete('/', async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    const updated = await getOrCreateCart(req.user.id);
    res.json({ success: true, data: enrichCart(updated) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
