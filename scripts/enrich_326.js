const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.$queryRaw`
    SELECT id, "oemCodes", "nameKa", brand
    FROM products
    WHERE "isActive"=true
    AND ("alternativeSearchKeys" IS NULL OR "alternativeSearchKeys" = '{}')
    AND "oemCodes" IS NOT NULL
    AND array_length("oemCodes",1) > 0
    LIMIT 326
  `;
  
  console.log(`Found: ${products.length}`);
  
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
  const headers = {'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': HOST};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  
  let ok=0, fail=0;
  
  for(const p of products) {
    const oem = p.oemCodes?.[0];
    if(!oem) { fail++; continue; }
    
    try {
      const url = `https://${HOST}/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(oem)}&articleType=ArticleNumber`;
      const r = await fetch(url, {headers});
      const d = await r.json();
      const arts = Array.isArray(d) ? d : (d.articles||[]);
      
      if(!arts?.length) { fail++; await sleep(1500); continue; }
      
      const keys = new Set();
      for(const a of arts.slice(0,3)) {
        if(a.articleNo) keys.add(a.articleNo);
        if(a.mfrName) keys.add(a.mfrName);
        if(a.genericArticles?.[0]?.genericArticleDescription) 
          keys.add(a.genericArticles[0].genericArticleDescription);
      }
      
      if(keys.size > 0) {
        await prisma.product.update({
          where:{id:p.id},
          data:{alternativeSearchKeys:{set:[...keys]}}
        });
        console.log(`✅ ${p.brand} ${oem} → ${[...keys].join(', ')}`);
        ok++;
      }
      await sleep(1500);
    } catch(e) {
      console.log(`❌ ${oem}: ${e.message}`);
      fail++;
      await sleep(2000);
    }
  }
  
  console.log(`\nDone: ${ok} ok, ${fail} fail`);
  await prisma.$disconnect();
}

main();
