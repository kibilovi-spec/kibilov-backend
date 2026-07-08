'use strict';
const { enrichWithSynonyms, GEO_AUTO_SYNONYMS } = require('../services/synonyms');
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
  description:   p[`description${lang.charAt(0).toUpperCase()+lang.slice(1)}`] || p.descriptionEn || null,
  descriptionEn:  p.descriptionEn || null,
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
  autodocCategoryId: p.autodocCategoryId || null,
  category:      p.category ? {
    id: p.category.id, slug: p.category.slug,
    name: p.category[`name${lang.charAt(0).toUpperCase()+lang.slice(1)}`] || p.category.nameKa,
    nameKa: p.category.nameKa,
    nameEn: p.category.nameEn || p.category.nameKa,
    nameRu: p.category.nameRu || p.category.nameKa,
  } : null,
  autodocCategory: p.autodoc_categories ? {
    id: p.autodoc_categories.autodoc_id,
    slug: p.autodoc_categories.slug,
    nameKa: p.autodoc_categories.name_ka || p.autodoc_categories.name_en,
    nameEn: p.autodoc_categories.name_en,
  } : null,
});

// GET /api/products
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1, limit = 12, lang = 'ka',
      q, category, brand, minPrice, maxPrice,
      inStock, badge, onSale, minRating, sort = 'featured', vehicle, featured,
    } = req.query;

    const where = { isActive: true };

    if (q) {
      const search = q.toLowerCase();
      const synonymTerms = GEO_AUTO_SYNONYMS[q] || GEO_AUTO_SYNONYMS[q.toLowerCase()] || [];
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
          ...synonymTerms.flatMap(term => [
            { nameKa: { contains: term, mode: 'insensitive' } },
            { nameEn: { contains: term, mode: 'insensitive' } },
          ]),
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
    const { autodoc_id, autodoc_category_id } = req.query;
    const effectiveAutodocId = autodoc_id || autodoc_category_id;
    if (effectiveAutodocId) {
      // ავიღოთ ეს category + ყველა child category autodoc_categories-დან
      const autodocCats = await prisma.$queryRaw`
        WITH RECURSIVE cat_tree AS (
          SELECT autodoc_id FROM autodoc_categories WHERE autodoc_id = ${parseInt(effectiveAutodocId)}
          UNION ALL
          SELECT ac.autodoc_id FROM autodoc_categories ac
          JOIN cat_tree ct ON ac.parent_id = ct.autodoc_id
        )
        SELECT autodoc_id FROM cat_tree
      `;
      const catIds = autodocCats.map(r => parseInt(r.autodoc_id));
      if (catIds.length > 0) {
        // პირდაპირი category filter (სწრაფი)
        if (!where.OR) where.OR = [];
        where.OR.push({ autodocCategoryId: { in: catIds } });
        // OEM filter (vehicle-specific)
        const oemRows = await prisma.$queryRaw`
          SELECT DISTINCT oem_code FROM vehicle_oem
          WHERE category = ANY(${catIds.map(String)})
        `;
        const oemCodes = oemRows.map(r => r.oem_code);
        if (oemCodes.length > 0) {
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
    if (featured === 'true') {
      where.isFeatured = true;
      where.images = { isEmpty: false };
    }

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
    const pageSize = Math.min(500, Math.max(1, parseInt(limit)));

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where, orderBy: [{ isFeatured: 'desc' }, orderBy],
        skip: (pageNum-1)*pageSize, take: pageSize,
        include: { category: true, autodoc_categories: true },
      }),
      prisma.product.count({ where }),
    ]);

    const priceAgg = await prisma.product.aggregate({ where: { isActive:true }, _min:{ price:true }, _max:{ price:true } });

    // Autodoc fallback — DB-ში ვერ მოიძებნა
    if (total === 0 && q) {
      try {
        const autodocMod = require('./autodoc_search');
        const CAT_MAP = typeof autodocMod.CATEGORY_MAP !== 'undefined' ? autodocMod.CATEGORY_MAP : {};
        const qLow = q.toLowerCase();
        let catId = null;
        const SIMPLE_MAP = {
          'timing belt':104318, 'timing belt kit':100405, 'timing':104318, 'ტაიმინგი':104318, 'timing chain':103278,
          'shock absorber':100121, 'ამორტიზატორი':100121, 'შოკი':100121, 'suspension strut':100129,
          'brake pad':100030, 'კალოკი':100030, 'კალოტკა':100030,
          'oil filter':100043, 'ზეთის ფილტრი':100043,
          'air filter':100041, 'ჰაერის ფილტრი':100041,
          'spark plug':100067, 'სანთელი':100067,
          'alternator':100064, 'გენერატორი':100064,
          'water pump':100059, 'წყლის ტუმბო':100059,
          'clutch':100051, 'კლაჩი':100051,
          'radiator':100102, 'რადიატორი':100102,
          'fuel filter':100044, 'საწვავის ფილტრი':100044,
          'ball joint':100581, 'ბურთულა':100581,
          'cv joint':100071, 'გრანტი':100071,
          'wheel bearing':100579, 'საკისარი':100579,
          'stabilizer':100573, 'სტაბი':100573,
          'brake disc':100032, 'სამუხრუჭე დისკი':100032, 'დისკი':100032, 'disk':100032,
          'brake drum':100033, 'დოლი':100033,
          'brake hose':100035, 'სამუხრუჭე შლანგი':100035,
          'cabin filter':100042, 'სალონის ფილტრი':100042, 'salon':100042,
          'fuel filter':100044, 'საწვავის ფილტრი':100044, 'benzinis':100044,
          'spark plug':100151, 'სანთელი':100151, 'svecha':100151, 'ბოუჯი':100151,
          'glow plug':100152, 'გახურების სანთელი':100152,
          'alternator':100350, 'გენერატორი':100350, 'generator':100350,
          'starter':100353, 'სტარტერი':100353,
          'water pump':100059, 'წყლის ტუმბო':100059, 'pompa':100059, 'ვოდიანკა':100059,
          'thermostat':100060, 'თერმოსტატი':100060,
          'radiator':100102, 'რადიატორი':100102,
          'clutch':100051, 'კლაჩი':100051, 'კავშირი':100051,
          'flywheel':100057, 'მახვილი':100057,
          'cv joint':100071, 'გრანტი':100071, 'შარავი':100071,
          'drive shaft':100152, 'პრივოდი':100152,
          'wheel bearing':100579, 'საკისარი':100579, 'buqsa':100579, 'ბუქსა':100579,
          'control arm':100571, 'სასხლეტი':100571, 'ლევერი':100571, 'ბერკეტი':100571,
          'tie rod':100577, 'სტერჟინი':100577, 'ნაკონეჩნიკი':100577,
          'ball joint':100581, 'ბურთულა':100581, 'შარნირი':100581,
          'engine mount':100560, 'მოტორის ბალიში':100560, 'ძრავის ბალიში':100560,
          'gearbox mount':100561, 'კორობკის ბალიში':100561,
          'power steering':100269, 'საჭის ტუმბო':100269, 'გიდრაჩი':100269,
          'steering rack':100261, 'რეიკა':100261,
          'fuel pump':100172, 'საწვავის ტუმბო':100172, 'benzinis pompa':100172,
          'injector':100175, 'ინჟექტორი':100175,
          'oxygen sensor':100048, 'ლამბდა':100048, 'lambda':100048,
          'egr':100049, 'egr valve':100049,
          'turbo':100083, 'ტურბო':100083, 'turbocharger':100083,
          'intercooler':100355, 'ინტერკულერი':100355,
          'exhaust':100046, 'გამონაბოლქვი':100046, 'глушитель':100046,
          'catalytic converter':100047, 'კატალიზატორი':100047,
          'window regulator':100566, 'შტაკეტი':100566, 'стеклоподъемник':100566,
          'door lock':100564, 'საკეტი':100564,
          'headlight':101466, 'ფარი':101466, 'фара':101466,
          'tail light':101409, 'უკანა ფარი':101409,
          'fog light':101342, 'სანისლე ფარი':101342,
          'wiper':100542, 'შემწმენდი':100542, 'дворники':100542,
          'battery':100042, 'აკუმულატორი':100042, 'akumulatori':100042,
          'horn':100537, 'სიგნალი':100537,
          'seat belt':100421, 'ღვედი':100421,
          'axle':100415, 'ღერძი':100415,
        };
        for (const [term, id] of Object.entries(SIMPLE_MAP)) {
          if (qLow.includes(term) || term.includes(qLow)) { catId = id; break; }
        }
        // OEM/SKU exact-match fallback — თუ category keyword ვერ მოიძებნა
        if (!catId && /^[a-zA-Z0-9\-\.\/]{3,20}$/.test(q.trim())) {
          try {
            const oemUrl = `http://localhost:${process.env.PORT||3001}/api/autodoc/oem?code=${encodeURIComponent(q.trim())}`;
            const or_ = await fetch(oemUrl, { signal: AbortSignal.timeout(8000) });
            const od = await or_.json();
            if (od.found && od.articles?.length > 0) {
              const articles = od.articles.slice(0, pageSize);
              return res.json({
                success: true,
                data: articles.map(a => ({
                  id: 'autodoc_' + a.articleId,
                  nameKa: a.desc || '', nameEn: a.desc || '',
                  brand: a.brand || '', sku: a.code || '',
                  price: null, stock: 1,
                  images: a.image ? [a.image] : [],
                  source: 'autodoc',
                })),
                pagination: { page: 1, limit: pageSize, total: articles.length, pages: 1 },
                filters: { priceRange: { min: 0, max: 9999 } },
              });
            }
          } catch(oe) { console.error('OEM fallback:', oe.message); }
        }
        if (catId) {
          const BASE = 'https://autodoc-parts-catalog.p.rapidapi.com';
          const KEY = process.env.RAPIDAPI_KEY;
          const r = await fetch(`${BASE}/api/articles/list/type-id/1/vehicle-id/19195/category-id/${catId}/lang-id/4`, {
            headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com' },
            signal: AbortSignal.timeout(8000)
          });
          const d = await r.json();
          const articles = (d.articles || []).slice(0, pageSize);
          if (articles.length > 0) {
            return res.json({
              success: true,
              data: articles.map(a => ({
                id: 'autodoc_' + a.articleId,
                nameKa: a.articleProductName || '',
                nameEn: a.articleProductName || '',
                brand: a.supplierName || '',
                sku: a.articleNo || '',
                price: null, stock: 1,
                images: a.s3image ? [a.s3image] : [],
                source: 'autodoc',
              })),
              pagination: { page: 1, limit: pageSize, total: articles.length, pages: 1 },
              filters: { priceRange: { min: 0, max: 9999 } },
            });
          }
        }
      } catch(ae) { console.error('Autodoc fallback:', ae.message); }
    }

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
    orderBy: [{ updatedAt:'desc' }], take: 40, include:{ category:true },
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
        { oemCodes:{ has:q } },
        { alternativeSearchKeys:{ has:q } },
        { alternativeSearchKeys:{ hasSome:[q, q.toUpperCase(), q.toLowerCase()] } },
      ],
    },
    take: 15, include:{ category:true },
  });

  let autodocFallback = [];
  const looksLikeOem = /\d/.test(q) && /^[A-Za-z0-9][A-Za-z0-9\-\.\/\s]{3,19}$/.test(q.trim());

  if (data.length === 0 && looksLikeOem) {
    try {
      const autodoc = require('../services/autodoc');
      const cleanQ = q.replace(/\s/g, '');
      const oemResult = await autodoc.getCompatibleVehiclesByOem(cleanQ);
      autodocFallback = (oemResult?.articles || []).slice(0, 10).map(a => ({
        articleId: a.articleId,
        articleNo: a.articleNo,
        productName: a.articleProductName,
        supplierName: a.supplierName,
        source: 'autodoc',
      }));
    } catch (e) { console.error('[products.search] OEM fallback:', e.message); }
  }

  res.json({ success:true, data: data.map(p => fmtProduct(p, lang)), count: data.length, autodocFallback });
});

