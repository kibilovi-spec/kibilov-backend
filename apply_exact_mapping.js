const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function norm(s) {
  return String(s || '').toLowerCase().replace(/[\/\-,.()\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}

(async () => {
  const orphans = await prisma.$queryRaw`
    SELECT autodoc_id, name_en FROM autodoc_categories
    WHERE level = 1 AND autodoc_id NOT IN (999999, 105500)
  `;
  const allNested = await prisma.$queryRaw`
    SELECT autodoc_id, name_en FROM autodoc_categories WHERE parent_id IS NOT NULL
  `;

  let applied = 0;
  for (const o of orphans) {
    const oName = norm(o.name_en);
    const match = allNested.find(n => norm(n.name_en) === oName);
    if (match) {
      await prisma.$executeRaw`
        UPDATE autodoc_categories SET canonical_category_id = ${Number(match.autodoc_id)}
        WHERE autodoc_id = ${Number(o.autodoc_id)}
      `;
      console.log(`[OK] ${o.autodoc_id} "${o.name_en}" -> canonical ${match.autodoc_id}`);
      applied++;
    }
  }
  console.log(`\nApplied ${applied} EXACT canonical mappings.`);
  process.exit(0);
})();
