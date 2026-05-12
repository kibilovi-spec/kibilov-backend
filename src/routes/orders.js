'use strict';
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();
router.use(authenticate);

// POST /api/orders — checkout
router.post('/', async (req, res) => {
  try {
    const { address, deliveryZone, paymentMethod } = req.body;
    const userId = req.user.id;

    // Get full user data
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true } });

    // Get user's cart
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });
    if (!cart || !cart.items.length) return res.status(422).json({ success: false, message: 'კალათა ცარიელია' });

    // Validate stock
    for (const item of cart.items) {
      if (!item.product.isActive) return res.status(422).json({ success: false, message: `${item.product.nameKa} — არ არის ხელმისაწვდომი` });
      if (item.product.stock < item.qty) return res.status(422).json({ success: false, message: `${item.product.nameKa} — მარაგში ${item.product.stock} ცალია` });
    }

    // Delivery fee
    const FREE = Number(process.env.FREE_DELIVERY_THRESHOLD) || 150;
    const fees = { RUSTAVI: 0, TBILISI: 5, MTSKHETA: 7, OTHER: 10 };
    const subtotal = cart.items.reduce((s, i) => s + Number(i.product.price) * i.qty, 0);
    const deliveryFee = subtotal >= FREE ? 0 : (fees[deliveryZone] ?? 10);
    const total = subtotal + deliveryFee;

    // Create order in transaction
    const order = await prisma.$transaction(async (tx) => {
      // Deduct stock
      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.qty } },
        });
      }

      // Create address
      let addressRecord = null;
      if (address) {
        addressRecord = await tx.address.create({
          data: { userId, city: address.city || '', street: address.street || '', apartment: address.apartment || '', zone: deliveryZone || 'OTHER' },
        });
      }

      // Create order
      const newOrder = await tx.order.create({
        data: {
          userId,
          total,
          subtotal,
          deliveryFee,
          deliveryZone: deliveryZone || 'OTHER',
          paymentMethod: paymentMethod || 'CASH',
          paymentStatus: 'UNPAID',
          status: 'PENDING',
          addressId: addressRecord?.id || null,
          customerName: dbUser?.name || '',
          customerPhone: dbUser?.phone || '',
          customerEmail: dbUser?.email || '',
          deliveryAddress: address ? `${address.city}, ${address.street}${address.apartment ? ', ' + address.apartment : ''}` : '',
          items: {
            create: cart.items.map(i => ({
              productId: i.productId,
              qty: i.qty,
              price: i.product.price,
              total: Number(i.product.price) * i.qty,
              nameKa: i.product.nameKa,
              nameEn: i.product.nameEn || i.product.nameKa,
              nameRu: i.product.nameRu || i.product.nameKa,
              sku: i.product.sku,
              brand: i.product.brand || '',
            })),
          },
        },
        include: { items: true },
      });

      // Clear cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return newOrder;
    });

    // Notifications (non-blocking)
    try {
      const { notifyNewOrder } = require('../services/notification');
      await notifyNewOrder(order, req.user);
    } catch (e) { console.error('Notification error:', e.message); }

    res.status(201).json({ success: true, order });
  } catch (e) {
    console.error('Checkout error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/', async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const where = req.user.role === 'ADMIN' || req.user.role === 'MANAGER'
    ? (status ? { status } : {})
    : { userId: req.user.id, ...(status ? { status } : {}) };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' },
      skip: (parseInt(page)-1) * parseInt(limit), take: parseInt(limit),
      include: { items: true, user: { select: { name:true, email:true, phone:true }}}
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ success: true, data: orders, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total/parseInt(limit)) }});
});

router.get('/:id', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: true }}, user: { select: { name:true, email:true, phone:true }}, address: true }
  });
  if (!order) return res.status(404).json({ success: false, message: 'შეკვეთა არ მოიძებნა' });
  if (req.user.role === 'USER' && order.userId !== req.user.id)
    return res.status(403).json({ success: false, message: 'წვდომა აკრძალულია' });
  res.json({ success: true, data: order });
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  const valid = ['PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED'];
  if (!valid.includes(req.body.status))
    return res.status(422).json({ success: false, message: `სტატუსი: ${valid.join(', ')}` });
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { status: req.body.status, adminNotes: req.body.adminNotes },
  });
  res.json({ success: true, data: order });
});

module.exports = router;
