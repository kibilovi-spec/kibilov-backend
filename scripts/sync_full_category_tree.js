require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const autodoc = require('../src/services/autodoc');

function slugify(name) {
  return String(name).toLowerCase()
    .replace(/[&\/\\#+()$~%.'":*?<>{}]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function flatten(node, parentId, out) {
  if (!node || typeof node !== 'object') return;
  if (node.categoryId) {
    out.push({
      autodoc_id: node.categoryId,
      name_en: node.categoryName,
      level: node.level || null,
      parent_id: parentId,
    });
  }
  const children = node.children;
  if (children && typeof children === 'object') {
    for (const key of Object.keys(children)) {
      flatten(children[key], node.categoryId || parentId, out);
    }
  }
}

async function main() {
  console.log('Fetching full category tree from Autodoc...');
  const tree = await autodoc.getCategoryTree(1, 4);

  const flat = [];
  for (const topKey of Object.keys(tree)) {
    flatten(tree[topKey], null, flat);
  }
  console.log(`Flattened total categories from Autodoc: ${flat.length}`);

  const existingRows = await prisma.$queryRaw`SELECT autodoc_id FROM autodoc_categories`;
  const existingIds = new Set(existingRows.map(r => Number(r.autodoc_id)));
  console.log(`Already in local DB: ${existingIds.size}`);

  const toInsert = flat.filter(c => !existingIds.has(c.autodoc_id));
  console.log(`New categories to insert: ${toInsert.length}`);

  let inserted = 0;
  for (const c of toInsert) {
    try {
      await prisma.$executeRaw`
        INSERT INTO autodoc_categories (autodoc_id, name_en, slug, level, parent_id, is_active, sort_order, created_at)
        VALUES (${c.autodoc_id}, ${c.name_en}, ${slugify(c.name_en)}, ${c.level}, ${c.parent_id}, true, 999, NOW())
        ON CONFLICT (autodoc_id) DO NOTHING
      `;
      inserted++;
    } catch (e) {
      console.error(`Failed to insert ${c.autodoc_id} (${c.name_en}): ${e.message}`);
    }
  }
  console.log(`✅ Inserted: ${inserted}`);

  const total = await prisma.$queryRaw`SELECT COUNT(*)::int as cnt FROM autodoc_categories`;
  console.log(`Total autodoc_categories now: ${total[0].cnt}`);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
