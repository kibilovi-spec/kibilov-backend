'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const IMAGES_DIR = path.join(__dirname, '../../uploads/products');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
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
    }).on('error', reject);
  });
}

async function searchImage(query) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(query);
    https.get(`https://www.bing.com/images/search?q=${encoded}&first=1`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/murl&quot;:&quot;(https?:\/\/[^&]+\.(?:jpg|jpeg|png|webp))/i);
        if (match) resolve(decodeURIComponent(match[1]));
        else reject(new Error('ვერ მოიძებნა'));
      });
    }).on('error', reject);
  });
}

async function main() {
  const queries = ['KYB shock absorber', 'shock absorber KYB product', 'car shock absorber'];
  const destPath = path.join(IMAGES_DIR, 'SKU-005.jpg');
  
  for (const q of queries) {
    try {
      console.log(`🔍 ვეძებ: ${q}`);
      const url = await searchImage(q);
      await download(url, destPath);
      await prisma.product.update({
        where: { sku: 'SKU-005' },
        data: { images: ['/uploads/products/SKU-005.jpg'] },
      });
      console.log('✅ SKU-005 წარმატებით!');
      break;
    } catch (e) {
      console.log(`  ❌ ${e.message}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
