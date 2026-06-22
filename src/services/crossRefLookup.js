'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '98fcf77b13msh4c667e538cb11e8p15f12djsn70f2d789b288';
const HEADERS = { 'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com', 'x-rapidapi-key': RAPIDAPI_KEY };

const normalizeCode = (code) => code.replace(/[\s\-\.]/g, '').toUpperCase();

async function searchArticle(articleNo, articleType) {
  const r = await fetch(
    `https://autodoc-parts-catalog.p.rapidapi.com/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(articleNo)}&articleType=${articleType}`,
    { headers: HEADERS }
  );
  const d = await r.json();
  return d.articles || [];
}

async function getCrossRefs(searchCode) {
  const normCode = normalizeCode(searchCode);

  // DB cache check
  const cached = await prisma.$queryRawUnsafe(
    'SELECT found_codes FROM cross_reference_cache WHERE search_code = $1', normCode
  );
  if (cached.length > 0) {
    return cached[0].found_codes || [];
  }

  try {
    // Try all article types
    let articles = [];
    for (const type of ['ArticleNumber', 'OENumber', 'IAMNumber', 'TradeNumber']) {
      articles = await searchArticle(searchCode, type);
      if (articles.length > 0) {
        console.log('crossRef found via', type, ':', articles.length, 'articles');
        break;
      }
    }

    if (!articles.length) {
      await prisma.$queryRawUnsafe('INSERT INTO cross_reference_cache (search_code, found_codes) VALUES ($1, $2) ON CONFLICT (search_code) DO NOTHING', normCode, []);
      return [];
    }

    // Get cross references
    const articleId = articles[0].articleId;
    const r2 = await fetch(
      `https://autodoc-parts-catalog.p.rapidapi.com/api/artlookup/select-article-cross-references/article-id/${articleId}/lang-id/4`,
      { headers: HEADERS }
    );
    const d2 = await r2.json();
    const crossArticles = d2.articles || [];

    const codes = [...new Set(
      crossArticles.map(a => normalizeCode(a.articleNo)).filter(c => c.length >= 4)
    )];
    console.log('crossRef:', normCode, '->', codes.length, 'codes');

    await prisma.$queryRawUnsafe(
      'INSERT INTO cross_reference_cache (search_code, found_codes) VALUES ($1, $2) ON CONFLICT (search_code) DO UPDATE SET found_codes = $2',
      normCode, codes
    );

    return codes;
  } catch(e) {
    console.log('crossRef error:', e.message);
    return [];
  }
}

module.exports = { getCrossRefs, normalizeCode };
