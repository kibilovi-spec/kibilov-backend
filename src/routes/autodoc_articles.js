'use strict';
const express = require('express');
const router = express.Router();
const axios = require('axios');
const redis = require('redis');
const { Pool } = require('pg');
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
const redisClient = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.connect().catch(() => {});

const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const BASE = `https://${HOST}`;
const HEADERS = {
  'x-rapidapi-key': process.env.RAPIDAPI_KEY,
  'x-rapidapi-host': HOST,
};

// GET /api/autodoc/articles?vehicleId=12487&categoryId=100030
router.get('/articles', async (req, res) => {
  try {
    const { vehicleId, categoryId } = req.query;
    if (!categoryId) return res.json({ success: true, data: [] });
    const cacheKey = `articles:${categoryId}:${vehicleId||'default'}`;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json({ success: true, data: JSON.parse(cached), cached: true });
    } catch {}
    // slug → numeric id კონვერტაცია
    let catId = categoryId;
    if (isNaN(parseInt(categoryId))) {
      try {
        const r = await pgPool.query('SELECT autodoc_id FROM autodoc_categories WHERE slug=$1 LIMIT 1', [categoryId]);
        if (r.rows.length > 0) catId = r.rows[0].autodoc_id;
        else return res.json({ success: true, data: [] });
      } catch { return res.json({ success: true, data: [] }); }
    }

    let data;

    if (!vehicleId) {
      // ვეჰიკლის გარეშე — ადრე ჰარდქოდირებული ერთი მანქანა (#19942) გამოიყენებოდა,
      // რაც კატეგორიის მთელი ასორტიმენტის ნაცვლად მხოლოდ ერთი მანქანის თავსებადობას
      // აჩვენებდა. ახლა ვიყენებთ ჩვენს საკუთარ, მრავალ-მარკიან reference-ცხრილს.
      const refRows = await pgPool.query(
        `SELECT DISTINCT ON (article_id) article_id, article_code, brand, description, image_url, oem_codes
         FROM autodoc_reference_data
         WHERE autodoc_category_id = $1 AND article_id IS NOT NULL
         ORDER BY article_id, id
         LIMIT 50`,
        [parseInt(catId)]
      );
      data = refRows.rows.map((a) => ({
        id: 'autodoc_' + a.article_id,
        sku: a.article_code || '',
        nameEn: a.description || '',
        nameKa: a.description || '',
        brand: a.brand || '',
        images: a.image_url ? [a.image_url] : [],
        price: null,
        stock: 1,
        source: 'reference_data',
        oemCodes: a.oem_codes ? a.oem_codes.split(',') : [],
        autodocArticleId: Number(a.article_id),
        descriptionEn: '',
      }));
    } else {
      const r = await axios.get(
        `https://autodoc-parts-catalog.p.rapidapi.com/api/articles/list/type-id/1/vehicle-id/${vehicleId}/category-id/${catId}/lang-id/4`,
        { headers: HEADERS, timeout: 10000 }
      );
      const arts = r.data?.articles || [];
      data = arts.map((a) => ({
        id: 'autodoc_' + a.articleId,
        sku: a.articleNo,
        nameEn: a.articleProductName,
        nameKa: a.articleProductName,
        brand: a.supplierName,
        images: a.s3image ? [a.s3image] : [],
        price: null,
        stock: 1,
        source: 'autodoc',
        oemCodes: [a.articleNo],
        autodocArticleId: a.articleId,
        descriptionEn: (a.articleAllSpecifications||[]).map(s=>s.criteriaName+': '+s.criteriaValue).join('\n'),
      }));
    }

    if (data.length > 0) { try { await redisClient.setEx(cacheKey, 3600, JSON.stringify(data)); } catch {} }
    res.json({ success: true, data });
  } catch(e) {
    res.json({ success: true, data: [] });
  }
});

// GET /api/autodoc/featured — homepage + /products
router.get('/featured', async (req, res) => {
  try {
    try {
      const cached = await redisClient.get('featured:default');
      if (cached) return res.json({ success: true, data: JSON.parse(cached), cached: true });
    } catch {}
    const CATEGORY_IDS = [100259, 100260, 100263, 100034, 100003, 100028, 100016, 100030, 100032, 100001, 100011];
    const refRows = await pgPool.query(
      `SELECT DISTINCT ON (article_id) article_id, article_code, brand, description, image_url, oem_codes
       FROM autodoc_reference_data
       WHERE autodoc_category_id = ANY($1::int[]) AND article_id IS NOT NULL
       ORDER BY article_id, id
       LIMIT 40`,
      [CATEGORY_IDS]
    );
    const results = refRows.rows.map((a) => ({
      id: 'autodoc_' + a.article_id,
      sku: a.article_code || '',
      nameEn: a.description || '',
      nameKa: a.description || '',
      brand: a.brand || '',
      images: a.image_url ? [a.image_url] : [],
      price: null,
      stock: 1,
      source: 'reference_data',
      oemCodes: a.oem_codes ? a.oem_codes.split(',') : [],
      autodocArticleId: Number(a.article_id),
    }));

    if (results.length > 0) { try { await redisClient.setEx('featured:default', 7200, JSON.stringify(results)); } catch {} }
    res.json({ success: true, data: results });
  } catch(e) {
    res.json({ success: true, data: [] });
  }
});

