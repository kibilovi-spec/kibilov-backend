const { PrismaClient } = require('@prisma/client');
const { matchCategory } = require('../src/services/categoryMatcher');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { autodocCategoryId: null },
    select: { id: true, sku: true, nameKa: true }
  });

  console.log(`Total unmatched: ${products.length}`);

  let matched90 = 0;
  let matched70 = 0;
  let stillUnknown = 0;
  const needsReview = [];

  for (const p of products) {
    const match = await matchCategory(p.nameKa);
    if (match.confidence >= 90) {
      await prisma.product.update({
        where: { id: p.id },
        data: { autodocCategoryId: match.categoryId }
      });
      matched90++;
    } else if (match.confidence >= 70) {
      await prisma.product.update({
        where: { id: p.id },
        data: { autodocCategoryId: match.categoryId }
      });
      needsReview.push({ sku: p.sku, name: p.nameKa, categoryId: match.categoryId, confidence: match.confidence });
      matched70++;
    } else {
      stillUnknown++;
    }
  }

  fs.writeFileSync(
    '/var/www/kibilov-backend/docs/rematch_review_needed.json',
    JSON.stringify(needsReview, null, 2),
    'utf-8'
  );

  console.log(`Auto-matched (>=90): ${matched90}`);
  console.log(`Matched, needs review (70-89): ${matched70}`);
  console.log(`Still unknown (<70): ${stillUnknown}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
