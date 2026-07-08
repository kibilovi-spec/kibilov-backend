require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const autodoc = require('../src/services/autodoc.js');
const fs = require('fs');

const prisma = new PrismaClient();
const LIMIT = parseInt(process.argv[2] || '20', 10);
const DELAY_MS = 400;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const products = await prisma.$queryRaw`
    SELECT id, sku, "nameKa" FROM products
    WHERE autodoc_category_id IS NULL
    AND "nameKa" ~ '^[A-Za-z0-9./ -]+$'
    ORDER BY id
    LIMIT ${LIMIT}
  `;

  console.log(`Testing OEM-based matching on ${products.length} pure-code products`);

  let matched = 0, notFound = 0, errors = 0;
  const results = [];

  for (const p of products) {
    try {
      const searchResult = await autodoc.searchByArticleNo(p.nameKa.trim());
      if (searchResult?.articles?.length === 1) {
        const articleId = searchResult.articles[0].articleId;
        const catResult = await autodoc.getArticleCategory(articleId);
        if (catResult?.categoryId) {
          await prisma.product.update({
            where: { id: p.id },
            data: { autodocCategoryId: catResult.categoryId }
          });
          matched++;
          results.push({ sku: p.sku, name: p.nameKa, categoryId: catResult.categoryId, categoryName: catResult.categoryName, status: 'matched' });
          console.log(`✓ ${p.nameKa} -> ${catResult.categoryId} (${catResult.categoryName})`);
        } else {
          notFound++;
          results.push({ sku: p.sku, name: p.nameKa, status: 'no_category' });
        }
      } else {
        notFound++;
        results.push({ sku: p.sku, name: p.nameKa, status: searchResult?.articles?.length > 1 ? 'ambiguous' : 'not_found', count: searchResult?.articles?.length || 0 });
        console.log(`✗ ${p.nameKa} -> ${searchResult?.articles?.length || 0} matches`);
      }
    } catch (e) {
      errors++;
      results.push({ sku: p.sku, name: p.nameKa, status: 'error', error: e.message });
      console.log(`! ${p.nameKa} -> ERROR: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  fs.writeFileSync('/var/www/kibilov-backend/docs/oem_match_test_results.json', JSON.stringify(results, null, 2), 'utf-8');

  console.log(`\nMatched: ${matched}, Not found/ambiguous: ${notFound}, Errors: ${errors}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
