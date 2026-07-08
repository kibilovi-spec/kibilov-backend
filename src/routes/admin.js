'use strict';
const { adminRouter } = require('./misc');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');
const prisma = new PrismaClient();


module.exports = adminRouter;

// GET /api/admin/import-batches
adminRouter.get('/import-batches', authenticate, requireAdmin, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const batches = await prisma.$queryRaw`
      SELECT ib.id, ib.filename, ib.imported_at, ib.product_count, ib.imported_by, ib.rejected_count,
             COUNT(p.id)::int as active_products
      FROM import_batches ib
      LEFT JOIN products p ON p.import_batch_id = ib.id AND p."isActive" = true
      GROUP BY ib.id
      UNION ALL
      SELECT -1 as id, 'ძველი imports (batch გარეშე)' as filename, 
             MIN(p."createdAt") as imported_at, 0 as product_count, 'admin' as imported_by, 0 as rejected_count,
             COUNT(p.id)::int as active_products
      FROM products p
      WHERE p.import_batch_id IS NULL AND p."isActive" = true
      HAVING COUNT(p.id) > 0
      ORDER BY imported_at DESC
    `;
    await prisma.$disconnect();
    const result = batches.map(b => ({
      id: Number(b.id),
      filename: b.filename,
      importedAt: b.imported_at,
      productCount: Number(b.product_count || 0),
      importedBy: b.imported_by,
      activeProducts: Number(b.active_products || 0),
      rejectedCount: Number(b.rejected_count || 0),
      rejectedReportUrl: Number(b.id) > 0 && Number(b.rejected_count || 0) > 0
        ? `/api/admin/import-batches/${Number(b.id)}/rejected-report` : null,
    }));
    res.json(result);
  } catch(e) { console.error('[admin.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
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
  } catch(e) { console.error('[admin.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});
const XLSX2 = require('xlsx');

// GET /api/admin/import-batches/:id/rejected-report — Excel report for admin's own bulk import rejections
adminRouter.get('/import-batches/:id/rejected-report', authenticate, requireAdmin, async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`SELECT rejected_report FROM import_batches WHERE id = ${parseInt(req.params.id)}`;
    const raw = rows[0]?.rejected_report;
    if (!raw) return res.status(404).json({ success: false, message: 'რეპორტი ვერ მოიძებნა' });
    const rejected = JSON.parse(raw);
    const excelRows = rejected.map(r => ({
      'SKU': r.sku, 'დასახელება': r.nameKa,
      'OEM კოდები': (r.oemCodes || []).join(', '),
      'Cross კოდები': (r.crossCodes || []).join(', '),
      'დარწმუნებულობა %': r.confidence, 'მეთოდი': r.method, 'მიზეზი': r.reason,
    }));
    const wb = XLSX2.utils.book_new();
    const ws = XLSX2.utils.json_to_sheet(excelRows);
    XLSX2.utils.book_append_sheet(wb, ws, 'Rejected');
    const buf = XLSX2.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="rejected_batch_${req.params.id}.xlsx"`);
    res.send(buf);
  } catch(e) { console.error('[admin.js:rejected-report]', e); res.status(500).json({ success: false, message: 'სერვერზე დაფიქსირდა შეცდომა' }); }
});

module.exports = adminRouter;
