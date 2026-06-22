const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');

router.get('/:productId', async (req, res) => {
  try {
    const reviews = await prisma.productReview.findMany({
      where: { productId: req.params.productId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    const avg = reviews.length ? reviews.reduce((a,r) => a + r.rating, 0) / reviews.length : 0;
    res.json({ success: true, data: reviews, average: avg.toFixed(1), total: reviews.length });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.post('/:productId', authenticate, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'რეიტინგი 1-5' });
    const review = await prisma.productReview.upsert({
      where: { productId_userId: { productId: req.params.productId, userId: req.user.id } },
      update: { rating: parseInt(rating), comment },
      create: { productId: req.params.productId, userId: req.user.id, rating: parseInt(rating), comment }
    });
    res.json({ success: true, data: review });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:productId', authenticate, async (req, res) => {
  try {
    await prisma.productReview.delete({
      where: { productId_userId: { productId: req.params.productId, userId: req.user.id } }
    });
    res.json({ success: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
