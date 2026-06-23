'use strict';
const cache = require('../services/cache');
const router = require('express').Router();

function calcB2BPrice(price) {
  return price >= 500 ? parseFloat((price * 0.85).toFixed(2)) : parseFloat((price * 0.90).toFixed(2));
}
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
  b2bPrice:      p.b2bPrice ? Number(p.b2bPrice) : null,
  discount:      p.discount,
  stock:         p.stock,
  inStock:       p.stock > 0,
  badge:         p.badge,
  rating:        Number(p.rating),
  reviewCount:   p.reviewCount,
  images:        p.images,
  isFeatured:    p.isFeatured,
  oemCodes:      p.oemCodes || [],
  alternativeSearchKeys: p.alternativeSearchKeys || [],
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
      inStock, badge, onSale, minRating, sort = 'featured', vehicle,
    } = req.query;

    const where = { isActive: true };

    if (q) {
      const search = q.toLowerCase();
      const searchNorm = search.replace(/[\s\-]/g, '');
      // Find normalized SKU matches (gdb1183 → GDB 1183)
      let exactIds = [];
      try {
        const exactSkuMatch = await prisma.$queryRaw`
          SELECT id FROM products
          WHERE "isActive" = true
          AND (
            LOWER(REPLACE(REPLACE(sku, ' ', ''), '-', '')) = ${searchNorm}
            OR LOWER(REPLACE(REPLACE("articleNumber", ' ', ''), '-', '')) = ${searchNorm}
          )
          LIMIT 50
        `;
        exactIds = (exactSkuMatch || []).map((r) => String(r.id));
      } catch(e) {}
      const words = search.split(/\s+/).filter(w => w.length > 1);
      if (exactIds.length > 0) {
        where.OR = [{ id: { in: exactIds } }];
      } else if (words.length > 1) {
        // Multi-word: AND logic — all words must appear
        where.AND = words.map(word => ({
          OR: [
            { nameKa: { contains: word, mode: 'insensitive' } },
            { nameEn: { contains: word, mode: 'insensitive' } },
            { nameRu: { contains: word, mode: 'insensitive' } },
            { brand:  { contains: word, mode: 'insensitive' } },
            { sku:    { contains: word, mode: 'insensitive' } },
            { compatibility: { contains: word, mode: 'insensitive' } },
            { alternativeSearchKeys: { has: word.toUpperCase() } },
            { alternativeSearchKeys: { has: word } },
          ]
        }));
      } else {
        where.OR = [
          { nameKa: { contains: search, mode: 'insensitive' } },
          { nameEn: { contains: search, mode: 'insensitive' } },
          { nameRu: { contains: search, mode: 'insensitive' } },
          { brand:  { contains: search, mode: 'insensitive' } },
          { sku:    { contains: search, mode: 'insensitive' } },
          { articleNumber: { contains: search, mode: 'insensitive' } },
          { compatibility: { contains: search, mode: 'insensitive' } },
          { alternativeSearchKeys: { has: search.toUpperCase() } },
          { alternativeSearchKeys: { has: search } },
          { oemCodes: { has: search.toUpperCase() } },
          { oemCodes: { has: search } },
        ];
      }
    }

    if (category) {
      let catId = parseInt(category);
      if (isNaN(catId)) {
        try {
          const bySlug = await prisma.$queryRaw`
            SELECT autodoc_id FROM autodoc_categories WHERE slug = ${String(category)} LIMIT 1
          `;
          if (bySlug && bySlug.length > 0) catId = parseInt(bySlug[0].autodoc_id);
        } catch (e) {}
      }
      if (!isNaN(catId)) {
        // Autodoc category filter
        const childCats = await prisma.$queryRaw`
          SELECT autodoc_id FROM autodoc_categories
          WHERE autodoc_id = ${catId} OR parent_id = ${catId}
        `;
        const catIds = childCats.map(r => parseInt(r.autodoc_id));
        if (catIds.length > 0) {
          where.autodocCategoryId = { in: catIds };
        }

    }
    }
    // autodoc_id filter — Autodoc category-ის მიხედვით OEM კოდებით ძებნა
    const { autodoc_id } = req.query;
    if (autodoc_id) {
      // ავიღოთ ეს category + ყველა child category autodoc_categories-დან
      const autodocCats = await prisma.$queryRaw`
        WITH RECURSIVE cat_tree AS (
          SELECT autodoc_id FROM autodoc_categories WHERE autodoc_id = ${parseInt(autodoc_id)}
          UNION ALL
          SELECT ac.autodoc_id FROM autodoc_categories ac
          JOIN cat_tree ct ON ac.parent_id = ct.autodoc_id
        )
        SELECT autodoc_id FROM cat_tree
      `;
      const catIds = autodocCats.map(r => parseInt(r.autodoc_id));
      if (catIds.length > 0) {
        const oemRows = await prisma.$queryRaw`
          SELECT DISTINCT oem_code FROM vehicle_oem
          WHERE category::int = ANY(${catIds})
        `;
        const oemCodes = oemRows.map(r => r.oem_code);
        if (oemCodes.length > 0) {
          if (!where.OR) where.OR = [];
          where.OR.push({ alternativeSearchKeys: { hasSome: oemCodes } });
          where.OR.push({ oemCodes: { hasSome: oemCodes } });
        }
      }
    }

    if (brand)    where.brand = { equals: brand, mode: 'insensitive' };
    if (vehicle) {
      const vSearch = vehicle.toLowerCase();
      if (!where.OR) where.OR = [];
      where.OR.push(
        { nameKa: { contains: vSearch, mode: 'insensitive' } },
        { nameEn: { contains: vSearch, mode: 'insensitive' } },
        { compatibility: { contains: vSearch, mode: 'insensitive' } },
        { sku: { contains: vSearch, mode: 'insensitive' } }
      );
    }
    // vehicleId filter — OEM კოდებით პროდუქტების ძებნა
    const { vehicleId } = req.query;
    if (vehicleId) {
      const oemRows = await prisma.$queryRaw`
        SELECT DISTINCT oem_code FROM vehicle_oem WHERE vehicle_id = ${String(vehicleId)}
      `;
      const oemCodes = oemRows.map(r => r.oem_code);
      if (oemCodes.length > 0) {
        if (!where.OR) where.OR = [];
        where.OR.push({ alternativeSearchKeys: { hasSome: oemCodes } });
        where.OR.push({ oemCodes: { hasSome: oemCodes } });
      }
    }
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
    where: { isActive:true, isFeatured:true },
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
// GET /api/products/stats — ცოცხალი სტატისტიკა

