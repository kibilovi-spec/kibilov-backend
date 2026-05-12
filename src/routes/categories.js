'use strict';
const router = require('express').Router();
const { prisma, authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  const lang = req.query.lang || 'ka';
  const L = lang.charAt(0).toUpperCase() + lang.slice(1);

  const cats = await prisma.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { order: 'asc' },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { products: { where: { isActive: true } } } }
        }
      },
      _count: { select: { products: { where: { isActive: true } } } }
    },
  });

  res.json({
    success: true,
    data: cats.map(c => {
      const childCount = c.children.reduce((sum, ch) => sum + ch._count.products, 0);
      const totalCount = c._count.products + childCount;
      return {
        id: c.id,
        slug: c.slug,
        icon: c.icon,
        name: c['name' + L] || c.nameKa,
        productCount: totalCount,
        subcategories: c.children.map(s => ({
          id: s.id,
          slug: s.slug,
          name: s['name' + L] || s.nameKa,
          productCount: s._count.products
        }))
      };
    })
  });
});

router.get('/:slugOrId', async (req, res) => {
  const lang = req.query.lang || 'ka';
  const L = lang.charAt(0).toUpperCase() + lang.slice(1);

  const cat = await prisma.category.findFirst({
    where: { OR: [{ id: req.params.slugOrId }, { slug: req.params.slugOrId }] },
    include: {
      children: {
        include: {
          _count: { select: { products: { where: { isActive: true } } } }
        }
      },
      _count: { select: { products: { where: { isActive: true } } } }
    }
  });

  if (!cat) return res.status(404).json({ success: false, message: 'კატეგორია ვერ მოიძებნა' });

  const childCount = cat.children.reduce((sum, ch) => sum + ch._count.products, 0);
  const totalCount = cat._count.products + childCount;

  res.json({
    success: true,
    data: {
      id: cat.id,
      slug: cat.slug,
      icon: cat.icon,
      name: cat['name' + L] || cat.nameKa,
      productCount: totalCount,
      subcategories: cat.children.map(s => ({
        id: s.id,
        slug: s.slug,
        name: s['name' + L] || s.nameKa,
        productCount: s._count.products
      }))
    }
  });
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  const cat = await prisma.category.create({ data: req.body });
  res.status(201).json({ success: true, data: cat });
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const cat = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: cat });
});

module.exports = router;
