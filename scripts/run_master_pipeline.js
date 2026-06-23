'use strict';
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { classifyProduct } = require('../src/services/productClassifier');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

async function step1_classify() {
  console.log('\n=== STEP 1: Classification' + (DRY_RUN ? ' [DRY-RUN]' : '') + ' ===');
  const products = await prisma.$queryRaw`
    SELECT id, sku, "nameKa", "nameEn", autodoc_category_id
    FROM products WHERE "isActive" = true
  `;
  let changed = 0, log = [];
  for (const p of products) {
    const res = classifyProduct({ nameKa: p.nameKa||'', nameEn: p.nameEn||'', sku: p.sku||'' });
    if (res.category !== Number(p.autodoc_category_id)) {
      log.push({ sku: p.sku, old: p.autodoc_category_id, new: res.category, reason: res.reason });
      if (!DRY_RUN) {
        await prisma.$executeRaw`UPDATE products SET autodoc_category_id = ${res.category} WHERE id = ${p.id}`;
      }
      changed++;
    }
  }
  log.slice(0, 20).forEach(l => console.log((DRY_RUN ? '[DRY] ' : '') + l.sku + ': ' + l.old + ' -> ' + l.new + ' (' + l.reason + ')'));
  console.log('\n=> ' + changed + ' changes' + (DRY_RUN ? ' (not written)' : ' written to DB'));
}

async function step2_validate() {
  console.log('\n=== STEP 2: Validation ===');
  const s = (await prisma.$queryRaw`
    SELECT COUNT(*) as total,
      COUNT(*) FILTER (WHERE autodoc_category_id IS NULL) as null_cat,
      COUNT(*) FILTER (WHERE autodoc_category_id = 999999) as uncategorized,
      COUNT(*) FILTER (WHERE images IS NOT NULL AND images != '{}') as has_image,
      COUNT(*) FILTER (WHERE "oemCodes" IS NOT NULL AND "oemCodes" != '{}') as has_oem
    FROM products WHERE "isActive" = true
  `)[0];
  console.log('Total:         ' + s.total);
  console.log('Uncategorized: ' + s.uncategorized);
  console.log('Has image:     ' + s.has_image + ' (' + Math.round(Number(s.has_image)/Number(s.total)*100) + '%)');
  console.log('Has OEM:       ' + s.has_oem + ' (' + Math.round(Number(s.has_oem)/Number(s.total)*100) + '%)');
  console.log('NULL category: ' + s.null_cat);
}

(async () => {
  console.log('KIBILOV MASTER PIPELINE');
  await step1_classify();
  await step2_validate();
  console.log('\nPIPELINE COMPLETE');
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