// GET /api/products/:id/diagram
router.get('/:id/diagram', async (req, res) => {
  try {
    const p = await prisma.product.findFirst({
      where: { AND:[{ isActive:true }, { OR:[{ id:req.params.id },{ sku:req.params.id }] }] },
      select: { autodocArticleId:true }
    });
    if (!p || !p.autodocArticleId) return res.json({ success:true, items:[] });

    const axios = require('axios');
    const HEADERS = {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com',
    };

    const r = await axios.get(
      'https://autodoc-parts-catalog.p.rapidapi.com/api/articles/selecting-item-coordinators-on-the-parts-diagram-image-for-the-parts-list/article-id/' + p.autodocArticleId,
      { headers: HEADERS, timeout: 8000 }
    );

    const items = Array.isArray(r.data) ? r.data : [];
    res.json({ success:true, items });
  } catch(e) { res.json({ success:true, items:[] }); }
});

// GET /api/products/:id/media — Autodoc-იდან სრული media
router.get('/:id/media', async (req, res) => {
  try {
    const p = await prisma.product.findFirst({
      where: { AND:[{ isActive:true }, { OR:[{ id:req.params.id },{ sku:req.params.id }] }] },
      select: { alternativeSearchKeys:true, oemCodes:true, sku:true }
    });
    if (!p) return res.json({ success:true, images:[] });

    const axios = require('axios');
    const HEADERS = {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com',
    };

    // cross კოდით article ვიპოვოთ
    const codes = [...(p.alternativeSearchKeys||[]), ...(p.oemCodes||[])].slice(0,5);
    let articleId = null;

    for (const code of codes) {
      try {
        const r = await axios.get('https://autodoc-parts-catalog.p.rapidapi.com/api/artlookup/search-articles-by-article-no', {
          headers: HEADERS, params: { langId:4, articleNo: code.replace(/\s+/g,''), articleType:'ArticleNumber' }, timeout:8000
        });
        const arts = r.data?.articles;
        if (arts && arts.length > 0) { articleId = arts[0].articleId; break; }
      } catch {}
    }

    if (!articleId) return res.json({ success:true, images:[] });

    const mediaRes = await axios.get(`https://autodoc-parts-catalog.p.rapidapi.com/api/articles/article-all-media-info?langId=4&articleId=${articleId}`, {
      headers: HEADERS, timeout:8000
    });

    const images = (mediaRes.data || [])
      .filter((m) => m.articleMediaType === 'JPG' || m.articleMediaType === 'PNG' || (m.s3image && m.s3image.endsWith('.webp')))
      .map((m) => m.s3image)
      .filter(Boolean);

    res.json({ success:true, images });
  } catch(e) { res.json({ success:true, images:[] }); }
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
  } catch(e) { console.error('[products.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
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
  } catch(e) { console.error('[products.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

router.get('/:id', optionalAuth, async (req, res) => {
  const lang = req.query.lang || 'ka';
  const cacheKey = `product:${req.params.id}:${lang}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  // Autodoc product — DB-ში არ არის, API-დან ვიღებთ
  if (req.params.id.startsWith('autodoc_')) {
    const articleId = req.params.id.replace('autodoc_', '');
    try {
      const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
      const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
      const r = await fetch(`https://${HOST}/api/articles/details/article-id/${articleId}/lang-id/4`, {
        headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': HOST }
      });
      const d = await r.json();
      if (!d || d.error) return res.status(404).json({ success:false, message:'product not found' });
      // Autodoc details endpoint: { articleId, article: {...}, articleAllSpecifications, images }
      const article = d.article || (Array.isArray(d) ? d[0] : d);
      const images = (d.images || []).map(i => i.imageURL || i.url || i).filter(i => typeof i === 'string');
      const oemCodes = (d.oemNumbers || d.articleOemNumbers || []).map(o => o.oemNumber || o).filter(Boolean);
      const attrs = (d.articleAllSpecifications || d.attributes || []).map(a => ({
        name: a.criteriaName || a.name || '',
        value: a.criteriaValue || a.value || ''
      }));
      const result = {
        success: true,
        data: {
          id: req.params.id,
          nameKa: article.articleProductName || '',
          nameEn: article.articleProductName || '',
          brand: article.supplierName || '',
          sku: article.articleNo || '',
          price: null,
          stock: 1,
          images: images,
          source: 'autodoc',
          autodocArticleId: articleId,
          attributes: attrs,
          oemCodes: oemCodes,
        },
        related: [],
        oemCodes: oemCodes,
      };
      await cache.set(cacheKey, result, 1800);
      return res.json(result);
    } catch(e) {
      return res.status(404).json({ success:false, message:'product not found' });
    }
  }

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
    const { autodocCategoryId, ...rest } = req.body;
    const p = await prisma.product.create({ data: {
      brand: "", nameEn: req.body.nameKa, nameRu: req.body.nameKa, ...rest,
      price: retailPrice, b2bPrice: b2bPrice, stock: parseInt(req.body.stock)||0,
      autodocCategoryId: autodocCategoryId ? parseInt(autodocCategoryId) : null,
    } });
    res.status(201).json({ success:true, data: p });
  } catch(e) { res.status(400).json({ success:false, message: e.message }); }
});

