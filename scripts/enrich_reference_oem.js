require('dotenv').config({ path: '/var/www/kibilov-backend/.env' });
const { PrismaClient } = require('@prisma/client');
const autodoc = require('../src/services/autodoc');
const fs = require('fs');
const prisma = new PrismaClient();

const CHECKPOINT_FILE = '/var/www/kibilov-backend/scripts/enrich_reference_oem.checkpoint.json';
const BATCH_SIZE = 100;
const SLEEP_MS = 150;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadCheckpoint() {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')); }
  catch { return { offset: 0 }; }
}
function saveCheckpoint(cp) { fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp)); }

let totalCalls = 0;
function logProgress(msg) {
  console.log(`[${new Date().toISOString()}] ${msg} (calls: ${totalCalls})`);
}

async function main() {
  const cp = loadCheckpoint();
  const allRows = await prisma.$queryRaw`
    SELECT DISTINCT article_id FROM autodoc_reference_data WHERE article_id IS NOT NULL ORDER BY article_id
  `;
  const allIds = allRows.map(r => Number(r.article_id));
  logProgress(`სულ ${allIds.length} უნიკალური article, ვაგრძელებთ offset ${cp.offset}-დან`);

  let updated = 0, noOem = 0, failed = 0;

  for (let i = cp.offset; i < allIds.length; i += BATCH_SIZE) {
    const batch = allIds.slice(i, i + BATCH_SIZE);
    try {
      const data = await autodoc.getOemsByArticleIds(batch);
      totalCalls++;
      const articles = data.articles || [];

      for (const a of articles) {
        const oemCodes = (a.oemNo || []).map(o => o.oemDisplayNo).filter(Boolean);
        if (oemCodes.length === 0) { noOem++; continue; }
        try {
          await prisma.$executeRaw`
            UPDATE autodoc_reference_data
            SET oem_codes = ${oemCodes.join(',')}
            WHERE article_id = ${BigInt(a.articleId)}
          `;
          updated++;
        } catch (e) { failed++; }
      }
    } catch (e) {
      logProgress(`Batch ${i} შეცდომა: ${e.message}`);
      await sleep(SLEEP_MS * 3);
    }

    cp.offset = i + BATCH_SIZE;
    saveCheckpoint(cp);
    await sleep(SLEEP_MS);

    if ((i / BATCH_SIZE) % 20 === 0) {
      logProgress(`პროგრესი: ${i + BATCH_SIZE}/${allIds.length} | updated=${updated} noOem=${noOem} failed=${failed}`);
    }
  }
  logProgress(`დასრულდა! updated=${updated} noOem=${noOem} failed=${failed} totalCalls=${totalCalls}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
