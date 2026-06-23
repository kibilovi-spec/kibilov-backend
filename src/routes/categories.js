'use strict';
const router = require('express').Router();
const { prisma } = require('../middleware/auth');

// recursive product count for any category
async function getRecursiveCount(categoryId) {
  const result = await prisma.$queryRaw`
    WITH RECURSIVE tree AS (
      SELECT autodoc_id FROM autodoc_categories WHERE autodoc_id = ${categoryId}
      UNION ALL
      SELECT c.autodoc_id FROM autodoc_categories c JOIN tree t ON c.parent_id = t.autodoc_id
    )
    SELECT COUNT(p.id)::int as cnt
    FROM products p
    WHERE p.autodoc_category_id IN (SELECT autodoc_id FROM tree)
    AND p."isActive" = true
  `;
  return Number(result[0]?.cnt || 0);
}

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const cache = require('../services/cache');
    const cacheKey = 'categories:autodoc:v4';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const parents = await prisma.$queryRaw`
      SELECT autodoc_id as id, name_en, name_ka, slug, image_url, sort_order
      FROM autodoc_categories
      WHERE level = 1 AND autodoc_id NOT IN (999999, 105500)
      ORDER BY sort_order ASC, autodoc_id ASC
    `;

    const result = await Promise.all(parents.map(async (c) => {
      const [count, subs] = await Promise.all([
        getRecursiveCount(Number(c.id)),
        prisma.$queryRaw`
          SELECT ac.autodoc_id as id, ac.slug, ac.name_en, ac.name_ka, ac.image_url,
            COUNT(DISTINCT p.id)::int as product_count
          FROM autodoc_categories ac
          LEFT JOIN products p ON p.autodoc_category_id = ac.autodoc_id AND p."isActive" = true
          WHERE ac.parent_id = ${c.id}
          GROUP BY ac.autodoc_id, ac.slug, ac.name_en, ac.name_ka, ac.image_url, ac.sort_order
          ORDER BY ac.sort_order ASC, COUNT(DISTINCT p.id) DESC
        `
      ]);

      return {
        id: String(c.id),
        slug: c.slug || String(c.id),
        nameKa: c.name_en,
        nameEn: c.name_en,
        imageUrl: c.image_url || null,
        productCount: count,
        subcategories: subs.map(s => ({
          id: String(s.id), slug: s.slug || String(s.id),
          nameKa: s.name_en, nameEn: s.name_en,
          imageUrl: s.image_url || null,
          productCount: Number(s.product_count)
        }))
      };
    }));

    await cache.set(cacheKey, result, 1800);
    res.json({ success: true, data: result });
  } catch(e) {
    console.error('categories error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/categories/all-slugs
router.get('/all-slugs', async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT autodoc_id as id, slug, name_en, level, parent_id
      FROM autodoc_categories WHERE is_active = true ORDER BY level, autodoc_id
    `;
    res.json({ success: true, data: rows.map(r => ({
      id: r.id, slug: r.slug, nameKa: r.name_en, nameEn: r.name_en, level: r.level, parentId: r.parent_id
    }))});
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/categories/:slugOrId
router.get('/:slugOrId', async (req, res) => {
  try {
    const { slugOrId } = req.params;
    const numId = parseInt(slugOrId);
    const cats = !isNaN(numId)
      ? await prisma.$queryRaw`SELECT autodoc_id as id, name_en, name_ka, slug, parent_id, level, image_url FROM autodoc_categories WHERE autodoc_id = ${numId} LIMIT 1`
      : await prisma.$queryRaw`SELECT autodoc_id as id, name_en, name_ka, slug, parent_id, level, image_url FROM autodoc_categories WHERE slug = ${slugOrId} LIMIT 1`;

    if (!cats.length) return res.status(404).json({ success: false, message: 'Not found' });
    const c = cats[0];

    const [count, children] = await Promise.all([
      getRecursiveCount(Number(c.id)),
      prisma.$queryRaw`
        SELECT ac.autodoc_id as id, ac.slug, ac.name_en, ac.image_url,
          COUNT(DISTINCT p.id)::int as product_count
        FROM autodoc_categories ac
        LEFT JOIN products p ON p.autodoc_category_id = ac.autodoc_id AND p."isActive" = true
        WHERE ac.parent_id = ${c.id}
        GROUP BY ac.autodoc_id, ac.slug, ac.name_en, ac.image_url, ac.sort_order
        ORDER BY ac.sort_order ASC, COUNT(DISTINCT p.id) DESC
      `
    ]);

    res.json({ success: true, data: {
      id: String(c.id), slug: c.slug || String(c.id),
      nameKa: c.name_en, nameEn: c.name_en,
      imageUrl: c.image_url || null,
      parentId: c.parent_id, level: c.level,
      productCount: count,
      subcategories: children.map(s => ({
        id: String(s.id), slug: s.slug || String(s.id),
        nameKa: s.name_en, nameEn: s.name_en,
        imageUrl: s.image_url || null,
        productCount: Number(s.product_count)
      }))
    }});
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
