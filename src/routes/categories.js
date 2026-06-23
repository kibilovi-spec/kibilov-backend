'use strict';
const router = require('express').Router();
const { prisma, authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const cache = require('../services/cache');
    const cacheKey = 'categories:autodoc:v2';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const parents = await prisma.$queryRaw`
      SELECT ac.autodoc_id as id, ac.name_en as name, ac.name_ka, ac.slug, ac.sort_order,
        (SELECT COUNT(*)::int FROM products p
         JOIN autodoc_categories child ON child.autodoc_id = p.autodoc_category_id
         WHERE child.parent_id = ac.autodoc_id AND p."isActive" = true) as product_count
      FROM autodoc_categories ac
      WHERE ac.level = 1
      ORDER BY ac.sort_order ASC
    `;

    const result = await Promise.all(parents.map(async (c) => {
      const children = await prisma.$queryRaw`
        SELECT ac.autodoc_id as id, ac.slug, ac.name_ka, ac.name_en as name, ac.image_url,
          COUNT(DISTINCT p.id)::int as product_count
        FROM autodoc_categories ac
        LEFT JOIN products p ON p.autodoc_category_id = ac.autodoc_id AND p."isActive" = true
        WHERE ac.parent_id = ${c.id} AND ac.level = 2
        GROUP BY ac.autodoc_id, ac.slug, ac.name_ka, ac.name_en, ac.image_url, ac.sort_order
        ORDER BY ac.sort_order ASC, COUNT(DISTINCT p.id) DESC
      `;
      const childCount = children.reduce((s, ch) => s + Number(ch.product_count), 0);
      return {
        id: String(c.id),
        slug: c.slug || String(c.id),
        name: c.name_ka || c.name, nameKa: c.name_ka || c.name, nameEn: c.name,
        icon: `/images/categories/${c.id}.png`,
        imageUrl: `/images/categories/${c.id}.png`,
        productCount: parseInt(String(c.product_count || 0)) + childCount,
        subcategories: children.map(s => ({
          id: String(s.id), slug: s.slug || String(s.id),
          name: s.name_ka || s.name, nameKa: s.name_ka || s.name, nameEn: s.name,
          imageUrl: s.image_url || null,
          productCount: Number(s.product_count)
        }))
      };
    }));

    const filtered = result.filter(c => c.productCount > 0);
    await cache.set(cacheKey, filtered, 3600);
    res.json({ success: true, data: filtered });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// Autodoc Category Tree - recursive hierarchy
router.get('/autodoc-tree', async (req, res) => {
  // Cache for 1 hour
  const cacheKey = 'autodoc-tree-v2';
  try {
    const { getCache, setCache } = require('../services/cache');
    const cached = await getCache(cacheKey);
    if (cached) return res.json({ success: true, data: cached });
  } catch(e) {}

  try {
    const rows = await prisma.$queryRaw`
      SELECT autodoc_id, parent_id, name_en, name_ka, slug, level, image_url, 0::int as product_count
      FROM autodoc_categories
      WHERE is_active = true
      ORDER BY level, autodoc_id
    `;

    // Build map
    const map = {};
    for (const r of rows) {
      map[r.autodoc_id] = {
        id: r.autodoc_id,
        parentId: r.parent_id,
        nameEn: r.name_en,
        nameKa: r.name_ka || r.name_en,
        slug: r.slug,
        level: r.level,
        imageUrl: r.image_url,
        productCount: Number(r.product_count) || 0,
        children: []
      };
    }

    // Build tree (max depth 2 for performance)
    const roots = [];
    for (const node of Object.values(map)) {
      if (node.parentId && map[node.parentId]) {
        map[node.parentId].children.push(node);
      } else if (!node.parentId) {
        roots.push(node);
      }
    }
    // Strip grandchildren to reduce payload size
    for (const root of roots) {
      for (const child of root.children) {
        child.children = [];
      }
    }

    try {
      const { setCache } = require('../services/cache');
      await setCache(cacheKey, roots, 3600);
    } catch(e) {}
    res.json({ success: true, data: roots });
  } catch (e) {
    console.error('autodoc-tree error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});


// All categories for SEO/sitemap (includes empty ones)
router.get('/all-slugs', async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT autodoc_id as id, slug, name_ka, name_en, level, parent_id
      FROM autodoc_categories
      WHERE is_active = true
      ORDER BY level, autodoc_id
    `;
    res.json({ success: true, data: rows.map(r => ({
      id: r.id, slug: r.slug, nameKa: r.name_ka || r.name_en, nameEn: r.name_en, level: r.level, parentId: r.parent_id
    }))});
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/:slugOrId', async (req, res) => {
  try {
    const id = parseInt(req.params.slugOrId);
    if (!isNaN(id)) {
      // Autodoc category by ID
      const cat = await prisma.$queryRaw`
        SELECT autodoc_id as id, name_en as name, parent_id, level
        FROM autodoc_categories WHERE autodoc_id = ${id}
      `;
      if (!cat.length) return res.status(404).json({ success: false, message: 'კატეგორია ვერ მოიძებნა' });
      const c = cat[0];
      const children = await prisma.$queryRaw`
        SELECT ac.autodoc_id as id, ac.name_en as name,
          COUNT(DISTINCT p.id)::int as product_count
        FROM autodoc_categories ac
        LEFT JOIN products p ON p.autodoc_category_id = ac.autodoc_id AND p."isActive" = true
        WHERE ac.parent_id = ${id}
        GROUP BY ac.autodoc_id, ac.name_en
        ORDER BY COUNT(DISTINCT p.id) DESC
      `;
      const prodCount = await prisma.$queryRaw`
        SELECT COUNT(*)::int as cnt FROM products
        WHERE autodoc_category_id = ${id} AND "isActive" = true
      `;
      return res.json({
        success: true,
        data: {
          id: String(c.id), slug: String(c.id),
          name: c.name, nameKa: c.name, nameEn: c.name,
          productCount: Number(prodCount[0]?.cnt || 0),
          subcategories: children.map(s => ({
            id: String(s.id), slug: String(s.id),
            name: s.name, nameKa: s.name, nameEn: s.name,
            productCount: Number(s.product_count)
          }))
        }
      });
    }
    return res.status(404).json({ success: false, message: 'კატეგორია ვერ მოიძებნა' });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
module.exports = router;
