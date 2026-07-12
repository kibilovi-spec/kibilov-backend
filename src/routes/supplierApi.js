const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { matchCategory } = require('../services/categoryMatcher');
const prisma = new PrismaClient();

// API key auth middleware
async function authSupplier(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'x-api-key header required' });

  try {
    const supplier = await prisma.supplier.findFirst({ where: { apiKey } });
    if (!supplier) return res.status(401).json({ error: 'Invalid API key' });
    req.supplier = supplier;
    next();
  } catch (e) {
    res.status(500).json({ error: 'Auth failed' });
  }
}

// POST /api/supplier/products — bulk upsert
router.post('/products', authSupplier, async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || !products.length) {
      return res.status(400).json({ error: 'products array required' });
    }

    const results = { created: 0, updated: 0, errors: 0 };

    for (const p of products) {
      if (!p.sku || !p.name) { results.errors++; continue; }

      try {
        const match = await matchCategory(p.name);

        const existing = await prisma.product.findUnique({ where: { sku: p.sku } });

        if (existing) {
          // 🔒 თუ პროდუქტი ხელით არის შესწორებული (dataLocked), კატეგორიას
          // აღარ ვეხებით — მხოლოდ ფასი/მარაგი განახლდება
          await prisma.product.update({
            where: { sku: p.sku },
            data: {
              price: parseFloat(p.price) || existing.price,
              stock: parseInt(p.stock) || 0,
              isActive: (parseInt(p.stock) || 0) > 0,
              ...(existing.dataLocked ? {} : {
                autodocCategoryId: match.confidence >= 70 ? match.categoryId : existing.autodocCategoryId,
                categoryConfidence: match.confidence || existing.categoryConfidence,
                categoryMethod: match.method || existing.categoryMethod,
              }),
            }
          });
          results.updated++;
        } else {
          await prisma.product.create({
            data: {
              sku: p.sku,
              nameKa: p.name,
              nameEn: p.nameEn || p.name,
              nameRu: p.nameRu || '',
              price: parseFloat(p.price) || 0,
              stock: parseInt(p.stock) || 0,
              brand: p.brand || 'Generic',
              oemCodes: p.oem ? String(p.oem).split(',').map(x=>x.trim()).filter(Boolean) : [],
              isActive: (parseInt(p.stock) || 0) > 0,
              autodocCategoryId: match.confidence >= 70 ? match.categoryId : null,
              categoryConfidence: match.confidence,
              categoryMethod: match.method
            }
          });
          results.created++;
        }
      } catch (e) {
        results.errors++;
      }
    }

await prisma.supplierImportLog.create({ data: {
      supplierId: req.supplier.id, source: 'API', fileName: null,
      itemsFound: products.length, itemsCreated: results.created, itemsUpdated: results.updated, itemsFailed: results.errors,
      status: results.errors > 0 && results.created===0 && results.updated===0 ? 'FAILED' : (results.errors>0 ? 'PARTIAL' : 'SUCCESS')
    }}).catch(()=>{});
        res.json({ success: true, ...results });
  } catch(e) { console.error('[supplierApi.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// POST /api/supplier/stock — quick price/stock update
router.post('/stock', authSupplier, async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates array required' });

    let updated = 0, notFound = 0;

    for (const u of updates) {
      if (!u.sku) { notFound++; continue; }
      const data = {};
      if (u.price !== undefined) data.price = parseFloat(u.price);
      if (u.stock !== undefined) { data.stock = parseInt(u.stock); data.isActive = data.stock > 0; }

      const result = await prisma.product.updateMany({
        where: { sku: u.sku },
        data
      });
      result.count > 0 ? updated++ : notFound++;
    }

    res.json({ success: true, updated, notFound });
  } catch(e) { console.error('[supplierApi.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

module.exports = router;
