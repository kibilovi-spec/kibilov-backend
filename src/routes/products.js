'use strict';
const router = require('express').Router();
const { prisma, authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');

const fmtProduct = (p, lang = 'ka') => ({
  id:            p.id,
  sku:           p.sku,
  brand:         p.brand,
  nameKa:        p.nameKa,
  nameEn:        p.nameEn || p.nameKa,
  nameRu:        p.nameRu || p.nameKa,
  name:          p[`name${lang.charAt(0).toUpperCase()+lang.slice(1)}`] || p.nameKa,
  description:   p[`description${lang.charAt(0).toUpperCase()+lang.slice(1)}`],
  articleNumber: p.articleNumber,
  compatibility: p.compatibility ? JSON.parse(p.compatibility) : [],
  price:         Number(p.price),
  priceOld:      p.priceOld ? Number(p.priceOld) : null,
  discount:      p.discount,
  stock:         p.stock,
  inStock:       p.stock > 0,
  badge:         p.badge,
  rating:        Number(p.rating),
  reviewCount:   p.reviewCount,
  images:        p.images,
  isFeatured:    p.isFeatured,
  category:      p.category ? {
    id: p.category.id, slug: p.category.slug,
    name: p.category[`name${lang.charAt(0).toUpperCase()+lang.slice(1)}`] || p.category.nameKa,
    nameKa: p.category.nameKa,
    nameEn: p.category.nameEn || p.category.nameKa,
    nameRu: p.category.nameRu || p.category.nameKa,
  } : null,
});

// GET /api/products
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1, limit = 12, lang = 'ka',
      q, category, brand, minPrice, maxPrice,
      inStock, badge, onSale, minRating, sort = 'featured',
    } = req.query;

    const where = { isActive: true };

    if (q) {
      const search = q.toLowerCase();
      where.OR = [
        { nameKa: { contains: search, mode: 'insensitive' } },
        { nameEn: { contains: search, mode: 'insensitive' } },
        { nameRu: { contains: search, mode: 'insensitive' } },
        { brand:  { contains: search, mode: 'insensitive' } },
        { sku:    { contains: search, mode: 'insensitive' } },
        { articleNumber: { contains: search, mode: 'insensitive' } },
        { compatibility: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      const cat = await prisma.category.findFirst({
        where: { OR: [{ id: category }, { slug: category }] },
        include: { children: true },
      });
      if (cat) {
        const childIds = cat.children.map(c => c.id);
        const allIds = [cat.id, ...childIds];
        where.categoryId = { in: allIds };
      }
    }

    if (brand)    where.brand = { equals: brand, mode: 'insensitive' };
    if (minPrice) where.price = { ...where.price, gte: parseFloat(minPrice) };
    if (maxPrice) where.price = { ...where.price, lte: parseFloat(maxPrice) };
    if (inStock === 'true') where.stock = { gt: 0 };
    if (badge)    where.badge = badge.toUpperCase();
    if (onSale === 'true') where.discount = { gt: 0 };
    if (minRating) where.rating = { gte: parseFloat(minRating) };

    const orderBy = {
      featured:     { isFeatured: 'desc' },
      price_asc:    { price: 'asc' },
      price_desc:   { price: 'desc' },
      rating_desc:  { rating: 'desc' },
      reviews_desc: { reviewCount: 'desc' },
      discount_desc:{ discount: 'desc' },
      newest:       { createdAt: 'desc' },
      name_asc:     { nameKa: 'asc' },
    }[sort] || { isFeatured: 'desc' };

    const pageNum  = Math.max(1, parseInt(page));
    const pageSize = Math.min(48, Math.max(1, parseInt(limit)));

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where, orderBy,
        skip: (pageNum-1)*pageSize, take: pageSize,
        include: { category: true },
      }),
      prisma.product.count({ where }),
    ]);

    const priceAgg = await prisma.product.aggregate({ where: { isActive:true }, _min:{ price:true }, _max:{ price:true } });

    res.json({
      success: true,
      data: data.map(p => fmtProduct(p, lang)),
      pagination: { page: pageNum, limit: pageSize, total, pages: Math.ceil(total/pageSize) },
      filters: {
        priceRange: { min: Number(priceAgg._min.price||0), max: Number(priceAgg._max.price||9999) },
      },
    });
  } catch (e) { res.status(500).json({ success:false, message: e.message }); }
});

// GET /api/products/featured
router.get('/featured', async (req, res) => {
  const lang = req.query.lang || 'ka';
  const data = await prisma.product.findMany({
    where: { isActive:true },
    orderBy: { createdAt:'desc' }, take: 8, include:{ category:true },
  });
  res.json({ success:true, data: data.map(p => fmtProduct(p, lang)) });
});

// GET /api/products/search
router.get('/search', async (req, res) => {
  const { q, lang = 'ka' } = req.query;
  if (!q || q.length < 2) return res.status(422).json({ success:false, message:'მინ. 2 სიმბოლო' });
  const data = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { nameKa:{ contains:q, mode:'insensitive' } },
        { nameEn:{ contains:q, mode:'insensitive' } },
        { nameRu:{ contains:q, mode:'insensitive' } },
        { brand:{ contains:q, mode:'insensitive' } },
        { sku:{ contains:q, mode:'insensitive' } },
        { articleNumber:{ contains:q, mode:'insensitive' } },
      ],
    },
    take: 15, include:{ category:true },
  });
  res.json({ success:true, data: data.map(p => fmtProduct(p, lang)), count: data.length });
});

// GET /api/products/:id
router.get('/:id', optionalAuth, async (req, res) => {
  const lang = req.query.lang || 'ka';
  const p = await prisma.product.findFirst({
    where: { AND:[{ isActive:true }, { OR:[{ id:req.params.id },{ sku:req.params.id }] }] },
    include: { category:true },
  });
  if (!p) return res.status(404).json({ success:false, message:'პროდუქტი ვერ მოიძებნა' });

  const related = await prisma.product.findMany({
    where: { isActive:true, categoryId: p.categoryId, NOT:{ id: p.id } },
    take: 4, include:{ category:true },
  });

  res.json({ success:true, data: fmtProduct(p, lang), related: related.map(r => fmtProduct(r, lang)) });
});

// POST /api/products (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const p = await prisma.product.create({ data: { ...req.body, price: parseFloat(req.body.price) } });
    res.status(201).json({ success:true, data: p });
  } catch(e) { res.status(400).json({ success:false, message: e.message }); }
});

// PUT /api/products/:id (admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const p = await prisma.product.update({ where:{ id:req.params.id }, data: req.body });
    res.json({ success:true, data: p });
  } catch(e) { res.status(400).json({ success:false, message: e.message }); }
});

// DELETE /api/products/:id (admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  await prisma.product.update({ where:{ id:req.params.id }, data:{ isActive:false } });
  res.json({ success:true, message:'პროდუქტი წაიშალა' });
});

module.exports = router;