// GET /api/products/:id/diagram
router.get('/:id/diagram', async (req, res) => {
  try {
    const p = await prisma.product.findFirst({
      where: { AND:[{ isActive:true }, { OR:[{ id:req.params.id },{ sku:req.params.id }] }] },
      select: { autodocArticleId:true }
    });
    if (!p || !p.autodocArticleId) return res.json({ success:true, items:[] });

    const axios = require('axios');
    const HEADERS = {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com',
    };

    const r = await axios.get(
      'https://autodoc-parts-catalog.p.rapidapi.com/api/articles/selecting-item-coordinators-on-the-parts-diagram-image-for-the-parts-list/article-id/' + p.autodocArticleId,
      { headers: HEADERS, timeout: 8000 }
    );

    const items = Array.isArray(r.data) ? r.data : [];
    res.json({ success:true, items });
  } catch(e) { res.json({ success:true, items:[] }); }
});

// GET /api/products/:id/media — Autodoc-იდან სრული media
router.get('/:id/media', async (req, res) => {
  try {
    const p = await prisma.product.findFirst({
      where: { AND:[{ isActive:true }, { OR:[{ id:req.params.id },{ sku:req.params.id }] }] },
      select: { alternativeSearchKeys:true, oemCodes:true, sku:true }
    });
    if (!p) return res.json({ success:true, images:[] });

    const axios = require('axios');
    const HEADERS = {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com',
    };

    // cross კოდით article ვიპოვოთ
    const codes = [...(p.alternativeSearchKeys||[]), ...(p.oemCodes||[])].slice(0,5);
    let articleId = null;

    for (const code of codes) {
      try {
        const r = await axios.get('https://autodoc-parts-catalog.p.rapidapi.com/api/artlookup/search-articles-by-article-no', {
          headers: HEADERS, params: { langId:4, articleNo: code.replace(/\s+/g,''), articleType:'ArticleNumber' }, timeout:8000
        });
        const arts = r.data?.articles;
        if (arts && arts.length > 0) { articleId = arts[0].articleId; break; }
      } catch {}
    }

    if (!articleId) return res.json({ success:true, images:[] });

    const mediaRes = await axios.get(`https://autodoc-parts-catalog.p.rapidapi.com/api/articles/article-all-media-info?langId=4&articleId=${articleId}`, {
      headers: HEADERS, timeout:8000
    });

    const images = (mediaRes.data || [])
      .filter((m) => m.articleMediaType === 'JPG' || m.articleMediaType === 'PNG' || (m.s3image && m.s3image.endsWith('.webp')))
      .map((m) => m.s3image)
      .filter(Boolean);

    res.json({ success:true, images });
  } catch(e) { res.json({ success:true, images:[] }); }
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
  } catch(e) { console.error('[products.js]', e); res.status(400).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// PUT /api/products/:id (admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { nameKa, nameEn, nameRu, brand, articleNumber, price, stock, description, isActive, images, autodocCategoryId } = req.body;
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
    if (autodocCategoryId !== undefined) updateData.autodocCategoryId = autodocCategoryId ? parseInt(autodocCategoryId) : null;
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


// GET /api/products/:id/diagram
router.get('/:id/diagram', async (req, res) => {
  try {
    const p = await prisma.product.findFirst({
      where: { AND:[{ isActive:true }, { OR:[{ id:req.params.id },{ sku:req.params.id }] }] },
      select: { autodocArticleId:true }
    });
    if (!p || !p.autodocArticleId) return res.json({ success:true, items:[] });

    const axios = require('axios');
    const HEADERS = {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com',
    };

    const r = await axios.get(
      'https://autodoc-parts-catalog.p.rapidapi.com/api/articles/selecting-item-coordinators-on-the-parts-diagram-image-for-the-parts-list/article-id/' + p.autodocArticleId,
      { headers: HEADERS, timeout: 8000 }
    );

    const items = Array.isArray(r.data) ? r.data : [];
    res.json({ success:true, items });
  } catch(e) { res.json({ success:true, items:[] }); }
});

// GET /api/products/:id/media — Autodoc-იდან სრული media
router.get('/:id/media', async (req, res) => {
  try {
    const p = await prisma.product.findFirst({
      where: { AND:[{ isActive:true }, { OR:[{ id:req.params.id },{ sku:req.params.id }] }] },
      select: { alternativeSearchKeys:true, oemCodes:true, sku:true }
    });
    if (!p) return res.json({ success:true, images:[] });

    const axios = require('axios');
    const HEADERS = {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com',
    };

    // cross კოდით article ვიპოვოთ
    const codes = [...(p.alternativeSearchKeys||[]), ...(p.oemCodes||[])].slice(0,5);
    let articleId = null;

    for (const code of codes) {
      try {
        const r = await axios.get('https://autodoc-parts-catalog.p.rapidapi.com/api/artlookup/search-articles-by-article-no', {
          headers: HEADERS, params: { langId:4, articleNo: code.replace(/\s+/g,''), articleType:'ArticleNumber' }, timeout:8000
        });
        const arts = r.data?.articles;
        if (arts && arts.length > 0) { articleId = arts[0].articleId; break; }
      } catch {}
    }

    if (!articleId) return res.json({ success:true, images:[] });

    const mediaRes = await axios.get(`https://autodoc-parts-catalog.p.rapidapi.com/api/articles/article-all-media-info?langId=4&articleId=${articleId}`, {
      headers: HEADERS, timeout:8000
    });

    const images = (mediaRes.data || [])
      .filter((m) => m.articleMediaType === 'JPG' || m.articleMediaType === 'PNG' || (m.s3image && m.s3image.endsWith('.webp')))
      .map((m) => m.s3image)
      .filter(Boolean);

    res.json({ success:true, images });
  } catch(e) { res.json({ success:true, images:[] }); }
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


// B2B Pricing middleware
function applyB2BPricing(product, user) {
  if (!product || !user) return product;
  const role = user.role;
  const tier = user.b2bTier || 'STANDARD';
  const discount = user.b2bDiscount || 0;
  
  let finalPrice = product.price;
  
  if (role === 'WHOLESALE' || tier === 'WHOLESALE') {
    finalPrice = product.wholesalePrice || product.price;
  } else if (role === 'DEALER' || tier === 'DEALER') {
    finalPrice = product.dealerPrice || product.price;
  } else if (discount > 0) {
    finalPrice = product.price * (1 - discount / 100);
  }
  
  return { ...product, price: finalPrice, retailPrice: product.price };
}

module.exports.applyB2BPricing = applyB2BPricing;
