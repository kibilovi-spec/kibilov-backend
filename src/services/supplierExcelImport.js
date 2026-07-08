const { processFinaExcel } = require('./finaImportEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function importSupplierExcelBuffer(supplierId, buffer, source, fileName, markup = 0) {
  const { normalized, rejected, errors, reviewQueue } = await processFinaExcel(buffer, { markup });
  let added = 0, updated = 0;
  const skipped = errors.length;

  // normalized ახლა შეიცავს მხოლოდ 100%-Gate-ს გავლილ (accepted) row-ებს
  for (const row of normalized) {
    const existing = await prisma.productListing.findFirst({ where: { supplierId, sku: row.sku } });
    const data = {
      nameKa: row.nameKa,
      nameEn: row.nameEn,
      brand: row.brand || '',
      price: row.price,
      stock: row.stock,
      oemCodes: row.oemCodes || [],
      autodocCategoryId: row.autodocCategoryId || null,
      categoryConfidence: row.categoryConfidence || null,
      categoryMethod: row.categoryMethod || null,
      status: 'PENDING',
    };
    if (existing) {
      await prisma.productListing.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.productListing.create({ data: { supplierId, sku: row.sku, ...data } });
      added++;
    }
  }

  const rejectedCount = rejected.length;
  const total = normalized.length + rejected.length + errors.length;
  const status = (added === 0 && updated === 0 && total > 0)
    ? 'FAILED'
    : (rejectedCount > 0 || skipped > 0 ? 'PARTIAL' : 'SUCCESS');

  // rejected + parse-error სია ინახება JSON-ად log-ის errorMessage ველში
  // (ცალკე ცხრილს არ საჭიროებდა — მოთხოვნისამებრ /api/supplier/admin/:id/import-logs/:logId/rejected-report-ით წამოღება)
  const reportPayload = {
    rejected: rejected.map(r => ({
      sku: r.sku, nameKa: r.nameKa, oemCodes: r.oemCodes, crossCodes: r.crossCodes,
      confidence: r.confidence, method: r.method, reason: r.reason,
    })),
    parseErrors: errors,
  };

  const log = await prisma.supplierImportLog.create({ data: {
    supplierId, source, fileName: fileName || null,
    itemsFound: total, itemsCreated: added, itemsUpdated: updated, itemsFailed: rejectedCount + skipped, status,
    errorMessage: (rejectedCount + skipped) > 0 ? JSON.stringify(reportPayload) : null,
  }}).catch(() => null);

  return { added, updated, skipped, rejected: rejectedCount, total, reviewQueue, importLogId: log ? log.id : null };
}

module.exports = { importSupplierExcelBuffer };
