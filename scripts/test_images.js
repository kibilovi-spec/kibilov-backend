const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const KEY = '98fcf77b13msh4c667e538cb11e8p15f12djsn70f2d789b288';
const HEADERS = { 'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com', 'x-rapidapi-key': KEY };

async function findImage(oemCode) {
  // Step 1: article search
  const r1 = await fetch(
    `https://autodoc-parts-catalog.p.rapidapi.com/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(oemCode)}&articleType=ArticleNumber`,
    { headers: HEADERS }
  );
  const d1 = await r1.json();
  const article = (d1.articles || [])[0];
  if (!article?.articleId) return null;

  // Step 2: media
  const r2 = await fetch(
    `https://autodoc-parts-catalog.p.rapidapi.com/api/articles/article-all-media-info?langId=4&articleId=${article.articleId}`,
    { headers: HEADERS }
  );
  const media = await r2.json();
  const img = (Array.isArray(media) ? media : []).find(m => m.articleMediaType === 'JPEG' || m.articleMediaType === 'WEBP');
  return img?.s3image || null;
}

(async () => {
  const products = await prisma.$queryRaw`
    SELECT id, sku, "oemCodes" FROM products 
    WHERE "isActive"=true AND array_length("oemCodes",1) > 0
    AND (images IS NULL OR array_length(images,1) IS NULL)
    LIMIT 10
  `;
  
  let found = 0;
  for (const p of products) {
    const code = p.oemCodes[0];
    const img = await findImage(code);
    if (img) found++;
    console.log(p.sku, '|', code, '|', img ? '✅ '+img.slice(-30) : '❌');
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`\nშედეგი: ${found}/10 სურათი მოიძებნა`);
  await prisma.$disconnect();
})();
