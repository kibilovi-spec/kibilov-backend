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
    const fees = { RUSTAVI: 0, TBILISI: 5, MTSKHETA: 7, GORI: 8, KUTAISI: 10, OTHER: 10 };
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

    // Analytics: purchased = true
    try {
      await prisma.$executeRaw`UPDATE search_analytics SET purchased=true WHERE cart_added=true AND purchased=false AND created_at > NOW()-INTERVAL '1 hour'`;
    } catch(e) {}

    // Socket.io — live admin notification
    try {
      if (global.io) {
        global.io.to('admin').emit('new-order', {
          id: order.id,
          total: order.total,
          customer: req.user?.name || 'სტუმარი',
          items: order.items?.length || 0,
          ts: new Date().toISOString()
        });
      }
    } catch(e) {}

    // Notifications (non-blocking)
    try {
      const { notifyNewOrder } = require('../services/notification');
      await notifyNewOrder(order, req.user);
    } catch (e) { console.error('Notification error:', e.message); }
    // Email Invoice
    try {
      const { sendOrderInvoice } = require('../services/email');
      await sendOrderInvoice(order, req.user);
    } catch (e) { console.error('Email error:', e.message); }

    res.status(201).json({ success: true, order });
  } catch (e) {
    console.error('Checkout error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/', async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const where = req.user.role === 'ADMIN'
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

  if (req.body.status === 'DELIVERED') {
    try {
      const fullOrder = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: {
          items: {
            include: {
              product: {
                include: { supplier: true }
              }
            }
          }
        }
      });
      const earnings = {};
      for (const item of fullOrder.items) {
        const sup = item.product?.supplier;
        if (!sup) continue;
        const commission = sup.commission || 10.0;
        const earning = parseFloat(item.total) * (1 - commission / 100);
        if (!earnings[sup.id]) earnings[sup.id] = 0;
        earnings[sup.id] += earning;
      }
      for (const [supplierId, amount] of Object.entries(earnings)) {
        await prisma.supplier.update({
          where: { id: supplierId },
          data: { balance: { increment: amount } }
        });
      }
    } catch (e) {
      console.error('Supplier balance update error:', e.message);
    }
  try {
    const { sendOrderStatusUpdate } = require("../services/email");
    const orderWithUser = await prisma.order.findUnique({ where: { id: req.params.id }, include: { user: true } });
    if (orderWithUser?.user?.email) {
      await sendOrderStatusUpdate(orderWithUser, orderWithUser.user.email, req.body.status);
    }
  } catch(e) { console.error("Status email error:", e.message); }
  }

  res.json({ success: true, data: order });
});

module.exports = router;

// GET /api/orders/:id/pdf — PDF ინვოისი
router.get('/:id/pdf', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id, userId: req.user.id },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ error: 'შეკვეთა ვერ მოიძებნა' });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=order-${order.orderNumber}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('KIBILOV AUTO PARTS', 50, 50);
    doc.fontSize(10).font('Helvetica').text('kibilov.ge', 50, 75);
    doc.text(`Invoice #${order.orderNumber}`, 400, 50, { align: 'right' });
    doc.text(new Date(order.createdAt).toLocaleDateString('ka-GE'), 400, 65, { align: 'right' });

    doc.moveTo(50, 100).lineTo(550, 100).stroke();

    // Customer
    doc.fontSize(12).font('Helvetica-Bold').text('Customer:', 50, 115);
    doc.fontSize(10).font('Helvetica').text(order.customerName || '', 50, 132);
    doc.text(order.customerPhone || '', 50, 147);

    // Items table header
    doc.moveTo(50, 175).lineTo(550, 175).stroke();
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Product', 50, 182);
    doc.text('SKU', 280, 182);
    doc.text('Qty', 370, 182);
    doc.text('Price', 420, 182);
    doc.text('Total', 490, 182);
    doc.moveTo(50, 197).lineTo(550, 197).stroke();

    // Items
    let y = 207;
    doc.font('Helvetica').fontSize(9);
    for (const item of order.items) {
      doc.text(item.nameKa.substring(0, 35), 50, y);
      doc.text(item.sku || '', 280, y);
      doc.text(item.qty.toString(), 370, y);
      doc.text(`${Number(item.price).toFixed(2)}`, 420, y);
      doc.text(`${Number(item.total).toFixed(2)}`, 490, y);
      y += 20;
      if (y > 700) { doc.addPage(); y = 50; }
    }

    // Total
    doc.moveTo(50, y + 5).lineTo(550, y + 5).stroke();
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Delivery: ${Number(order.deliveryFee).toFixed(2)} GEL`, 380, y + 15);
    doc.fontSize(12).text(`TOTAL: ${Number(order.total).toFixed(2)} GEL`, 380, y + 35);

    doc.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/orders/:id/csv
router.get('/:id/csv', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id, userId: req.user.id },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ error: 'შეკვეთა ვერ მოიძებნა' });

    const rows = [['Product', 'SKU', 'Brand', 'Qty', 'Price', 'Total']];
    order.items.forEach(i => {
      rows.push([i.nameKa, i.sku || '', i.brand || '', i.qty, Number(i.price).toFixed(2), Number(i.total).toFixed(2)]);
    });
    rows.push(['', '', '', '', 'Delivery', Number(order.deliveryFee).toFixed(2)]);
    rows.push(['', '', '', '', 'TOTAL', Number(order.total).toFixed(2)]);

    const csv = rows.map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=order-${order.orderNumber}.csv`);
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
