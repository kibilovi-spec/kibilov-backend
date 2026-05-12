'use strict';
/**
 * სურათების მიბმა პროდუქტებთან
 * გამოყენება: node src/scripts/link-images.js
 * 
 * სურათები უნდა იყოს: backend/uploads/products/
 * სახელები: პროდუქტის კოდი (სფეისებით ან გარეშე)
 * მაგ: "0 986 580 508.jpg" ან "0986580508.jpg"
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const IMAGES_DIR = process.env.IMAGES_DIR || 
  path.join(__dirname, '../../../uploads/products');
const BASE_URL   = process.env.BACKEND_URL || 'http://localhost:3001';

// normalize: remove spaces, lowercase
function norm(str) {
  return str.toLowerCase().replace(/\s+/g, '').replace(/[_\-]/g, '');
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`❌ საქაღალდე არ მოიძებნა: ${IMAGES_DIR}`);
    process.exit(1);
  }

  // Read all image files
  const files = fs.readdirSync(IMAGES_DIR).filter(f =>
    /\.(jpg|jpeg|png|webp|gif)$/i.test(f)
  );
  console.log(`📸 სურათები: ${files.length}\n`);

  // Build lookup map: normalizedName -> filename
  const imageMap = new Map();
  for (const f of files) {
    const nameWithoutExt = path.basename(f, path.extname(f));
    imageMap.set(norm(nameWithoutExt), f);
  }

  // Get all products
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, nameKa: true, images: true },
  });
  console.log(`📦 პროდუქტები: ${products.length}\n`);

  let matched = 0, skipped = 0, already = 0;

  for (const p of products) {
    // Try to find image by SKU (normalized)
    const skuNorm = norm(p.sku);
    const imageFile = imageMap.get(skuNorm);

    if (!imageFile) {
      skipped++;
      continue;
    }

    // Skip if already has this image
    const imageUrl = `/uploads/products/${encodeURIComponent(imageFile)}`;
    if (p.images?.includes(imageUrl)) {
      already++;
      continue;
    }

    await prisma.product.update({
      where: { id: p.id },
      data:  { images: [imageUrl] },
    });
    matched++;

    if (matched % 100 === 0) console.log(`  ✅ ${matched} მიბმული...`);
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`✅ მიბმული:    ${matched}`);
  console.log(`⏭️  გამოტოვდა:  ${skipped} (სურათი ვერ მოიძებნა)`);
  console.log(`🔄 უკვე ჰქონდა: ${already}`);
  console.log('─'.repeat(50));
  console.log(`\n🎉 დასრულდა! სურათები მიბმულია.\n`);
  
  if (skipped > 0) {
    console.log(`💡 რჩევა: ${skipped} პროდუქტს სურათი ვერ ვუძებნე.`);
    console.log(`   შეამოწმე სახელები ემთხვევა თუ არა SKU-ს.\n`);
  }
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
