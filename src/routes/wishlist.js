'use strict';
const express = require('express');
const { prisma, authenticate } = require('../middleware/auth');
const router = express.Router();

// GET /api/wishlist
router.get('/', authenticate, async (req, res) => {
  const items = await prisma.wishlist.findMany({
    where: { userId: req.user.id },
    include: { product: { select: { id:true, nameKa:true, nameEn:true, nameRu:true, price:true, priceOld:true, images:true, sku:true, brand:true, stock:true, badge:true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: items });
});

// POST /api/wishlist/:productId
router.post('/:productId', authenticate, async (req, res) => {
  try {
    const item = await prisma.wishlist.create({
      data: { userId: req.user.id, productId: req.params.productId },
    });
    res.json({ success: true, data: item });
  } catch(e) {
    res.json({ success: false, message: 'უკვე დამატებულია' });
  }
});

// DELETE /api/wishlist/:productId
router.delete('/:productId', authenticate, async (req, res) => {
  await prisma.wishlist.deleteMany({
    where: { userId: req.user.id, productId: req.params.productId },
  });
  res.json({ success: true });
});

module.exports = router;
