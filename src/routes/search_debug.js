const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/admin/search-debug?q=honda+fit+კალოტკა
router.get('/', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ error: 'q required' });
  
  try {
    const search = q.toLowerCase();
    const searchNorm = search.replace(/[\s\-]/g, '');
    
    // 1. SKU/OEM exact match
    const skuMatch = await prisma.$queryRaw`
      SELECT id, "nameKa", sku, "articleNumber"
      FROM products WHERE "isActive"=true AND (
        LOWER(REPLACE(REPLACE(sku,' ',''),'-','')) = ${searchNorm}
        OR LOWER(REPLACE(REPLACE("articleNumber",' ',''),'-','')) = ${searchNorm}
      ) LIMIT 5
    `;
    
    // 2. OEM codes match
    const oemMatch = await prisma.$queryRaw`
      SELECT id, "nameKa", sku, "oemCodes"[1:3] as oem_sample
      FROM products WHERE "isActive"=true AND (
        "oemCodes" @> ARRAY[${search.toUpperCase()}]
        OR "alternativeSearchKeys" @> ARRAY[${search.toUpperCase()}]
        OR "alternativeSearchKeys" @> ARRAY[${search}]
      ) LIMIT 5
    `;
    
    // 3. Text search
    const textMatch = await prisma.product.findMany({
      where: { isActive: true, OR: [
        { nameKa: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ]},
      select: { id: true, nameKa: true, sku: true, brand: true },
      take: 5
    });
    
    // 4. vehicle_cache match
    const vehicleMatch = await prisma.$queryRaw`
      SELECT vehicle_id, manufacturer, model, year
      FROM vehicle_cache
      WHERE LOWER(manufacturer) LIKE ${`%${search}%`}
        OR LOWER(model) LIKE ${`%${search}%`}
      LIMIT 5
    `;
    
    // 5. Recent failed searches
    const failed = await prisma.$queryRaw`
      SELECT query, COUNT(*)::int as cnt
      FROM search_analytics
      WHERE results_count = 0
      GROUP BY query ORDER BY cnt DESC LIMIT 10
    `;
    
    res.json({
      query: q,
      searchNorm,
      results: {
        skuExact: skuMatch,
        oemMatch,
        textMatch,
        vehicleMatch,
      },
      topFailedSearches: failed,
      summary: {
        skuFound: skuMatch.length > 0,
        oemFound: oemMatch.length > 0,
        textFound: textMatch.length > 0,
        vehicleFound: vehicleMatch.length > 0,
      }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
