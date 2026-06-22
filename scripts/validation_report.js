require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('\n========================================');
  console.log('  KIBILOV AUTODOC VALIDATION REPORT');
  console.log('  ' + new Date().toLocaleString('ka-GE'));
  console.log('========================================\n');

  const [stats] = await prisma.$queryRaw`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE "isActive" = true) as active,
      COUNT(*) FILTER (WHERE "isActive" = false) as inactive,
      COUNT(*) FILTER (WHERE autodoc_category_id IS NOT NULL AND "isActive" = true) as with_category,
      COUNT(*) FILTER (WHERE "oemCodes" IS NOT NULL AND "oemCodes" != '{}' AND "isActive" = true) as with_oem,
      COUNT(*) FILTER (WHERE images IS NOT NULL AND images != '{}' AND "isActive" = true) as with_images,
      COUNT(*) FILTER (WHERE price > 0 AND "isActive" = true) as with_price,
      COUNT(*) FILTER (WHERE stock > 0 AND "isActive" = true) as in_stock
    FROM products
  `;

  const total = Number(stats.active);
  const cat = Number(stats.with_category);
  const oem = Number(stats.with_oem);
  const img = Number(stats.with_images);
  const price = Number(stats.with_price);
  const stock = Number(stats.in_stock);

  const pct = (n) => total > 0 ? (n/total*100).toFixed(1) + '%' : '0%';

  console.log('პროდუქტები:');
  console.log('  სულ აქტიური:    ' + total);
  console.log('  გათიშული:       ' + Number(stats.inactive));
  console.log('');
  console.log('მონაცემების ხარისხი:');
  console.log('  კატეგორია:      ' + cat + ' / ' + total + ' (' + pct(cat) + ')');
  console.log('  OEM კოდები:     ' + oem + ' / ' + total + ' (' + pct(oem) + ')');
  console.log('  სურათები:       ' + img + ' / ' + total + ' (' + pct(img) + ')');
  console.log('  ფასი:           ' + price + ' / ' + total + ' (' + pct(price) + ')');
  console.log('  მარაგში:        ' + stock + ' / ' + total + ' (' + pct(stock) + ')');

  // კატეგორიების განაწილება
  const cats = await prisma.$queryRaw`
    SELECT ac.name_en, COUNT(*) as cnt
    FROM products p
    JOIN autodoc_categories ac ON ac.autodoc_id = p.autodoc_category_id
    WHERE p."isActive" = true
    GROUP BY ac.name_en
    ORDER BY cnt DESC
    LIMIT 8
  `;
  console.log('');
  console.log('ტოპ კატეგორიები:');
  cats.forEach(c => console.log('  ' + c.name_en.padEnd(25) + Number(c.cnt)));

  // cross_reference cache
  const [crossStats] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM cross_reference_cache`;
  console.log('');
  console.log('Cross-reference cache:  ' + Number(crossStats.cnt) + ' ჩანაწერი');

  // overall score
  const score = ((cat + oem + img + price) / (total * 4) * 100).toFixed(1);
  console.log('');
  console.log('========================================');
  console.log('  OVERALL DATA QUALITY: ' + score + '%');
  console.log('========================================\n');

  await prisma.$disconnect();
})();
