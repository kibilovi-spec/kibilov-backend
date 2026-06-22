const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// POST /api/bulk/search
// body: { codes: ["04152-YZZA6", "GDB3445", "HU710/4X"] }
router.post('/search', async (req, res) => {
  try {
    const { codes } = req.body;
    if (!codes?.length) return res.status(400).json({ error: 'codes required' });
    const cleaned = codes.map(c => c.trim().toUpperCase()).filter(Boolean).slice(0, 50);
    const results = {};
    for (const code of cleaned) {
      const products = await prisma.product.findMany({
        where: {
          OR: [
            { oemCodes: { hasSome: [code, code.toLowerCase()] } },
            { alternativeSearchKeys: { hasSome: [code, code.toLowerCase()] } },
            { sku: { equals: code, mode: 'insensitive' } },
            { nameKa: { contains: code, mode: 'insensitive' } }
          ]
        },
        select: { id: true, nameKa: true, sku: true, price: true, stock: true, images: true, oemCodes: true },
        take: 3
      });
      results[code] = { found: products.length > 0, products };
    }
    res.json({ total: cleaned.length, found: Object.values(results).filter(r => r.found).length, results });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
