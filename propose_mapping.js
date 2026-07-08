const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function norm(s) {
  return String(s || '').toLowerCase().replace(/[\/\-,.()\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}

(async () => {
  const orphans = await prisma.$queryRaw`
    SELECT autodoc_id, name_en FROM autodoc_categories
    WHERE level = 1 AND autodoc_id NOT IN (999999, 105500)
    ORDER BY name_en
  `;

  const allNested = await prisma.$queryRaw`
    SELECT autodoc_id, name_en, parent_id, level FROM autodoc_categories
    WHERE parent_id IS NOT NULL
  `;

  const results = [];
  for (const o of orphans) {
    const oName = norm(o.name_en);
    let match = allNested.find(n => norm(n.name_en) === oName);
    let matchType = 'EXACT';
    if (!match) {
      match = allNested.find(n => norm(n.name_en).includes(oName) || oName.includes(norm(n.name_en)));
      matchType = match ? 'PARTIAL' : 'NONE';
    }
    results.push({
      orphan_id: Number(o.autodoc_id),
      orphan_name: o.name_en,
      match_type: matchType,
      suggested_canonical_id: match ? Number(match.autodoc_id) : null,
      suggested_canonical_name: match ? match.name_en : null,
    });
  }

  console.log('orphan_id\torphan_name\tmatch_type\tsuggested_id\tsuggested_name');
  for (const r of results) {
    console.log(`${r.orphan_id}\t${r.orphan_name}\t${r.match_type}\t${r.suggested_canonical_id || '-'}\t${r.suggested_canonical_name || '(NO MATCH)'}`);
  }

  const exact = results.filter(r=>r.match_type==='EXACT').length;
  const partial = results.filter(r=>r.match_type==='PARTIAL').length;
  const none = results.filter(r=>r.match_type==='NONE').length;
  console.log(`\nTotal: ${results.length}, EXACT: ${exact}, PARTIAL: ${partial}, NO MATCH: ${none}`);

  process.exit(0);
})();
