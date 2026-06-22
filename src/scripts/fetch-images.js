'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const IMAGES_DIR = path.join(__dirname, '../../../uploads/products');
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close(); fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close(); fs.unlinkSync(dest);
        return reject(new Error(`Status: ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', e => { try { fs.unlinkSync(dest); } catch {} reject(e); });
  });
}

async function searchImage(query) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(query + ' auto part product');
    const bingUrl = `https://www.bing.com/images/search?q=${encoded}&first=1`;
    https.get(bingUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/murl&quot;:&quot;(https?:\/\/[^&]+\.(?:jpg|jpeg|png|webp))/i);
        if (match) resolve(decodeURIComponent(match[1]));
        else reject(new Error('სურათი ვერ მოიძებნა'));
      });
    }).on('error', reject);
  });
}

async function main() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, nameEn: true, brand: true, images: true },
  });

  const noImage = products.filter(p => !p.images || p.images.length === 0);
  console.log(`📦 სურათის გარეშე: ${noImage.length}\n`);

  let success = 0, failed = 0;

  for (const p of noImage) {
    const query = `${p.brand} ${p.nameEn}`;
    const destPath = path.join(IMAGES_DIR, `${p.sku}.jpg`);
    try {
      console.log(`🔍 ვეძებ: ${query}`);
      const imageUrl = await searchImage(query);
      await download(imageUrl, destPath);
      await prisma.product.update({
        where: { id: p.id },
        data: { images: [`/uploads/products/${p.sku}.jpg`] },
      });
      console.log(`  ✅ ${p.sku}`);
      success++;
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.log(`  ❌ ${p.sku} - ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✅ წარმატებული: ${success}`);
  console.log(`❌ ვერ მოიძებნა: ${failed}`);
}

main()
  .catch(e => console.error('❌', e.message))
  .finally(() => prisma.$disconnect());
