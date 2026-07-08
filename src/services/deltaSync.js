const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deltaSync(normalizedRows) {
  const results = { created: 0, updated: 0, unchanged: 0, errors: 0 };

  for (const row of normalizedRows) {
    try {
      const existing = await prisma.product.findUnique({
        where: { sku: row.sku },
        select: { id: true, price: true, stock: true }
      });

      if (!existing) {
        await prisma.product.create({ data: row });
        results.created++;
      } else {
        const priceChanged = existing.price !== row.price;
        const stockChanged = existing.stock !== row.stock;

        if (priceChanged || stockChanged) {
          await prisma.product.update({
            where: { id: existing.id },
            data: { price: row.price, stock: row.stock, isActive: row.stock > 0 }
          });
          results.updated++;
        } else {
          results.unchanged++;
        }
      }
    } catch (e) {
      results.errors++;
    }
  }

  return results;
}

module.exports = { deltaSync };
