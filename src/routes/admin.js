'use strict';
const { adminRouter } = require('./misc');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');
const prisma = new PrismaClient();


// GET /api/admin/search-analytics
adminRouter.get('/search-analytics', async (req, res) => {
  try {
    const popular = await prisma.$queryRaw`
      SELECT part_en, part_ka, make, model,
             COUNT(*)::int as search_count,
             SUM(CASE WHEN found THEN 1 ELSE 0 END)::int as found_count
      FROM search_log
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY part_en, part_ka, make, model
      ORDER BY search_count DESC
      LIMIT 20
    `;
    const notFound = await prisma.$queryRaw`
      SELECT part_en, part_ka, make, model, COUNT(*)::int as search_count
      FROM search_log
      WHERE found = false AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY part_en, part_ka, make, model
      ORDER BY search_count DESC
      LIMIT 10
    `;
    res.json({ popular, notFound });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


module.exports = adminRouter;

// GET /api/admin/import-batches
adminRouter.get('/import-batches', authenticate, requireAdmin, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const batches = await prisma.$queryRaw`
      SELECT ib.id, ib.filename, ib.imported_at, ib.product_count, ib.imported_by,
             COUNT(p.id)::int as active_products
      FROM import_batches ib
      LEFT JOIN products p ON p.import_batch_id = ib.id AND p."isActive" = true
      GROUP BY ib.id
      UNION ALL
      SELECT -1 as id, 'ძველი imports (batch გარეშე)' as filename, 
             MIN(p."createdAt") as imported_at, 0 as product_count, 'admin' as imported_by,
             COUNT(p.id)::int as active_products
      FROM products p
      WHERE p.import_batch_id IS NULL AND p."isActive" = true
      HAVING COUNT(p.id) > 0
      ORDER BY imported_at DESC
    `;
    await prisma.$disconnect();
    res.json(batches);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/import-batches/:id
adminRouter.delete('/import-batches/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const batchId = parseInt(req.params.id);
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Get products in this batch
    const products = await prisma.$queryRaw`
      SELECT id, images FROM products WHERE import_batch_id = ${batchId}
    `;
    
    // Delete images from filesystem
    const fs = require('fs');
    const path = require('path');
    for (const p of products) {
      const imgs = p.images || [];
      for (const img of imgs) {
        try {
          const imgPath = path.join('/var/www/kibilov-backend/uploads', path.basename(img));
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        } catch(e) {}
      }
    }
    
    // Delete products (hard delete)
    const deleted = await prisma.$executeRaw`
      DELETE FROM products WHERE import_batch_id = ${batchId}
    `;
    
    // Delete OEM data from vehicle_oem that referenced these products
    // (already cascaded via product_oem_map if exists)
    
    // Delete batch record
    await prisma.$executeRaw`DELETE FROM import_batches WHERE id = ${batchId}`;
    
    await prisma.$disconnect();
    res.json({ success: true, deletedProducts: deleted });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
module.exports = adminRouter;
