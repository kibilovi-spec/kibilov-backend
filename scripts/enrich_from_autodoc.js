'use strict';
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '98fcf77b13msh4c667e538cb11e8p15f12djsn70f2d789b288';
const HEADERS = {
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com',
};
const BASE = 'https://autodoc-parts-catalog.p.rapidapi.com';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function searchArticle(articleNo) {
  try {
    const r = await axios.get(`${BASE}/api/artlookup/search-articles-by-article-no`, {
      headers: HEADERS,
      params: { langId: 4, articleNo, articleType: 'ArticleNumber' },
      timeout: 10000,
    });
    const arts = r.data?.articles;
    if (arts && arts.length > 0) return arts[0];
    return null;
  } catch { return null; }
}

async function getArticleDetails(articleId) {
  try {
    const r = await axios.get(`${BASE}/api/articles/details/article-id/${articleId}/lang-id/4`, {
      headers: HEADERS,
      timeout: 10000,
    });
    return r.data || null;
  } catch { return null; }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // cross კოდებიანი პროდუქტები
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      alternativeSearchKeys: { isEmpty: false },
    },
    select: {
      id: true, sku: true, nameKa: true, brand: true,
      alternativeSearchKeys: true, images: true,
    },
  });

  console.log(`სულ ${products.length} პროდუქტი cross კოდებით`);

  let enriched = 0, failed = 0, skipped = 0;

  for (const p of products) {
    const crossCodes = p.alternativeSearchKeys || [];
    if (crossCodes.length === 0) { skipped++; continue; }

    let article = null;
    let usedCode = null;

    // ყველა cross კოდი ვცადოთ სანამ ვიპოვით
    for (const code of crossCodes.slice(0, 5)) {
      const cleaned = code.replace(/\s+/g, '').toUpperCase();
      article = await searchArticle(cleaned);
      if (!article) article = await searchArticle(code);
      if (article) { usedCode = code; break; }
      await sleep(200);
    }

    if (!article) { failed++; continue; }

    const details = await getArticleDetails(article.articleId);
    await sleep(300);

    if (!details) { failed++; continue; }

    // specs
    const specs = {};
    for (const s of details.articleAllSpecifications || []) {
      specs[s.criteriaName] = s.criteriaValue;
    }

    // OEM კოდები
    const newOems = (details.articleOemNo || []).map(o => o.oemDisplayNo).filter(Boolean);

    // სახელი EN
    const nameEn = article.articleProductName || null;

    // სურათი
    const newImage = article.s3image || null;
    const images = p.images && p.images.length > 0 ? p.images : (newImage ? [newImage] : []);

    console.log(`✅ ${p.sku} → ${usedCode} → ${nameEn} | specs: ${Object.keys(specs).length} | oems: ${newOems.length}`);

    if (!dryRun) {
      const updateData = {};
      if (nameEn) updateData.nameEn = nameEn;
      if (images.length > 0) updateData.images = images;
      if (newOems.length > 0) {
        const existing = p.oemCodes || [];
        const merged = [...new Set([...existing, ...newOems])];
        updateData.oemCodes = merged;
      }
      if (Object.keys(specs).length > 0) {
        updateData.descriptionEn = Object.entries(specs)
          .map(([k, v]) => `${k}: ${v}`).join('\n');
      }

      if (article.articleId) updateData.autodocArticleId = Number(article.articleId);
      if (Object.keys(updateData).length > 0) {
        await prisma.product.update({
          where: { id: p.id },
          data: updateData,
        });
        enriched++;
      }
    } else {
      enriched++;
    }

    await sleep(400);
  }

  console.log(`\n=== შედეგი ===`);
  console.log(`enriched: ${enriched}`);
  console.log(`failed: ${failed}`);
  console.log(`skipped: ${skipped}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
