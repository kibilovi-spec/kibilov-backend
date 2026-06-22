const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const KEY = '98fcf77b13msh4c667e538cb11e8p15f12djsn70f2d789b288';
const H = { 'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com', 'x-rapidapi-key': KEY };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getCandidates(code) {
  try {
    for (const type of ['ArticleNumber', 'OENumber', 'IAMNumber']) {
      const r1 = await fetch(
        `https://autodoc-parts-catalog.p.rapidapi.com/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(code)}&articleType=${type}`,
        { headers: H }
      );
      const d1 = await r1.json();
      const article = (d1.articles||[])[0];
      if (!article?.articleId) continue;
      const r2 = await fetch(
        `https://autodoc-parts-catalog.p.rapidapi.com/api/articles/get-article-categories/article-id/${article.articleId}/lang-id/4`,
        { headers: H }
      );
      const d2 = await r2.json();
      if (!Array.isArray(d2) || !d2.length) continue;
      const cat = d2[0];
      return [
        { categoryId: cat.categoryId, categoryName: cat.categoryName },
        ...(cat.categoryParentName||[]).map(p => ({ categoryId: p.categoryId, categoryName: p.categoryName }))
      ];
    }
  } catch(e) {}
  return [];
}

async function getCrossRefs(code) {
  try {
    const norm = code.replace(/[\s\-\.]/g,'').toUpperCase();
    const cached = await prisma.$queryRawUnsafe(
      'SELECT found_codes FROM cross_reference_cache WHERE search_code = $1', norm
    );
    return cached[0]?.found_codes || [];
  } catch(e) { return []; }
}

async function findCategory(codes) {
  for (const code of codes) {
    const candidates = await getCandidates(code);
    for (const c of candidates) {
      const exists = await prisma.$queryRawUnsafe(
        'SELECT autodoc_id, name_en FROM autodoc_categories WHERE autodoc_id = $1', c.categoryId
      );
      if (exists.length > 0) return { categoryId: c.categoryId, categoryName: c.categoryName };
    }
    await sleep(200);
  }
  return null;
}

(async () => {
  let total = 0, found = 0, skipped = 0;
  console.log('Category enrich started...\n');

  while (true) {
    const products = await prisma.$queryRaw`
      SELECT id, sku, "oemCodes", "alternativeSearchKeys"
      FROM products
      WHERE "isActive"=true
      AND autodoc_category_id IS NULL
      AND array_length("oemCodes",1) > 0
      LIMIT 50
    `;
    if (!products.length) { console.log('\nDone!'); break; }

    for (const p of products) {
      total++;
      const allCodes = [...new Set([...(p.oemCodes||[]), ...(p.alternativeSearchKeys||[])])];

      let matched = await findCategory(allCodes);

      if (!matched) {
        for (const code of allCodes.slice(0,2)) {
          const crossCodes = await getCrossRefs(code);
          matched = await findCategory(crossCodes.slice(0,5));
          if (matched) break;
        }
      }

      if (matched) {
        await prisma.$queryRawUnsafe(
          'UPDATE products SET autodoc_category_id = $1 WHERE id = $2',
          matched.categoryId, p.id
        );
        found++;
        console.log('OK [' + total + '] ' + p.sku + ' -> ' + matched.categoryName + ' (' + matched.categoryId + ')');
      } else {
        skipped++;
        console.log('NO [' + total + '] ' + p.sku);
      }
      await sleep(400);
    }
    console.log('\n-- ' + total + ' total | ' + found + ' found | ' + skipped + ' skipped\n');
  }
  await prisma.$disconnect();
})();