router.get('/brands', async (req, res) => {
  try {
    const brands = await prisma.$queryRaw`
      SELECT brand, COUNT(*)::int as count
      FROM products
      WHERE "isActive" = true AND brand IS NOT NULL AND brand != ''
      GROUP BY brand
      ORDER BY count DESC
    `;
    res.json({ success: true, brands });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const [productCount, brandCount, categoryCount, updatedAt] = await Promise.all([
      prisma.product.count({ where: { isActive: true, stock: { gt: 0 } } }),
      prisma.product.groupBy({ by: ['brand'], where: { isActive: true } }).then(r => r.length),
      prisma.$queryRaw`SELECT COUNT(*)::int as cnt FROM autodoc_categories WHERE level=1`.then(r=>Number(r[0].cnt)),
      prisma.product.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    ]);
    res.json({
      success: true,
      data: {
        products: productCount,
        brands: brandCount,
        categories: categoryCount,
        updatedAt: updatedAt?.updatedAt || new Date(),
      }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', optionalAuth, async (req, res) => {
  const lang = req.query.lang || 'ka';
  const cacheKey = `product:${req.params.id}:${lang}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  const p = await prisma.product.findFirst({
    where: { AND:[{ isActive:true }, { OR:[{ id:req.params.id },{ sku:req.params.id }] }] },
    include: { category:true },
  });

  if (!p) return res.status(404).json({ success:false, message:"product not found" });

  // parallel queries - no N+1
  const [oemRelated, catRelated] = await Promise.all([
    p?.oemCodes?.length > 0
      ? prisma.product.findMany({
          where: { isActive:true, NOT:{ id: p.id }, oemCodes: { hasSome: p.oemCodes } },
          take: 4, include:{ category:true },
        })
      : Promise.resolve([]),
    prisma.product.findMany({
      where: { isActive:true, autodocCategoryId: p.autodocCategoryId, NOT:{ id: p.id } },
      take: 4, include:{ category:true },
    }),
  ]);
  const oemIds = new Set(oemRelated.map(r => r.id));
  const related = [
    ...oemRelated,
    ...catRelated.filter(r => !oemIds.has(r.id)),
  ].slice(0, 4);

  const result = { success:true, data: fmtProduct(p, lang), related: related.map(r => fmtProduct(r, lang)), oemCodes: p.oemCodes };
  await cache.set(cacheKey, result, 1800);
  res.json(result);
});

// POST /api/products (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const retailPrice = parseFloat(req.body.price) || 0;
    const b2bPrice = calcB2BPrice(retailPrice);
    const p = await prisma.product.create({ data: { brand: "", nameEn: req.body.nameKa, nameRu: req.body.nameKa, ...req.body, price: retailPrice, b2bPrice: b2bPrice, stock: parseInt(req.body.stock)||0 } });
    res.status(201).json({ success:true, data: p });
  } catch(e) { res.status(400).json({ success:false, message: e.message }); }
});

// GET /api/products/:id/listings - მრავალი გამყიდველი
router.get('/:id/listings', async (req, res) => {
  try {
    const listings = await prisma.productListing.findMany({
      where: {
        OR: [{ productId: req.params.id }, { sku: req.params.id }],
        status: 'ACTIVE'
      },
      include: {
        supplier: {
          select: { companyName: true, rating: true, totalSales: true, id: true }
        }
      },
      orderBy: { price: 'asc' }
    });
    res.json({ success: true, data: listings });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/products/:id (admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { nameKa, nameEn, nameRu, brand, articleNumber, price, stock, description, isActive, images } = req.body;
    const updateData = {};
    if (nameKa !== undefined) updateData.nameKa = nameKa;
    if (nameEn !== undefined) updateData.nameEn = nameEn;
    if (nameRu !== undefined) updateData.nameRu = nameRu;
    if (brand !== undefined) updateData.brand = brand;
    if (articleNumber !== undefined) updateData.articleNumber = articleNumber;
    if (price !== undefined) {
      const retailPrice = parseFloat(price);
      updateData.price = retailPrice;
      updateData.b2bPrice = calcB2BPrice(retailPrice);
    }
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (description !== undefined) updateData.descriptionKa = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (images !== undefined) updateData.images = images;
    const p = await prisma.product.update({ where:{ id:req.params.id }, data: updateData });
    await cache.del(`product:${req.params.id}`);
    await cache.flush('products:*');
    res.json({ success:true, data: p });
  } catch(e) { res.status(400).json({ success:false, message: e.message }); }
});

// DELETE /api/products/:id (admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  await prisma.product.update({ where:{ id:req.params.id }, data:{ isActive:false } });
  await cache.del(`product:${req.params.id}`);
  await cache.flush('products:*');
  res.json({ success:true, message:'პროდუქტი წაიშალა' });
});


// GET /api/products/:id/fitment?vehicleId=&make=&model=&year=&generation=
router.get('/:id/fitment', optionalAuth, async (req, res) => {
  try {
    const { getFitmentScore } = require('../services/fitmentScore');
    const p = await prisma.product.findFirst({
      where: { AND:[{ isActive:true }, { OR:[{ id:req.params.id },{ sku:req.params.id }] }] },
      select: { id:true, sku:true, nameKa:true, oemCodes:true, autodocCategoryId:true }
    });
    if (!p) return res.status(404).json({ success:false });
    const vehicleContext = {
      vehicleId: req.query.vehicleId || null,
      make: req.query.make || null,
      model: req.query.model || null,
      year: req.query.year || null,
      generation: req.query.generation || null,
    };
    const result = await getFitmentScore(p, vehicleContext);
    res.json({ success:true, fitment: result });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});
module.exports = router;

