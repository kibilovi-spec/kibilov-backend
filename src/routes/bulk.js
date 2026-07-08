const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const prisma = new PrismaClient();

// POST /api/bulk/search
// body: { codes: ["04152-YZZA6", "GDB3445", "HU710/4X"] }
router.post('/search', async (req, res) => {
  try {
    const { codes } = req.body;
    if (!codes?.length) return res.status(400).json({ error: 'codes required' });
    const cleaned = codes.map(c => c.trim().toUpperCase()).filter(Boolean).slice(0, 50);
    const results = {};
    for (const code of cleaned) {
      const products = await prisma.product.findMany({
        where: {
          OR: [
            { oemCodes: { hasSome: [code, code.toLowerCase()] } },
            { alternativeSearchKeys: { hasSome: [code, code.toLowerCase()] } },
            { sku: { equals: code, mode: 'insensitive' } },
            { nameKa: { contains: code, mode: 'insensitive' } }
          ]
        },
        select: { id: true, nameKa: true, sku: true, price: true, stock: true, images: true, oemCodes: true },
        take: 3
      });
      results[code] = { found: products.length > 0, products };
    }
    res.json({ total: cleaned.length, found: Object.values(results).filter(r => r.found).length, results });
  } catch(e) { console.error('[bulk.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// POST /api/bulk/quote — SKU სია -> ფასების/მარაგის შემოწმება (DB-ში არაფერი იცვლება)
router.post('/quote', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items required' });
    const results = [];
    let subtotal = 0;
    for (const it of items.slice(0, 100)) {
      const sku = (it.sku || '').trim();
      const qty = parseInt(it.qty) || 1;
      if (!sku) continue;
      const product = await prisma.product.findFirst({ where: { sku: { equals: sku, mode: 'insensitive' } } });
      if (!product || !product.isActive) {
        results.push({ sku, qty, found: false });
        continue;
      }
      const lineTotal = Number(product.price) * qty;
      subtotal += lineTotal;
      results.push({
        sku, qty, found: true,
        productId: product.id, nameKa: product.nameKa, price: Number(product.price),
        stock: product.stock, available: product.stock >= qty, lineTotal
      });
    }
    res.json({ success: true, items: results, subtotal, count: results.filter(r => r.found).length });
  } catch(e) { console.error('[bulk.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// POST /api/bulk/order — SKU სია -> რეალური შეკვეთის შექმნა
router.post('/order', authenticate, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items required' });
    const userId = req.user.id;
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true } });

    const resolved = [];
    for (const it of items.slice(0, 100)) {
      const sku = (it.sku || '').trim();
      const qty = parseInt(it.qty) || 1;
      if (!sku) continue;
      const product = await prisma.product.findFirst({ where: { sku: { equals: sku, mode: 'insensitive' } } });
      if (!product || !product.isActive) continue;
      if (product.stock < qty) continue;
      resolved.push({ product, qty });
    }
    if (!resolved.length) return res.status(422).json({ success: false, message: 'ვერცერთი პროდუქტი ვერ მოიძებნა ან არ არის საკმარისი მარაგში' });

    const subtotal = resolved.reduce((s, r) => s + Number(r.product.price) * r.qty, 0);

    const order = await prisma.$transaction(async (tx) => {
      for (const r of resolved) {
        await tx.product.update({ where: { id: r.product.id }, data: { stock: { decrement: r.qty } } });
      }
      return tx.order.create({
        data: {
          userId,
          total: subtotal,
          subtotal,
          deliveryFee: 0,
          deliveryZone: 'OTHER',
          paymentMethod: 'CASH',
          paymentStatus: 'UNPAID',
          status: 'PENDING',
          customerName: dbUser?.name || '',
          customerPhone: dbUser?.phone || '',
          customerEmail: dbUser?.email || '',
          deliveryAddress: '',
          note: 'Bulk Order (SKU სია)',
          items: {
            create: resolved.map(r => ({
              productId: r.product.id, qty: r.qty, price: r.product.price,
              total: Number(r.product.price) * r.qty,
              nameKa: r.product.nameKa, nameEn: r.product.nameEn || r.product.nameKa, nameRu: r.product.nameRu || r.product.nameKa,
              sku: r.product.sku, brand: r.product.brand || ''
            }))
          }
        },
        include: { items: true }
      });
    });

    try { const { notifyNewOrder } = require('../services/notification'); await notifyNewOrder(order, req.user); } catch (e) {}
    try { const { sendOrderInvoice } = require('../services/email'); await sendOrderInvoice(order, order.customerEmail); } catch (e) {}

    res.status(201).json({ success: true, order });
  } catch (e) {
    console.error('Bulk order error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
