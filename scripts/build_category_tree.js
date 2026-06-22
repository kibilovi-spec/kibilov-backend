require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ქართული სახელები root კატეგორიებისთვის
const KA = {
  100001: 'ძარის ნაწილები',
  100002: 'ძრავის ნაწილები', 
  100004: 'გამონაბოლქვი',
  100005: 'ფილტრები',
  100006: 'სამუხრუჭე სისტემა',
  100007: 'გაგრილების სისტემა',
  100008: 'საწვავის სისტემა',
  100009: 'ანთების სისტემა',
  100010: 'ელექტროობა',
  100011: 'სავალი ნაწილები',
  100012: 'საჭის სისტემა',
  100013: 'ტრანსმისია',
  100014: 'კლაჩი',
  100015: 'ზეთები და სითხეები',
  100016: 'საბურავები და დისკები',
  100017: 'სალონი',
  100018: 'გათბობა/კონდიცირება',
  100019: 'სერვისი',
  100020: 'ამძრავი სისტემა',
  100021: 'ამორტიზაცია',
};

// სურათები root კატეგორიებისთვის
const IMAGES = {
  100006: '/images/categories/brakes.png',
  100005: '/images/categories/filters.png',
  100011: '/images/categories/savali.png',
  100002: '/images/categories/engines.png',
  100015: '/images/categories/oils-fluids.png',
  100010: '/images/categories/electrics.png',
  100021: '/images/categories/amortizacia.png',
  100014: '/images/categories/clutch.png',
  100007: '/images/categories/cooling.png',
  100012: '/images/categories/steering.png',
  100020: '/images/categories/driveshaft.png',
  100001: '/images/categories/body.png',
  100016: '/images/categories/tires.png',
};

function slugify(name) {
  return name.toLowerCase()
    .replace(/[&\/\\#+()$~%.'":*?<>{}[\]]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function getArticlesByCategory(catId, vehicleId=8456) {
  const r = await fetch(
    `https://${HOST}/api/articles/list/type-id/1/vehicle-id/${vehicleId}/category-id/${catId}/lang-id/4`,
    { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST } }
  );
  const d = await r.json();
  return (d.articles || []).slice(0, 3);
}

async function getArticleCategories(articleId) {
  const r = await fetch(
    `https://${HOST}/api/articles/get-article-categories/article-id/${articleId}/lang-id/4`,
    { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST } }
  );
  return await r.json();
}

async function main() {
  // vehicle_oem-ში არსებული unique category IDs
  const catRows = await prisma.$queryRaw`
    SELECT DISTINCT category FROM vehicle_oem ORDER BY category
  `;
  const catIds = catRows.map(r => parseInt(r.category)).filter(Boolean);
  console.log(`Found ${catIds.length} unique categories in vehicle_oem`);

  const tree = new Map(); // categoryId -> {name, parentId, parentName, rootId, rootName}

  let processed = 0;
  for (const catId of catIds) {
    try {
      // article ID ამ კატეგორიისთვის
      const articles = await getArticlesByCategory(catId);
      if (!articles.length) { processed++; continue; }
      
      await sleep(200);
      
      const artCats = await getArticleCategories(articles[0].articleId);
      await sleep(200);
      
      if (!Array.isArray(artCats)) { processed++; continue; }
      
      for (const ac of artCats) {
        if (ac.categoryId !== catId) continue;
        
        const parents = ac.categoryParentName || [];
        
        // leaf კატეგორია
        tree.set(catId, {
          id: catId,
          name: ac.categoryName,
          parentId: ac.categoryParentId || null,
          level: parents.length + 1,
        });
        
        // parent კატეგორიები
        for (let i = 0; i < parents.length; i++) {
          const p = parents[i];
          if (!tree.has(p.categoryId)) {
            tree.set(p.categoryId, {
              id: p.categoryId,
              name: p.categoryName,
              parentId: i + 1 < parents.length ? parents[i+1].categoryId : null,
              level: parents.length - i,
            });
          }
        }
        break;
      }
      
      processed++;
      if (processed % 10 === 0) console.log(`Progress: ${processed}/${catIds.length}`);
    } catch(e) {
      console.error(`Cat ${catId}: ${e.message}`);
      processed++;
    }
  }

  console.log(`\nTree built: ${tree.size} categories`);

  // DB-ში ახალი ცხრილი
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS autodoc_categories (
      id SERIAL PRIMARY KEY,
      autodoc_id INTEGER UNIQUE NOT NULL,
      parent_id INTEGER,
      name_en TEXT NOT NULL,
      name_ka TEXT,
      slug TEXT,
      level INTEGER DEFAULT 1,
      image_url TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // tree DB-ში ჩავწეროთ
  let inserted = 0;
  for (const [id, cat] of tree) {
    const nameKa = KA[id] || cat.name;
    const slug = slugify(cat.name);
    const image = IMAGES[id] || null;
    
    await prisma.$executeRaw`
      INSERT INTO autodoc_categories (autodoc_id, parent_id, name_en, name_ka, slug, level, image_url)
      VALUES (${id}, ${cat.parentId}, ${cat.name}, ${nameKa}, ${slug}, ${cat.level}, ${image})
      ON CONFLICT (autodoc_id) DO UPDATE SET
        parent_id = EXCLUDED.parent_id,
        name_en = EXCLUDED.name_en,
        level = EXCLUDED.level
    `;
    inserted++;
  }

  console.log(`✅ inserted/updated: ${inserted}`);

  // Root კატეგორიები
  const roots = await prisma.$queryRaw`
    SELECT autodoc_id, name_en, name_ka, level
    FROM autodoc_categories
    WHERE parent_id IS NULL
    ORDER BY autodoc_id
  `;
  console.log('\nRoot categories:');
  roots.forEach(r => console.log(`  ${r.autodoc_id}: ${r.name_en} (${r.name_ka || '-'})`));

  await prisma.$disconnect();
}

main().catch(console.error);