// GET /api/autodoc/article/:articleId — single article details
router.get('/article/:articleId', async (req, res) => {
  try {
    const { articleId } = req.params;
    const r = await axios.get(
      `https://autodoc-parts-catalog.p.rapidapi.com/api/articles/details/article-id/${articleId}/lang-id/4`,
      { headers: HEADERS, timeout: 10000 }
    );
    const d = r.data;
    if (!d || !d.article) return res.json({ success: false, data: null });

    const specs = {};
    for (const s of d.articleAllSpecifications || []) {
      specs[s.criteriaName] = s.criteriaValue;
    }

    const product = {
      id: 'autodoc_' + articleId,
      sku: d.article.articleNo,
      nameEn: d.article.articleProductName,
      nameKa: d.article.articleProductName,
      brand: d.article.supplierName,
      images: [],
      price: null,
      stock: 1,
      source: 'autodoc',
      oemCodes: (d.articleOemNo || []).map((o) => o.oemDisplayNo).filter(Boolean),
      descriptionEn: Object.entries(specs).map(([k,v]) => k+': '+v).join('\n'),
      autodocArticleId: Number(articleId),
    };

    // სურათი
    try {
      const mr = await axios.get(
        `https://autodoc-parts-catalog.p.rapidapi.com/api/articles/article-all-media-info?langId=4&articleId=${articleId}`,
        { headers: HEADERS, timeout: 8000 }
      );
      const imgs = (mr.data || []).filter((m) => m.s3image && !m.s3image.toLowerCase().includes('.pdf') && (m.mediaInformation === 'Photo' || m.s3image.match(/\.(webp|jpg|jpeg|png)$/i))).map((m) => m.s3image);
      product.images = imgs;
    } catch {}

    res.json({ success: true, data: product });
  } catch(e) {
    res.json({ success: false, data: null });
  }
});

module.exports = router;

// GET /api/autodoc/by-brand?brand=TRW&categoryId=100030(optional)
const BRAND_SUPPLIER_MAP = {
  'TRW': 161, 'BOSCH': 30, 'NGK': 15, 'KYB': 85, 'MEYLE': 144,
  'SACHS': 32, 'DAYCO': 42, 'VALEO': 21, 'MAHLE': 287, 'CASTROL': 207,
  'DENSO': 66, 'LIQUI MOLY': 222, 'MANN': 4, 'FEBI': 101, 'MANN-FILTER': 4,
  'KYB': 85, 'MEYLE': 144, 'BREMBO': 12, 'HELLA': 25, 'GATES': 39
};
router.get('/by-brand', async (req, res) => {
  const { brand, categoryId, vehicleId } = req.query;
  if (!brand) return res.json({ success: true, data: [] });
  const supplierId = BRAND_SUPPLIER_MAP[brand.toUpperCase()] || BRAND_SUPPLIER_MAP[brand];
  if (!supplierId) return res.json({ success: true, data: [], message: 'supplier not found' });
  const cacheKey = `brand:${brand.toUpperCase()}:${vehicleId||'default'}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json({ success: true, data: JSON.parse(cached), cached: true });
  } catch {}
  try {
    const vid = vehicleId || '19942';
    const categories = categoryId ? [categoryId] : ['100030','100259','100260','100032','100011','100002','100006','100016','100008','100010','100214'];
    const brandUp = brand.toUpperCase();
    const ALIASES = {'MANN': 'MANN-FILTER', 'FEBI': 'FEBI BILSTEIN'};
    const targetBrand = ALIASES[brandUp] || brandUp;
    const results = await Promise.all(categories.map(async catId => {
      try {
        const _r = await axios.get(`${BASE}/api/articles/list/type-id/1/vehicle-id/${vid}/category-id/${catId}/lang-id/4`, { headers: HEADERS, timeout: 12000 });
        return (_r.data?.articles || []).filter(a => {
          const s = (a.supplierName || '').toUpperCase();
          return s === brandUp || s === targetBrand;
        });
      } catch { return []; }
    }));
    let arts = results.flat();
    const data = arts.slice(0, 20).map(a => ({
      id: 'autodoc_' + a.articleId,
      sku: a.articleNo,
      nameEn: a.articleProductName,
      nameKa: a.articleProductName,
      brand: a.supplierName,
      images: a.s3image ? [a.s3image] : [],
      price: null, stock: 1, source: 'autodoc',
      autodocArticleId: a.articleId,
    }));
    if (data.length > 0) { try { await redisClient.setEx(cacheKey, 3600, JSON.stringify(data)); } catch {} }
    res.json({ success: true, data });
  } catch(e) { res.json({ success: true, data: [] }); }
});
