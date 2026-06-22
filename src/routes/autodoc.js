const router = require('express').Router();
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const BASE = `https://${HOST}`;
const headers = () => ({ 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': HOST });

// GET /api/autodoc/oem?code=04465-33480
router.get('/oem', async (req, res) => {
  const { code } = req.query;
  if (!code || !RAPIDAPI_KEY) return res.status(400).json({ error: 'code required' });
  try {
    let d, arr = [];
    for (const atype of ['OENumber', 'ArticleNumber', 'IAMNumber']) {
      const r = await fetch(`${BASE}/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(code)}&articleType=${atype}`, { headers: headers() });
      d = await r.json();
      arr = Array.isArray(d) ? d : (d.articles || []);
      if (arr.length) break;
    }
    res.json({ found: arr.length > 0, oem: code, count: d.countArticles || arr.length,
      articles: arr.slice(0,20).map(a => ({ brand: a.supplierName||'', code: a.articleNo||'', desc: a.articleProductName||'', articleId: a.articleId, image: a.s3image||null })).filter(a=>a.code)
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/crossref?code=04465-33480
router.get('/crossref', async (req, res) => {
  const { code } = req.query;
  if (!code || !RAPIDAPI_KEY) return res.status(400).json({ error: 'code required' });
  try {
    const r = await fetch(`${BASE}/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(code)}&articleType=OENumber`, { headers: headers() });
    const d = await r.json();
    const arr = Array.isArray(d) ? d : (d.articles || []);
    res.json({ found: arr.length > 0, oem: code, count: d.countArticles || arr.length,
      articles: arr.slice(0,20).map(a => ({ brand: a.supplierName||'', code: a.articleNo||'', desc: a.articleProductName||'', articleId: a.articleId, image: a.s3image||null })).filter(a=>a.code)
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/vin?vin=WDBFA68F42F202731
router.get('/vin', async (req, res) => {
  const { vin } = req.query;
  if (!vin || !RAPIDAPI_KEY) return res.status(400).json({ error: 'vin required' });
  try {
    const r = await fetch(`${BASE}/api/vin/decoder-v5/${encodeURIComponent(vin)}`, { headers: headers() });
    const d = await r.json();
    res.json({ vin, data: d });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/manufacturers
router.get('/manufacturers', async (req, res) => {
  if (!RAPIDAPI_KEY) return res.status(500).json({ error: 'API not configured' });
  try {
    const r = await fetch(`${BASE}/api/manufacturers/list/type-id/1`, { headers: headers() });
    const d = await r.json();
    res.json({ manufacturers: d.manufacturers || d || [] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/models?manufacturerId=111
router.get('/models', async (req, res) => {
  const { manufacturerId } = req.query;
  if (!manufacturerId || !RAPIDAPI_KEY) return res.status(400).json({ error: 'manufacturerId required' });
  try {
    const r = await fetch(`${BASE}/api/models/list/type-id/1/manufacturer-id/${manufacturerId}/lang-id/4/country-filter-id/63`, { headers: headers() });
    const d = await r.json();
    res.json({ models: Array.isArray(d) ? d : [] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/vehicles?modelId=5813
router.get('/vehicles', async (req, res) => {
  const { modelId } = req.query;
  if (!modelId || !RAPIDAPI_KEY) return res.status(400).json({ error: 'modelId required' });
  try {
    const r = await fetch(`${BASE}/api/types/type-id/1/list-vehicles-types/${modelId}/lang-id/4/country-filter-id/63`, { headers: headers() });
    const d = await r.json();
    const vehicles = d.modelTypes || [];
    res.json({ vehicles });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/parts?vehicleId=20332&categoryId=100260
router.get('/parts', async (req, res) => {
  const { vehicleId, categoryId } = req.query;
  if (!vehicleId || !categoryId || !RAPIDAPI_KEY) return res.status(400).json({ error: 'vehicleId and categoryId required' });
  try {
    // 1. Autodoc-იდან articles ვიღებთ
    const r = await fetch(`${BASE}/api/articles/list/type-id/1/vehicle-id/${vehicleId}/category-id/${categoryId}/lang-id/4`, { headers: headers() });
    const d = await r.json();
    let articles = d.articles || [];


    // 2. ყველა კოდი ვაგროვებთ DB-ის მოსაძებნად
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const results = await Promise.all(articles.slice(0, 30).map(async (a) => {
      const articleOems = (a.oems||[]).flatMap(o => [o.oemDisplayNo, o.oemDisplayNo?.replace(/\s/g,'')]).filter(Boolean);
      const codes = [...new Set([a.articleNo, a.articleNo?.replace(/\s/g,''), ...articleOems].filter(Boolean))];
      // DB-ში ვეძებთ
      const dbProduct = await prisma.product.findFirst({
        where: {
          isActive: true,
          OR: [
            { oemCodes: { hasSome: codes } },
            { alternativeSearchKeys: { hasSome: codes } },
            { sku: { in: codes } }
          ]
        },
        select: { id: true, nameKa: true, nameEn: true, price: true, stock: true, images: true, sku: true, oemCodes: true }
      });

      return {
        articleId: a.articleId || null,
        articleProductName: a.articleProductName || '',
        image: a.s3image || null,
        code: a.articleNo || '',
        brand: a.supplierName || '',
        inStock: !!dbProduct,
        product: dbProduct ? {
          id: dbProduct.id,
          nameKa: dbProduct.nameKa,
          nameEn: dbProduct.nameEn,
          price: dbProduct.price,
          stock: dbProduct.stock,
          images: dbProduct.images,
          sku: dbProduct.sku,
          altCodes: dbProduct.oemCodes?.slice(0,3) || []
        } : null
      };
    }));

    await prisma.$disconnect();

    // DB-ში მყოფი პირველ ადგილზე
    results.sort((a, b) => (b.inStock ? 1 : 0) - (a.inStock ? 1 : 0));

    // duplicates გამოვრიცხოთ
    const seen = new Set();
    const deduped = results.filter(r => {
      if (r.inStock && r.product) {
        if (seen.has(r.product.id)) return false;
        seen.add(r.product.id);
      }
      return true;
    });
    deduped.sort((a, b) => (b.inStock ? 1 : 0) - (a.inStock ? 1 : 0));
    res.set('Cache-Control', 'no-store');
    res.json({
      vehicleId, categoryId,
      count: d.countArticles || articles.length,
      articles: deduped
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/search?make=toyota&part=oil+filter
router.get('/search', async (req, res) => {
  const { make, part } = req.query;
  if (!make || !part || !RAPIDAPI_KEY) return res.status(400).json({ error: 'make and part required' });
  try {
    const mfgR = await fetch(`${BASE}/api/manufacturers/list/type-id/1`, { headers: headers() });
    const mfgD = await mfgR.json();
    const mfgArr = Array.isArray(mfgD) ? mfgD : (mfgD.manufacturers || mfgD.data || []);
    const mfg = mfgArr.find(m => (m.manufacturerName||'').toLowerCase() === make.toLowerCase());
    if (!mfg) return res.json({ found: false, articles: [] });
    const partsR = await fetch(`${BASE}/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(part)}&articleType=ArticleNumber`, { headers: headers() });
    const partsD = await partsR.json();
    const arr = partsD.articles || [];
    res.json({ found: arr.length > 0, make, part, articles: arr.slice(0,10).map(a => ({ brand: a.supplierName||'', code: a.articleNo||'', desc: a.articleProductName||'' })) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// GET /api/autodoc/categories?vehicleId=20332
router.get('/categories', async (req, res) => {
  const { vehicleId } = req.query;
  if (!vehicleId || !RAPIDAPI_KEY) return res.status(400).json({ error: 'vehicleId required' });
  const cacheKey = `categories:${vehicleId}`;
  try {
    const cache = require('../services/cache');
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(Object.assign({}, cached, { cached: true }));
    }
    let d = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
      const r = await fetch(`${BASE}/api/category/type-id/1/products-groups-variant-2/${vehicleId}/lang-id/4`, { headers: headers() });
      d = await r.json();
      if (!d.error) break;
    }
    // variant-2 სტრუქტურა: {categories: {name: {categoryId, categoryName, children: {}}}}
    const catsObj = (d && d.categories) || {};
    const unique = {};
    Object.values(catsObj).forEach((cat) => {
      const c = cat;
      if (c.categoryId) {
        unique[c.categoryId] = { id: c.categoryId, name: c.categoryName, parent: null, parentId: null, imageUrl: `/images/categories/${c.categoryId}.png` };
      }
      // children
      Object.values(c.children || {}).forEach((child) => {
        if (child.categoryId) {
          unique[child.categoryId] = { id: child.categoryId, name: child.categoryName, parent: c.categoryName, parentId: c.categoryId, imageUrl: `/images/categories/${child.categoryId}.png` };
        }
      });
    });

    // ქართული თარგმანების დამატება ლოკალური autodoc_categories ცხრილიდან
    try {
      const ids = Object.keys(unique).map(Number);
      if (ids.length) {
        const { PrismaClient } = require('@prisma/client');
        const prismaCat = new PrismaClient();
        const rows = await prismaCat.$queryRaw`
          SELECT autodoc_id, name_ka FROM autodoc_categories
          WHERE autodoc_id = ANY(${ids})
        `;
        await prismaCat.$disconnect();
        const nameKaById = {};
        rows.forEach(r => { if (r.name_ka) nameKaById[r.autodoc_id] = r.name_ka; });
        Object.values(unique).forEach((item) => {
          if (nameKaById[item.id]) item.name = nameKaById[item.id];
          if (item.parentId && nameKaById[item.parentId]) item.parent = nameKaById[item.parentId];
        });
      }
    } catch (e) {
      // თარგმანის შეცდომისას — ინგლისურით ვაგრძელებთ, საერთო endpoint არ ვტეხთ
    }

    const responseBody = { vehicleId, count: Object.keys(unique).length, categories: Object.values(unique) };
    const cache2 = require('../services/cache');
    await cache2.set(cacheKey, responseBody, cache2.TTL.VEHICLE);
    res.json(responseBody);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/article?articleId=61981
router.get('/article', async (req, res) => {
  const { articleId } = req.query;
  if (!articleId || !RAPIDAPI_KEY) return res.status(400).json({ error: 'articleId required' });
  try {
    const r = await fetch(`${BASE}/api/articles/details/article-id/${articleId}/lang-id/4`, { headers: headers() });
    const d = await r.json();
    res.json({ articleId, detail: d });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/byCategory?vehicleId=20332&categoryEn=Oil+Filter
router.get('/byCategory', async (req, res) => {
  const { vehicleId, categoryEn } = req.query;
  if (!vehicleId || !categoryEn || !RAPIDAPI_KEY) return res.status(400).json({ error: 'vehicleId and categoryEn required' });
  try {
    const mapping = require('../services/categoryMapping');
    const autodocIds = mapping[categoryEn];
    if (!autodocIds || autodocIds.length === 0) return res.json({ found: false, categoryEn, articles: [] });
    
    const allArticles = [];
    for (const catId of autodocIds.slice(0, 3)) {
      const r = await fetch(`${BASE}/api/articles/list/type-id/1/vehicle-id/${vehicleId}/category-id/${catId}/lang-id/4`, { headers: headers() });
      const d = await r.json();
      const arts = (d.articles || []).map(a => ({ brand: a.supplierName||'', code: a.articleNo||'', desc: a.articleProductName||'', articleId: a.articleId, image: a.s3image||null, categoryId: catId }));
      allArticles.push(...arts);
    }
    
    const seen = new Set();
    const unique = allArticles.filter(a => { if(seen.has(a.code)) return false; seen.add(a.code); return true; });
    res.json({ found: unique.length > 0, categoryEn, vehicleId, count: unique.length, articles: unique.slice(0, 20) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/byCategoryName?make=toyota&model=camry&year=2008&categoryEn=Oil+Filter
router.get('/byCategoryName', async (req, res) => {
  const { make, model, year, categoryEn } = req.query;
  if (!make || !categoryEn || !RAPIDAPI_KEY) return res.status(400).json({ error: 'make and categoryEn required' });
  try {
    const { PrismaClient } = require("@prisma/client");
    const prismaC = new PrismaClient();
    const yearNum = parseInt(year) || 2010;
    const makeLow = (make||"").toLowerCase();
    const modelLow = (model||"").toLowerCase();
    let vehicleId = null;
    const cached = await prismaC.autodocVehicleCache.findFirst({ where: { make: makeLow, model: modelLow, year: yearNum } });
    if (cached) {
      vehicleId = cached.vehicleId;
      await prismaC.$disconnect();
    } else {
      // 1. manufacturer lookup
      const mfgR = await fetch(`${BASE}/api/manufacturers/list/type-id/1`, { headers: headers() });
      const mfgD = await mfgR.json();
      const mfgArr = Array.isArray(mfgD) ? mfgD : (mfgD.manufacturers || mfgD.data || []);
      const mfg = mfgArr.find(m => (m.manufacturerName||'').toLowerCase() === make.toLowerCase());
      if (!mfg) return res.json({ found: false, articles: [] });
      // 2. model lookup
      const modR = await fetch(`${BASE}/api/models/list/type-id/1/manufacturer-id/${mfg.manufacturerId}/lang-id/4/country-filter-id/63`, { headers: headers() });
      const modD = await modR.json();
      const modArr = Array.isArray(modD) ? modD : (modD.models || []);
      const mod = modArr.find(m => {
        const name = (m.modelName||'').toLowerCase();
        const from = new Date(m.modelYearFrom).getFullYear();
        const toYear = m.modelYearTo || null;
        const to = toYear ? new Date(toYear).getFullYear() : 2030;
        return name.includes(modelLow) && yearNum >= from && yearNum <= to;
      });
      if (!mod) return res.json({ found: false, make, model, articles: [] });
      // 3. vehicles lookup
      const vehR = await fetch(`${BASE}/api/types/type-id/1/list-vehicles-types/${mod.modelId}/lang-id/4/country-filter-id/63`, { headers: headers() });
      const vehD = await vehR.json();
      const vehicles = vehD.modelTypes || [];
      if (!vehicles.length) return res.json({ found: false, articles: [] });
      vehicleId = vehicles[0].vehicleId;
      try { await prismaC.autodocVehicleCache.create({ data: { make: makeLow, model: modelLow, year: yearNum, vehicleId, modelId: mod.modelId, manufacturerId: mfg.manufacturerId, engineName: vehicles[0].typeEngineName||null } }); } catch(ce) {}
      await prismaC.$disconnect();
    }
    // 4. category mapping
    const mapping = require('../services/categoryMapping');
    const autodocIds = mapping[categoryEn];
    if (!autodocIds?.length) return res.json({ found: false, categoryEn, articles: [] });
    // 5. parts lookup
    const allArticles = [];
    for (const catId of autodocIds.slice(0, 3)) {
      const r = await fetch(`${BASE}/api/articles/list/type-id/1/vehicle-id/${vehicleId}/category-id/${catId}/lang-id/4`, { headers: headers() });
      const d = await r.json();
      const arts = (d.articles || []).map(a => ({ brand: a.supplierName||'', code: a.articleNo||'', desc: a.articleProductName||'', image: a.s3image||null }));
      allArticles.push(...arts);
    }
    const seen = new Set();
    const unique = allArticles.filter(a => { if(seen.has(a.code)) return false; seen.add(a.code); return true; });
    res.json({ found: unique.length > 0, make, model, year, categoryEn, vehicleId, count: unique.length, articles: unique.slice(0, 15) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/autodoc/checkCodes — check which OEM codes exist in our DB
router.post('/checkCodes', async (req, res) => {
  try {
    const { codes } = req.body;
    if (!codes?.length) return res.json({ found: {} });
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const results = {};
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { oemCodes: { hasSome: codes } },
          { alternativeSearchKeys: { hasSome: codes } },
          { sku: { in: codes } }
        ]
      },
      select: { id: true, nameKa: true, sku: true, price: true, stock: true, images: true, oemCodes: true, alternativeSearchKeys: true }
    });
    for (const code of codes) {
      const match = products.find(p =>
        (p.oemCodes||[]).some(c => c.toUpperCase() === code.toUpperCase()) ||
        (p.alternativeSearchKeys||[]).some(c => c.toUpperCase() === code.toUpperCase()) ||
        p.sku?.toUpperCase() === code.toUpperCase()
      );
      if (match) results[code] = { id: match.id, nameKa: match.nameKa, sku: match.sku, price: match.price, stock: match.stock, image: match.images?.[0] || null };
    }
    await prisma.$disconnect();
    res.json({ found: results });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/crossref-and-check?articleNo=GDB3445
router.get('/crossref-and-check', async (req, res) => {
  try {
    const { articleNo } = req.query;
    if (!articleNo || !RAPIDAPI_KEY) return res.status(400).json({ error: 'articleNo required' });
    const r = await fetch(`${BASE}/api/artlookup/search-for-analog-spare-parts-by-the-articles-numbers/lang-id/4/articleNo/${encodeURIComponent(articleNo)}`, { headers: headers() });
    const d = await r.json();
    if (!d.articles?.length) return res.json({ found: false, inStock: {} });
    const codes = d.articles.map((a) => a.articleNo).filter(Boolean);
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const products = await prisma.product.findMany({
      where: { OR: [{ oemCodes: { hasSome: codes } }, { alternativeSearchKeys: { hasSome: codes } }, { sku: { in: codes } }] },
      select: { id: true, nameKa: true, sku: true, price: true, stock: true, images: true, oemCodes: true, alternativeSearchKeys: true }
    });
    const inStock = {};
    for (const code of codes) {
      const match = products.find(p =>
        (p.oemCodes||[]).some(c => c.toUpperCase() === code.toUpperCase()) ||
        (p.alternativeSearchKeys||[]).some(c => c.toUpperCase() === code.toUpperCase()) ||
        p.sku?.toUpperCase() === code.toUpperCase()
      );
      if (match) inStock[code] = { id: match.id, nameKa: match.nameKa, sku: match.sku, price: match.price, stock: match.stock, image: match.images?.[0] || null };
    }
    await prisma.$disconnect();
    res.json({ found: Object.keys(inStock).length > 0, total: d.countArticles, inStock });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/vin/check/:vin
router.get('/vin/check/:vin', async (req, res) => {
  if (!RAPIDAPI_KEY) return res.status(400).json({ error: 'RAPIDAPI_KEY missing' });
  try {
    const r = await fetch(`${BASE}/api/vin/tecdoc-vin-check/${req.params.vin}`, { headers: headers() });
    const d = await r.json();
    res.json(d);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/vin/decode/:vin
router.get('/vin/decode/:vin', async (req, res) => {
  if (!RAPIDAPI_KEY) return res.status(400).json({ error: 'RAPIDAPI_KEY missing' });
  try {
    const r = await fetch(`${BASE}/api/vin/decode-v3/${req.params.vin}`, { headers: headers() });
    const d = await r.json();
    res.json(d);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/manufacturers
router.get('/manufacturers', async (req, res) => {
  const typeId = req.query.typeId || 1;
  if (!RAPIDAPI_KEY) return res.status(400).json({ error: 'RAPIDAPI_KEY missing' });
  try {
    const r = await fetch(`${BASE}/api/manufacturers/list/type-id/${typeId}`, { headers: headers() });
    const d = await r.json();
    res.json(d);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/models/:manuId
router.get('/models/:manuId', async (req, res) => {
  const typeId = req.query.typeId || 1;
  if (!RAPIDAPI_KEY) return res.status(400).json({ error: 'RAPIDAPI_KEY missing' });
  try {
    const r = await fetch(`${BASE}/api/models/list/type-id/${typeId}/manufacturer-id/${req.params.manuId}/lang-id/4/country-filter-id/63`, { headers: headers() });
    const d = await r.json();
    res.json(d);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/vehicle-ids/:modelId
router.get('/vehicle-ids/:modelId', async (req, res) => {
  if (!RAPIDAPI_KEY) return res.status(400).json({ error: 'RAPIDAPI_KEY missing' });
  try {
    const r = await fetch(`${BASE}/api/types/type-id/1/list-vehicles-id/${req.params.modelId}/lang-id/4/country-filter-id/63`, { headers: headers() });
    const d = await r.json();
    res.json(d);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/categories/:vehicleId
router.get('/categories/:vehicleId', async (req, res) => {
  const { typeId=1, langId=4 } = req.query;
  if (!RAPIDAPI_KEY) return res.status(400).json({ error: 'RAPIDAPI_KEY missing' });
  try {
    const r = await fetch(`${BASE}/api/articles/list-categories-v3/type-id/${typeId}/vehicle-id/${req.params.vehicleId}/lang-id/${langId}`, { headers: headers() });
    const d = await r.json();
    res.json(d);
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// GET /api/autodoc/cross-refs?oem=xxx
router.get('/cross-refs', async (req, res) => {
  const { oem } = req.query;
  if (!oem) return res.status(400).json({ error: 'oem required', refs: [] });
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const cleanOem = oem.replace(/[\s\-\.]/g,'').toUpperCase();
    const dbRefs = await prisma.$queryRaw`
      SELECT article_number, brand FROM cross_reference
      WHERE oem_code = ${cleanOem} LIMIT 20
    `;
    await prisma.$disconnect();
    if (dbRefs.length > 0) return res.json({ refs: dbRefs, source: 'db' });

    const autodoc = require('../services/autodoc');
    const results = await autodoc.searchOemByNo(oem);
    const articles = (results || []).slice(0, 10).map(a => ({
      article_number: a.articleNo,
      brand: a.supplierName || a.manufacturerName
    }));
    res.json({ refs: articles, source: 'autodoc' });
  } catch(e) { res.json({ refs: [], error: e.message }); }
});

// GET /api/autodoc/compatible-cars?oem=xxx
router.get('/compatible-cars', async (req, res) => {
  const { oem } = req.query;
  if (!oem) return res.status(400).json({ error: 'oem required', vehicles: [] });
  try {
    // 1. articleId და supplierId ვიპოვოთ — ArticleNumber ან OENumber
    let arts0 = [];
    for (const atype of ['ArticleNumber', 'OENumber']) {
      const r0 = await fetch(`${BASE}/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(oem)}&articleType=${atype}`, { headers: headers() });
      const d0 = await r0.json();
      arts0 = d0.articles || (Array.isArray(d0) ? d0 : []);
      if (arts0.length) break;
    }
    if (!arts0.length) return res.json({ vehicles: [], total: 0 });
    const { supplierId, articleNo } = arts0[0];
    // 2. compatible cars
    const r = await fetch(`${BASE}/api/articles/get-compatible-cars-by-article-number/type-id/1?langId=4&supplierId=${supplierId}&articleNo=${encodeURIComponent(articleNo)}&countryFilterId=63`, { headers: headers() });
    const d = await r.json();
    const vehicles = (d.articles?.[0]?.compatibleCars) || [];
    res.json({ vehicles: vehicles.slice(0,30).map(c => ({
      vehicleId: c.vehicleId,
      make: c.manufacturerName,
      model: c.modelName,
      engine: c.typeEngineName,
      yearFrom: c.constructionIntervalStart?.substring(0,4) || null,
      yearTo: c.constructionIntervalEnd?.substring(0,4) || null,
    })), total: vehicles.length });
  } catch(e) { res.json({ vehicles: [], error: e.message }); }
});

// GET /api/autodoc/car-image?make=skoda&model=fabia
router.get('/car-image', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const { make, model } = req.query;
  if (!make) return res.status(400).json({ error: 'make required' });
  const m = make.toLowerCase().replace(/\s+/g,'-');
  const modFirst = (model||'').toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g,'');
  const cacheKey = `${m}_${modFirst}`;
  const cacheDir = '/var/www/kibilov-frontend/public/images/cars';
  const cachePath = `${cacheDir}/${cacheKey}.jpg`;
  
  // cache-ში გვაქვს?
  if (fs.existsSync(cachePath)) {
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.sendFile(cachePath);
  }
  
  fs.mkdirSync(cacheDir, { recursive: true });
  
  const urls = [
    `https://media.autodoc.eu/images/cars/${m}/${modFirst}/${m}_${modFirst}.jpg`,
    `https://media.autodoc.eu/images/cars/${m}/${m}.jpg`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 1000) {
          fs.writeFileSync(cachePath, buf);
          res.set('Content-Type', 'image/jpeg');
          res.set('Cache-Control', 'public, max-age=86400');
          return res.send(buf);
        }
      }
    } catch(e) {}
  }
  res.status(404).json({ error: 'image not found' });
});




// GET /api/autodoc/specs-by-oem?oem=GDB1183
router.get('/specs-by-oem', async (req, res) => {
  const { oem } = req.query;
  if (!oem || !RAPIDAPI_KEY) return res.status(400).json({ error: 'oem required' });
  try {
    // ჯერ articleId ვიპოვოთ
    const r0 = await fetch(`${BASE}/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(oem)}&articleType=ArticleNumber`, { headers: headers() });
    const d0 = await r0.json();
    const arts = d0.articles || (Array.isArray(d0) ? d0 : []);
    if (!arts.length) return res.json({ oem, specs: [], related: [] });
    const articleId = arts[0].articleId;
    // specs და related parallel-ად
    const [rSpecs, rRelated] = await Promise.all([
      fetch(`${BASE}/api/articles/selection-of-all-specifications-criterias-for-the-article/article-id/${articleId}/lang-id/4/country-filter-id/63`, { headers: headers() }).then(r=>r.json()).catch(()=>[]),
      fetch(`${BASE}/api/artlookup/select-article-cross-references/article-id/${articleId}/lang-id/4`, { headers: headers() }).then(r=>r.json()).catch(()=>{})
    ]);
    const specs = Array.isArray(rSpecs) ? rSpecs : [];
    const relArts = (rRelated?.articles || (Array.isArray(rRelated) ? rRelated : [])).slice(0,8);
    res.json({ oem, articleId, specs, related: relArts.map(a => ({
      articleId: a.articleId, articleNo: a.articleNo,
      supplier: a.supplierName, name: a.articleProductName, image: a.s3image||null
    }))});
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/specs?articleId=7234803
router.get('/specs', async (req, res) => {
  const { articleId } = req.query;
  if (!articleId || !RAPIDAPI_KEY) return res.status(400).json({ error: 'articleId required' });
  try {
    const r = await fetch(`${BASE}/api/articles/selection-of-all-specifications-criterias-for-the-article/article-id/${articleId}/lang-id/4/country-filter-id/63`, { headers: headers() });
    const d = await r.json();
    res.json({ articleId, specs: Array.isArray(d) ? d : [] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/related?articleId=7234803
router.get('/related', async (req, res) => {
  const { articleId } = req.query;
  if (!articleId || !RAPIDAPI_KEY) return res.status(400).json({ error: 'articleId required' });
  try {
    const r = await fetch(`${BASE}/api/artlookup/select-article-cross-references/article-id/${articleId}/lang-id/4`, { headers: headers() });
    const d = await r.json();
    const arts = (d.articles || (Array.isArray(d) ? d : [])).slice(0, 10);
    res.json({ articleId, count: arts.length, articles: arts.map(a => ({
      articleId: a.articleId, articleNo: a.articleNo,
      supplier: a.supplierName, name: a.articleProductName, image: a.s3image || null
    }))});
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/media?articleId=7234803
router.get('/media', async (req, res) => {
  const { articleId } = req.query;
  if (!articleId || !RAPIDAPI_KEY) return res.status(400).json({ error: 'articleId required' });
  try {
    const r = await fetch(`${BASE}/api/articles/article-all-media-info?langId=4&articleId=${articleId}`, { headers: headers() });
    const d = await r.json();
    const media = Array.isArray(d) ? d : [];
    res.json({ articleId, images: media.filter(m => m.s3image).map(m => m.s3image) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

// GET /api/autodoc/suppliers
router.get('/suppliers', async (req, res) => {
  try {
    const r = await fetch(`${BASE}/api/suppliers/list`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/crossref/article/:articleId
router.get('/crossref/article/:articleId', async (req, res) => {
  const { langId = 4 } = req.query;
  try {
    const r = await fetch(`${BASE}/api/artlookup/select-article-cross-references/article-id/${req.params.articleId}/lang-id/${langId}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/crossref/partial/:articleId
router.get('/crossref/partial/:articleId', async (req, res) => {
  const { langId = 4 } = req.query;
  try {
    const r = await fetch(`${BASE}/api/artlookup/select-article-cross-references-partial-match?articleId=${req.params.articleId}&langId=${langId}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/oem/equal/:oemNo
router.get('/oem/equal/:oemNo', async (req, res) => {
  const { langId = 4 } = req.query;
  try {
    const r = await fetch(`${BASE}/api/articles-oem/search-all-equal-oem-no/lang-id/${langId}/article-oem-no/${req.params.oemNo}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/autodoc/oem/equal
router.post('/oem/equal', async (req, res) => {
  const { articleOemNo, langId = 4 } = req.body;
  try {
    const r = await fetch(`${BASE}/api/articles-oem/all-equal-oem-no`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `langId=${langId}&articleOemNo=${encodeURIComponent(articleOemNo)}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/crossref/through-oem/:articleId
router.get('/crossref/through-oem/:articleId', async (req, res) => {
  const { supplierId } = req.query;
  try {
    const r = await fetch(`${BASE}/api/artlookup/search-for-cross-references-through-oem-numbers-by-article-id?articleId=${req.params.articleId}&supplierId=${supplierId}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/autodoc/crossref/through-oem
router.post('/crossref/through-oem', async (req, res) => {
  const { supplierId, articleNo } = req.body;
  try {
    const r = await fetch(`${BASE}/api/artlookup/search-for-cross-references-through-oem-numbers`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `supplierId=${supplierId}&articleNo=${encodeURIComponent(articleNo)}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/artlookup/:articleNo
router.get('/artlookup/:articleNo', async (req, res) => {
  const { langId = 4, articleType = 'ArticleNumber' } = req.query;
  try {
    const r = await fetch(`${BASE}/api/artlookup/search-articles-by-article-no?langId=${langId}&articleNo=${encodeURIComponent(req.params.articleNo)}&articleType=${articleType}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/oem/vehicle/:vehicleId/:searchParam
router.get('/oem/vehicle/:vehicleId/:searchParam', async (req, res) => {
  const { langId = 4, typeId = 1 } = req.query;
  try {
    const r = await fetch(`${BASE}/api/articles-oem/selecting-oem-parts-vehicle-modification-description-product-group/type-id/${typeId}/vehicle-id/${req.params.vehicleId}/lang-id/${langId}/search-param/${req.params.searchParam}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/autodoc/artlookup/search
router.post('/artlookup/search', async (req, res) => {
  const { articleNo, articleType = 'ArticleNumber', langId = 4 } = req.body;
  try {
    const r = await fetch(`${BASE}/api/artlookup/search-articles-by-article-no`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `articleNo=${encodeURIComponent(articleNo)}&articleType=${articleType}&langId=${langId}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/artlookup/analog/:articleNo
router.get('/artlookup/analog/:articleNo', async (req, res) => {
  const { langId = 4 } = req.query;
  try {
    const r = await fetch(`${BASE}/api/artlookup/search-for-analog-spare-parts-by-the-articles-numbers/lang-id/${langId}/articleNo/${encodeURIComponent(req.params.articleNo)}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/artlookup/cross-numbers/:articleNo
router.get('/artlookup/cross-numbers/:articleNo', async (req, res) => {
  const { langId = 4 } = req.query;
  try {
    const r = await fetch(`${BASE}/api/artlookup/search-for-cross-numbers/lang-id/${langId}/article-type/ArticleNumber,OENumber,IAMNumber/article-no/${encodeURIComponent(req.params.articleNo)}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/autodoc/articles/quick-search
router.post('/articles/quick-search', async (req, res) => {
  const { articleNo, langId = 4, supplierId } = req.body;
  try {
    const r = await fetch(`${BASE}/api/articles/quick-article-search`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `articleNo=${encodeURIComponent(articleNo)}&langId=${langId}&supplierId=${supplierId || ''}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/oem/aftermarket/:oemNo
router.get('/oem/aftermarket/:oemNo', async (req, res) => {
  try {
    const r = await fetch(`${BASE}/api/artlookup/search-for-the-oem-cross-references-through-aftermarket-parts-references/article-oem-no/${encodeURIComponent(req.params.oemNo)}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/oem/analog/:oemNo
router.get('/oem/analog/:oemNo', async (req, res) => {
  try {
    const r = await fetch(`${BASE}/api/artlookup/search-for-analogue-of-spare-parts-by-oem-number/article-oem-no/${encodeURIComponent(req.params.oemNo)}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/articles/search?articleNo=X&supplierId=Y&langId=4
router.get('/articles/search', async (req, res) => {
  const { articleNo, supplierId, langId = 4 } = req.query;
  try {
    const r = await fetch(`${BASE}/api/articles/search-by-articles-no-supplier-id?articleNo=${encodeURIComponent(articleNo)}&supplierId=${supplierId || ''}&langId=${langId}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/oem/cars/:manuId/:oemNo
router.get('/oem/cars/:manuId/:oemNo', async (req, res) => {
  const { langId = 4, typeId = 1 } = req.query;
  try {
    const r = await fetch(`${BASE}/api/articles-oem/selecting-a-list-of-cars-for-oem-part-number/type-id/${typeId}/lang-id/${langId}/country-filter-id/63/manufacturer-id/${req.params.manuId}/article-oem-no/${encodeURIComponent(req.params.oemNo)}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/oem/search?articleOemNo=X&langId=4
router.get('/oem/search', async (req, res) => {
  const { articleOemNo, langId = 4 } = req.query;
  try {
    const r = await fetch(`${BASE}/api/articles-oem/search-by-article-oem-no?langId=${langId}&articleOemNo=${encodeURIComponent(articleOemNo)}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/autodoc/oem/search
router.post('/oem/search', async (req, res) => {
  const { articleOemNo, langId = 4 } = req.body;
  try {
    const r = await fetch(`${BASE}/api/articles-oem/article-oem-search-no`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `langId=${langId}&articleOemNo=${encodeURIComponent(articleOemNo)}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/articles/details?articleNo=X&typeId=1&langId=4
router.get('/articles/details', async (req, res) => {
  const { articleNo, typeId = 1, langId = 4 } = req.query;
  try {
    const r = await fetch(`${BASE}/api/articles/article-number-details/type-id/${typeId}?langId=${langId}&countryFilterId=63&articleNo=${encodeURIComponent(articleNo)}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/crossref/get/:articleNo/:supplierId
router.get('/crossref/get/:articleNo/:supplierId', async (req, res) => {
  try {
    const r = await fetch(`${BASE}/api/artlookup/search-for-cross-references-through-oem-numbers/article-no/${encodeURIComponent(req.params.articleNo)}/supplierId/${req.params.supplierId}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/v3/search?articleNo=X&articleType=ArticleNumber&langId=4
router.get('/v3/search', async (req, res) => {
  const { articleNo, articleType = 'ArticleNumber', langId = 4 } = req.query;
  try {
    const r = await fetch(`${BASE}/api/v3/part-identifier/search-articles-by-article-no?langId=${langId}&articleType=${articleType}&articleNo=${encodeURIComponent(articleNo)}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/v3/exact?articleNo=X&supplierId=Y&langId=4
router.get('/v3/exact', async (req, res) => {
  const { articleNo, supplierId, langId = 4 } = req.query;
  try {
    const r = await fetch(`${BASE}/api/v3/part-identifier/exact-search-articles-by-article-no?langId=${langId}&articleNo=${encodeURIComponent(articleNo)}&supplierId=${supplierId || ''}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/vin/decoder-v1/:vin
router.get('/vin/decoder-v1/:vin', async (req, res) => {
  try {
    const r = await fetch(`${BASE}/api/vin/decoder-v1/${req.params.vin}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/vin/decoder-v2/:vin
router.get('/vin/decoder-v2/:vin', async (req, res) => {
  try {
    const r = await fetch(`${BASE}/api/vin/decoder-v2/${req.params.vin}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/vin/decoder-v3/:vin
router.get('/vin/decoder-v3/:vin', async (req, res) => {
  try {
    const r = await fetch(`${BASE}/api/vin/decoder-v3/${req.params.vin}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/vin/decoder-v5/:vin
router.get('/vin/decoder-v5/:vin', async (req, res) => {
  try {
    const r = await fetch(`${BASE}/api/vin/decoder-v5/${req.params.vin}`, { headers: headers() });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// GET /api/autodoc/manufacturers/list/:typeId
router.get('/manufacturers/list/:typeId', async (req, res) => {
  try { res.json(await (await fetch(`${BASE}/api/manufacturers/list/type-id/${req.params.typeId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== Languages & Countries =====
router.get('/languages/list', async (req, res) => {
  try { res.json(await (await fetch(`${BASE}/api/languages/list`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/countries/list', async (req, res) => {
  try { res.json(await (await fetch(`${BASE}/api/countries/list`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/languages/get/:langId', async (req, res) => {
  try { res.json(await (await fetch(`${BASE}/api/languages/get-language/lang-id/${req.params.langId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/countries/by-lang/:langId', async (req, res) => {
  try { res.json(await (await fetch(`${BASE}/api/countries/list-countries-by-lang-id/${req.params.langId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/countries/get/:langId/:countryId', async (req, res) => {
  try { res.json(await (await fetch(`${BASE}/api/countries/get-country/lang-id/${req.params.langId}/country-filter-id/${req.params.countryId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== Manufacturers =====
router.get('/types/list', async (req, res) => {
  try { res.json(await (await fetch(`${BASE}/api/types/list-vehicles-type`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/manufacturers/find/:manuId', async (req, res) => {
  try { res.json(await (await fetch(`${BASE}/api/manufacturers/find-by-id/${req.params.manuId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/manufacturers/types/:manuId', async (req, res) => {
  try { res.json(await (await fetch(`${BASE}/api/manufacturers/get-manufacturer-types/${req.params.manuId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== Models =====
router.get('/models/details/:typeId/:modelId', async (req, res) => {
  const { langId=4, countryId=63 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/models/type-id/${req.params.typeId}/model-id/${req.params.modelId}/lang-id/${langId}/country-filter-id/${countryId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/models/by-vehicle/:typeId/:vehicleId', async (req, res) => {
  const { langId=4, countryId=63 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/models/type-id/${req.params.typeId}/vehicles/${req.params.vehicleId}/lang-id/${langId}/country-filter-id/${countryId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/models/basic/:typeId/:modelId', async (req, res) => {
  try { res.json(await (await fetch(`${BASE}/api/models/type-id/${req.params.typeId}/model-id/${req.params.modelId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== Vehicles =====
router.get('/vehicles/details/:typeId/:vehicleId', async (req, res) => {
  const { langId=4, countryId=63 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/types/type-id/${req.params.typeId}/vehicle-type-details/${req.params.vehicleId}/lang-id/${langId}/country-filter-id/${countryId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/vehicles/list-types/:typeId/:modelId', async (req, res) => {
  const { langId=4, countryId=63 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/types/type-id/${req.params.typeId}/list-vehicles-types/${req.params.modelId}/lang-id/${langId}/country-filter-id/${countryId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/engines/details/:engineId', async (req, res) => {
  const { langId=4 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/engines/engine-details/engine-id/${req.params.engineId}/lang-id/${langId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/vehicles/typeid', async (req, res) => {
  const { vehicleId, manufacturerId } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/types/get-typeid-by-vehicleid?vehicleId=${vehicleId}&manufacturerId=${manufacturerId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/vehicles/spare-criteria/:typeId/:vehicleId', async (req, res) => {
  const { langId=4, countryId=63 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/types/selecting-all-criteria-for-spare-parts-of-a-passenger-car-using-an-olap-query/type-id/${req.params.typeId}/lang-id/${langId}/country-filter-id/${countryId}/vehicle-id/${req.params.vehicleId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== OEM Identifier =====
router.post('/oem/by-article-ids', async (req, res) => {
  try {
    const r = await fetch(`${BASE}/api/articles/get-oems-by-list-of-articles-ids`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleIds: req.body.articleIds })
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== Categories =====
router.get('/category/tree', async (req, res) => {
  const { typeId=1, langId=4 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/category/type-id/${typeId}/list-category-tree-structure/lang-id/${langId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/category/groups-v1/:vehicleId', async (req, res) => {
  const { typeId=1, langId=4 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/category/type-id/${typeId}/products-groups-variant-1/${req.params.vehicleId}/lang-id/${langId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/category/groups-v2/:vehicleId', async (req, res) => {
  const { typeId=1, langId=4 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/category/type-id/${typeId}/products-groups-variant-2/${req.params.vehicleId}/lang-id/${langId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/category/groups-v3/:vehicleId', async (req, res) => {
  const { typeId=1, langId=4 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/category/type-id/${typeId}/products-groups-variant-3/${req.params.vehicleId}/lang-id/${langId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/category/groups-v4/:vehicleId', async (req, res) => {
  const { typeId=1, langId=4 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/category/type-id/${typeId}/products-groups-variant-4/${req.params.vehicleId}/lang-id/${langId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/category/search', async (req, res) => {
  const { typeId=1, langId=4, text } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/category/search-for-the-commodity-group-tree-by-description/type-id/${typeId}/lang-id/${langId}/search-text/${encodeURIComponent(text)}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/category/product-names', async (req, res) => {
  const { langId=4 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/category/list-products-names/lang-id/${langId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/articles/category/:articleId', async (req, res) => {
  const { langId=4 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/articles/get-article-category/article-id/${req.params.articleId}/lang-id/${langId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/articles/categories/:articleId', async (req, res) => {
  const { langId=4 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/articles/get-article-categories/article-id/${req.params.articleId}/lang-id/${langId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== Article Details =====
router.get('/articles/details/:articleId', async (req, res) => {
  const { langId=4 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/articles/details/article-id/${req.params.articleId}/lang-id/${langId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/articles/complete-details', async (req, res) => {
  const { articleId, typeId=1, langId=4, countryFilterId=63 } = req.body;
  try {
    const r = await fetch(`${BASE}/api/articles/article-id-complete-details`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `typeId=${typeId}&langId=${langId}&articleId=${articleId}&countryFilterId=${countryFilterId}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/articles/details-post', async (req, res) => {
  const { articleId, langId=4 } = req.body;
  try {
    const r = await fetch(`${BASE}/api/articles/details`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `articleId=${articleId}&langId=${langId}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/articles/criteria/:articleId', async (req, res) => {
  const { langId=4, countryId=63 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/articles/selection-of-all-specifications-criterias-for-the-article/article-id/${req.params.articleId}/lang-id/${langId}/country-filter-id/${countryId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/articles/specs', async (req, res) => {
  try {
    const r = await fetch(`${BASE}/api/articles/get-article-specifications-list-of-articles-ids`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleIds: req.body.articleIds, langId: String(req.body.langId||4) })
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/articles/compatible-cars/:articleId', async (req, res) => {
  const { typeId=1, langId=4, supplierId, countryFilterId=63 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/articles/get-compatible-cars-by-article-number/type-id/${typeId}?langId=${langId}&supplierId=${supplierId}&articleNo=${req.params.articleId}&countryFilterId=${countryFilterId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/articles/compatible-cars-post', async (req, res) => {
  const { supplierId, articleNo, langId=4, countryFilterId=63, typeId=1 } = req.body;
  try {
    const r = await fetch(`${BASE}/api/articles/get-compatible-cars-by-article-number`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `supplierId=${supplierId}&articleNo=${encodeURIComponent(articleNo)}&langId=${langId}&countryFilterId=${countryFilterId}&typeId=${typeId}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/articles/accessories/:articleId', async (req, res) => {
  const { langId=4, countryId=63 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/articles/selecting-list-of-accessories-list-for-the-article/article-id/${req.params.articleId}/lang-id/${langId}/country-filter-id/${countryId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/articles/diagram/:articleId', async (req, res) => {
  try { res.json(await (await fetch(`${BASE}/api/articles/selecting-item-coordinators-on-the-parts-diagram-image-for-the-parts-list/article-id/${req.params.articleId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/articles/parts-list/:articleId', async (req, res) => {
  const { langId=4, countryId=63 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/articles/list-of-parts-for-article/article-id/${req.params.articleId}/lang-id/${langId}/country-filter-id/${countryId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/articles/media/:articleId', async (req, res) => {
  const { langId=4 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/articles/article-all-media-info?langId=${langId}&articleId=${req.params.articleId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/articles/media-post', async (req, res) => {
  const { articleId, langId=4 } = req.body;
  try {
    const r = await fetch(`${BASE}/api/articles/article-all-media-info`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `langId=${langId}&articleId=${articleId}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.get('/articles/selection-criteria/:typeId/:productId/:vehicleId/:supplierId', async (req, res) => {
  const { langId=4, countryId=63 } = req.query;
  try { res.json(await (await fetch(`${BASE}/api/articles/selection-of-the-criteria-for-articles-and-vehicle/type-id/${req.params.typeId}/product-id/${req.params.productId}/vehicle-id/${req.params.vehicleId}/supplier-id/${req.params.supplierId}/lang-id/${langId}/country-filter-id/${countryId}`, { headers: headers() })).json()); } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== Article Search =====
router.post('/articles/number-details', async (req, res) => {
  const { articleNo, langId=4, typeId=1, countryFilterId=63 } = req.body;
  try {
    const r = await fetch(`${BASE}/api/articles/article-number-details`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `langId=${langId}&typeId=${typeId}&articleNo=${encodeURIComponent(articleNo)}&countryFilterId=${countryFilterId}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/articles/quick-search', async (req, res) => {
  const { articleNo, langId=4, supplierId } = req.body;
  try {
    const r = await fetch(`${BASE}/api/articles/quick-article-search`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `articleNo=${encodeURIComponent(articleNo)}&langId=${langId}&supplierId=${supplierId||''}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/articles/cross-numbers', async (req, res) => {
  const { articleNo, articleType='ArticleNumber', langId=4 } = req.body;
  try {
    const r = await fetch(`${BASE}/api/artlookup/search-for-cross-numbers`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `articleType=${articleType}&articleNo=${encodeURIComponent(articleNo)}&langId=${langId}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== OEM Search =====
router.post('/oem/cars-list', async (req, res) => {
  const { manufacturerId, langId=4, typeId=1, articleOemNo, countryFilterId=63 } = req.body;
  try {
    const r = await fetch(`${BASE}/api/articles-oem/selecting-a-list-of-cars-for-oem-part-number`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `manufacturerId=${manufacturerId}&langId=${langId}&typeId=${typeId}&articleOemNo=${encodeURIComponent(articleOemNo)}&countryFilterId=${countryFilterId}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/oem/analog-by-article', async (req, res) => {
  const { articleNo, langId=4, articleOemNo } = req.body;
  try {
    const r = await fetch(`${BASE}/api/artlookup/search-for-analog-spare-parts-by-the-articles-numbers`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `langId=${langId}&articleNo=${encodeURIComponent(articleNo)}&articleOemNo=${encodeURIComponent(articleOemNo||'')}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/oem/aftermarket-refs', async (req, res) => {
  const { articleOemNo } = req.body;
  try {
    const r = await fetch(`${BASE}/api/artlookup/search-for-the-oem-cross-references-through-aftermarket-parts-references`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `articleOemNo=${encodeURIComponent(articleOemNo)}`
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// GET /api/autodoc/article-oem/:articleId
router.get('/article-oem/:articleId', async (req, res) => {
  try {
    const r = await fetch(`${BASE}/api/articles/get-oems-by-list-of-articles-ids`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleIds: [parseInt(req.params.articleId)] })
    });
    const d = await r.json();
    res.json({ articleId: req.params.articleId, oems: d || [] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/autodoc/find-product?oem=GDB4605
router.get('/find-product', async (req, res) => {
  const { oem } = req.query;
  if (!oem) return res.status(400).json({ error: 'oem required' });
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const codes = [oem, oem.replace(/\s/g,'')];
    const product = await prisma.product.findFirst({
      where: { isActive: true, OR: [
        { oemCodes: { hasSome: codes } },
        { alternativeSearchKeys: { hasSome: codes } },
        { sku: { in: codes } }
      ]},
      select: { id: true, nameKa: true, price: true, images: true, sku: true }
    });
    await prisma.$disconnect();
    if (product) return res.json({ found: true, product });
    // Autodoc-ში ვეძებთ სურათს
    const r = await fetch(`${BASE}/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(oem)}&articleType=ArticleNumber`, { headers: headers() });
    const d = await r.json();
    const arts = d.articles || (Array.isArray(d) ? d : []);
    const art = arts[0] || {};
    res.json({ found: false, articleProductName: art.articleProductName || oem, image: art.s3image || null, brand: art.supplierName || null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
