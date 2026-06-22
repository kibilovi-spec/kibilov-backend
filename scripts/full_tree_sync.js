require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';

const KA = {
  // Root categories
  100733: 'აქსესუარები',
  100756: 'კონდიციონერი',
  100013: 'ღერძის ამძრავი',
  100211: 'ღერძის მოამაგრებელი/საჭე/თვლები',
  100016: 'სარტყლის ამძრავი',
  100001: 'ძარა',
  100006: 'სამუხრუჭე სისტემა',
  100786: 'სატვირთო აღჭურვილობა',
  100050: 'კლაჩი',
  100763: 'კომფორტის სისტემები',
  100785: 'პნევმატური სისტემა',
  100007: 'გაგრილების სისტემა',
  100010: 'ელექტრიკა',
  100002: 'ძრავი',
  100004: 'გამონაბოლქვის სისტემა',
  100005: 'ფილტრები',
  100008: 'საწვავის მიქსერი',
  100214: 'საწვავის მიწოდების სისტემა',
  100799: 'ფარების გამწმენდი',
  100018: 'გათბობა/ვენტილაცია',
  100795: 'ჰიბრიდული/ელექტრო ამძრავი',
  100764: 'საინფორმაციო სისტემები',
  100017: 'სალონი',
  100765: 'სამკეტი სისტემა',
  100019: 'სერვისი',
  100797: 'ძალის გადაცემა',
  100766: 'უსაფრთხოების სისტემები',
  100008: 'ანთების სისტემა',
  100798: 'სპეციალური ხელსაწყოები',
  100012: 'საჭის სისტემა',
  100011: 'სავალი/ამორტიზაცია',
  100800: 'სამისაბმელო მოწყობილობა',
  100020: 'ტრანსმისია',
  100014: 'კარდანი',
  100015: 'საბურავები/დისკები',
  100801: 'ფანჯრის გამწმენდი',
};

function slugify(name) {
  return name.toLowerCase()
    .replace(/[&\/\\#+()$~%.'":*?<>{}[\]]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

function flatten(node, parentId, results) {
  const id = node.categoryId;
  results.push({
    autodoc_id: id,
    parent_id: parentId,
    name_en: node.categoryName,
    name_ka: KA[id] || null,
    slug: slugify(node.categoryName),
    level: node.level,
  });
  if (node.children && typeof node.children === 'object') {
    for (const child of Object.values(node.children)) {
      flatten(child, id, results);
    }
  }
}

async function main() {
  const r = await fetch(
    `https://${HOST}/api/category/type-id/1/list-category-tree-structure/lang-id/4`,
    { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST } }
  );
  const tree = await r.json();
  console.log(`Root categories: ${Object.keys(tree).length}`);

  const all = [];
  for (const node of Object.values(tree)) {
    flatten(node, null, all);
  }
  console.log(`Total nodes: ${all.length}`);

  let inserted = 0;
  for (const c of all) {
    await prisma.$executeRaw`
      INSERT INTO autodoc_categories (autodoc_id, parent_id, name_en, name_ka, slug, level)
      VALUES (${c.autodoc_id}, ${c.parent_id}, ${c.name_en}, ${c.name_ka}, ${c.slug}, ${c.level})
      ON CONFLICT (autodoc_id) DO UPDATE SET
        parent_id = EXCLUDED.parent_id,
        name_en   = EXCLUDED.name_en,
        name_ka   = COALESCE(autodoc_categories.name_ka, EXCLUDED.name_ka),
        slug      = EXCLUDED.slug,
        level     = EXCLUDED.level
    `;
    inserted++;
  }
  console.log(`✅ synced: ${inserted}`);

  const roots = await prisma.$queryRaw`
    SELECT autodoc_id, name_en, name_ka, level
    FROM autodoc_categories WHERE parent_id IS NULL ORDER BY name_en
  `;
  console.log(`\nRoots (${roots.length}):`);
  roots.forEach(r => console.log(`  ${r.autodoc_id}: ${r.name_en} / ${r.name_ka||'—'}`));

  await prisma.$disconnect();
}
main().catch(console.error);
