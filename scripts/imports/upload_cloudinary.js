require('dotenv').config({ path: '/var/www/kibilov-backend/.env' });
const cloudinary = require('cloudinary').v2;
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient();
const uploadsDir = '/var/www/kibilov-backend/uploads/products';

async function run() {
  const products = await prisma.product.findMany({ select: { id: true, sku: true, images: true } });
  const files = fs.readdirSync(uploadsDir);
  
  let uploaded = 0;
  let skipped = 0;

  for (const p of products) {
    if (!p.sku) continue;
    // Skip if already on cloudinary
    if (p.images?.[0]?.includes('cloudinary')) { skipped++; continue; }
    
    const sku = p.sku.trim();
    const match = files.find(f => path.parse(f).name.trim().toLowerCase() === sku.toLowerCase());
    if (!match) continue;

    try {
      const filePath = path.join(uploadsDir, match);
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'kibilov/products',
        public_id: sku.replace(/\s+/g, '_'),
        overwrite: false,
      });
      await prisma.product.update({ where: { id: p.id }, data: { images: [result.secure_url] } });
      uploaded++;
      if (uploaded % 50 === 0) console.log(`✅ ${uploaded} ატვირთული...`);
    } catch(e) {
      console.error(`❌ ${sku}: ${e.message}`);
    }
  }
  
  console.log(`\n✅ სულ ატვირთული: ${uploaded}`);
  console.log(`⏭️ გამოტოვებული (უკვე cloudinary): ${skipped}`);
  await prisma.$disconnect();
}

run().catch(console.error);
