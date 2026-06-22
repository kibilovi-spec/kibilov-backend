'use strict';
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const https = require('https');

const API_KEY = '98fcf77b13msh4c667e538cb11e8p15f12djsn70f2d789b288';
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const DELAY = 400;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'GET', hostname: HOST, path,
      headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': HOST }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Get products without real images
  const products = await prisma.$queryRaw`
    SELECT id, "nameKa", "oemCodes", "alternativeSearchKeys", sku
    FROM products
    WHERE "isActive" = true
    AND (image_status IS NULL OR image_status = 'PLACEHOLDER' OR image_status = 'NO_IMAGE')
    AND "oemCodes" IS NOT NULL
    AND array_length("oemCodes", 1) > 0
    LIMIT 500
  `;
  
  console.log(`Products to process: ${products.length}`);
  let updated = 0;

  for (const p of products) {
    const codes = p.oemCodes || [];
    // Try non-manufacturer codes first
    const cleanCode = codes.find(c => !c.includes(':')) || codes[0];
    if (!cleanCode) continue;

    try {
      let data = await apiGet(`/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(cleanCode)}&articleType=OENumber`);
      if (!((data.articles||[]).find(a => a.s3image))) {
        data = await apiGet(`/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(cleanCode)}&articleType=ArticleNumber`);
        await sleep(DELAY);
      }
      const articles = data.articles || [];
      const withImage = articles.find(a => a.s3image);
      
      if (withImage) {
        await prisma.$executeRaw`
          UPDATE products 
          SET images = ARRAY[${withImage.s3image}::text], image_status = 'REAL'
          WHERE id = ${p.id}
        `;
        updated++;
        console.log(`✅ ${p.nameKa?.substring(0,30)} → ${withImage.s3image.substring(0,50)}`);
      }
    } catch(e) { console.error(`Error ${p.id}:`, e.message); }
    
    await sleep(DELAY);
  }

  console.log(`\nDone! Updated: ${updated}/${products.length}`);
  await prisma.$disconnect();
}

main().catch(console.error);
