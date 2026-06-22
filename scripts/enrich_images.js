const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const KEY = '98fcf77b13msh4c667e538cb11e8p15f12djsn70f2d789b288';
const H = { 'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com', 'x-rapidapi-key': KEY };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function findImage(code) {
  try {
    for (const type of ['IAMNumber', 'ArticleNumber', 'OENumber']) {
      const r1 = await fetch(
        `https://autodoc-parts-catalog.p.rapidapi.com/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(code)}&articleType=${type}`,
        { headers: H }
      );
      const d1 = await r1.json();
      const article = (d1.articles||[])[0];
      if (!article?.articleId) { await sleep(300); continue; }
      const r2 = await fetch(
        `https://autodoc-parts-catalog.p.rapidapi.com/api/articles/article-all-media-info?langId=4&articleId=${article.articleId}`,
        { headers: H }
      );
      const media = await r2.json();
      const img = (Array.isArray(media) ? media : []).find(m =>
        m.articleMediaType === 'JPEG' || m.articleMediaType === 'WEBP'
      );
      if (img?.s3image) return img.s3image;
    }
  } catch(e) {}
  return null;
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

(async () => {
  let total = 0, found = 0, skipped = 0;
  console.log('Image enrich started...\n');

  while (true) {
    const products = await prisma.$queryRaw`
      SELECT id, sku, "oemCodes", "alternativeSearchKeys"
      FROM products
      WHERE "isActive"=true
      AND (images IS NULL OR array_length(images,1) IS NULL)
      AND array_length("oemCodes",1) > 0
      LIMIT 50
    `;
    if (!products.length) { console.log('\nDone!'); break; }

    for (const p of products) {
      total++;
      const allCodes = [...new Set([...(p.oemCodes||[]), ...(p.alternativeSearchKeys||[])])];
      let imgUrl = null;

      // 1. OEM კოდები
      for (const code of allCodes) {
        imgUrl = await findImage(code);
        if (imgUrl) break;
        await sleep(200);
      }

      // 2. Cross ref კოდები
      if (!imgUrl) {
        for (const code of allCodes.slice(0,2)) {
          const crossCodes = await getCrossRefs(code);
          for (const cc of crossCodes.slice(0,5)) {
            imgUrl = await findImage(cc);
            if (imgUrl) break;
            await sleep(200);
          }
          if (imgUrl) break;
        }
      }

      if (imgUrl) {
        await prisma.$queryRawUnsafe(
          'UPDATE products SET images = ARRAY[$1] WHERE id = $2', imgUrl, p.id
        );
        found++;
        console.log('OK [' + total + '] ' + p.sku);
      } else {
        await prisma.$queryRawUnsafe(
          "UPDATE products SET images = '{}' WHERE id = $1", p.id
        );
        skipped++;
        console.log('NO [' + total + '] ' + p.sku);
      }
      await sleep(400);
    }
    console.log('\n-- ' + total + ' | OK:' + found + ' | NO:' + skipped + '\n');
  }
  await prisma.$disconnect();
})();
