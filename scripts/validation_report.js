require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  console.log('\n========================================');
  console.log('  KIBILOV AUTODOC VALIDATION REPORT');
  console.log('  ' + new Date().toLocaleString('ka-GE'));
  console.log('========================================\n');
  const [s] = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE "isActive"=true) as total,
      COUNT(*) FILTER (WHERE "isActive"=false) as inactive,
      COUNT(*) FILTER (WHERE autodoc_category_id IS NOT NULL AND "isActive"=true) as with_cat,
      COUNT(*) FILTER (WHERE "oemCodes" IS NOT NULL AND "oemCodes"!='{}' AND "isActive"=true) as with_oem,
      COUNT(*) FILTER (WHERE images IS NOT NULL AND images!='{}' AND "isActive"=true) as all_img,
      COUNT(*) FILTER (WHERE price>0 AND "isActive"=true) as with_price,
      COUNT(*) FILTER (WHERE stock>0 AND "isActive"=true) as in_stock,
      COUNT(*) FILTER (WHERE "isActive"=true AND sku NOT LIKE 'BB%' AND sku NOT LIKE 'SAK%' AND sku NOT LIKE 'KFC%' AND sku NOT LIKE 'SB%' AND sku NOT LIKE 'GB%' AND sku NOT LIKE 'LF%') as eligible,
      COUNT(*) FILTER (WHERE images IS NOT NULL AND images!='{}' AND "isActive"=true AND sku NOT LIKE 'BB%' AND sku NOT LIKE 'SAK%' AND sku NOT LIKE 'KFC%' AND sku NOT LIKE 'SB%' AND sku NOT LIKE 'GB%' AND sku NOT LIKE 'LF%') as eligible_img
    FROM products
  `;
  const total=Number(s.total), eligible=Number(s.eligible), local=total-eligible;
  const cat=Number(s.with_cat), oem=Number(s.with_oem), allImg=Number(s.all_img);
  const eligImg=Number(s.eligible_img), price=Number(s.with_price), stock=Number(s.in_stock);
  const pct=(n,d)=>d>0?(n/d*100).toFixed(1)+'%':'0%';
  console.log('პროდუქტები:');
  console.log('  სულ აქტიური:              '+total);
  console.log('  Autodoc-eligible:          '+eligible);
  console.log('  ლოკალური (BB/SAK/KFC/SB): '+local);
  console.log('  გათიშული:                 '+Number(s.inactive));
  console.log('');
  console.log('RAW DATA QUALITY (ყველა '+total+'):');
  console.log('  კატეგორია:  '+cat+'/'+total+' ('+pct(cat,total)+')');
  console.log('  OEM კოდი:   '+oem+'/'+total+' ('+pct(oem,total)+')');
  console.log('  სურათი:     '+allImg+'/'+total+' ('+pct(allImg,total)+')');
  console.log('  ფასი:       '+price+'/'+total+' ('+pct(price,total)+')');
  console.log('');
  console.log('EFFECTIVE DATA QUALITY:');
  console.log('  სურათი eligible '+eligible+': '+eligImg+'/'+eligible+' ('+pct(eligImg,eligible)+')');
  console.log('  სურათი N/A (ლოკალური):  '+local);
  console.log('  OEM (incl BB cross):     '+oem+'/'+total+' ('+pct(oem,total)+')');
  const cats = await prisma.$queryRaw`
    SELECT ac.name_en, COUNT(*) as cnt FROM products p
    JOIN autodoc_categories ac ON ac.autodoc_id=p.autodoc_category_id
    WHERE p."isActive"=true GROUP BY ac.name_en ORDER BY cnt DESC LIMIT 8
  `;
  console.log('');
  console.log('ტოპ კატეგორიები:');
  cats.forEach(c=>console.log('  '+c.name_en.padEnd(28)+Number(c.cnt)));
  const [cr] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM cross_reference_cache`;
  console.log('');
  console.log('Cross-reference cache: '+Number(cr.cnt)+' ჩანაწერი');
  const raw=((cat+oem+allImg+price)/(total*4)*100).toFixed(1);
  const eff=((eligImg/eligible+oem/total)/2*100).toFixed(1);
  console.log('');
  console.log('========================================');
  console.log('  RAW DATA QUALITY:       '+raw+'%');
  console.log('  EFFECTIVE DATA QUALITY: '+eff+'%');
  console.log('========================================\n');
  await prisma.$disconnect();
})();
