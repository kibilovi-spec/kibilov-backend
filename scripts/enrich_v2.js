
const { config } = require('dotenv');
config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const BASE = 'https://' + HOST;
const hdrs = () => ({ 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SKIP_WORDS = ['MERCEDES','VW','BMW','TOYOTA','HYUNDAI','KIA','BENZ','FORD','OPEL',
  'NISSAN','AUDI','SKODA','SEAT','RENAULT','PEUGEOT','CITROEN','FIAT','SPRINTER',
  'CRAFTER','PASSAT','GOLF','ASTRA','VECTRA','PRIUS','SUBARU','HONDA','MAZDA',
  'MITSUBISHI','SUZUKI','LEXUS','INFINITI','VOLVO','SAAB','LADA','DAEWOO'];

function isValidCode(c) {
  const up = c.toUpperCase().replace(/[\s\-\.]/g, '');
  if (up.length < 4 || up.length > 20) return false;
  if (SKIP_WORDS.some(s => up.includes(s))) return false;
  if (!/[A-Z]/i.test(up)) return false;
  if (!/\d/.test(up)) return false;
  if (/^\d{4}$/.test(up)) return false;
  if (/^\d{4}-\d{4}$/.test(c.trim())) return false;
  if (/[\u10D0-\u10FF]/.test(c)) return false;
  if (/^[A-Z]+$/.test(up)) return false;
  if (up.length > 6 && /^\d+$/.test(up)) return false;
  return true;
}

function extractCodes(nameKa, oemCodes) {
  const result = new Set();

  // nameKa-დან — მრავალ spaces-ით გამოყოფილი ტოკენები (1 და 2 სიტყვიანი)
  const parts = nameKa.split(/\s{2,}|\t/).map(t => t.trim()).filter(t => t.length > 0);
  for (const token of parts) {
    if (isValidCode(token)) result.add(token);
    // 2-სიტყვიანი კოდი: "SP 431", "GDB 1613", "SH 4044 P"
    const sub = token.match(/[A-Z]{1,4}\s*\d[\d\s]{1,10}[A-Z0-9]?/gi) || [];
    for (const s of sub) {
      const t = s.trim();
      if (isValidCode(t)) result.add(t);
    }
  }

  // oemCodes-დან — spaces-იანი ვარიანტი
  for (const raw of oemCodes) {
    const trimmed = raw.trim();
    if (isValidCode(trimmed)) result.add(trimmed);
    // spaces-გარეშეც ვცადოთ
    const nosp = trimmed.replace(/\s+/g, ' ');
    if (isValidCode(nosp)) result.add(nosp);
  }

  return [...result].slice(0, 5);
}

async function artlookup(code) {
  const url = BASE + '/api/artlookup/search-articles-by-article-no?langId=4&articleNo='
    + encodeURIComponent(code) + '&articleType=ArticleNumber';
  const r = await fetch(url, { headers: hdrs() });
  const d = await r.json();
  return (d?.articles || [])[0] || null;
}

async function getCrossRefs(supplierId, articleNo) {
  const r = await fetch(BASE + '/api/artlookup/search-for-cross-references-through-oem-numbers', {
    method: 'POST',
    headers: Object.assign({}, hdrs(), {'Content-Type': 'application/x-www-form-urlencoded'}),
    body: 'supplierId=' + supplierId + '&articleNo=' + encodeURIComponent(articleNo)
  });
  const d = await r.json();
  return (d?.articles || [])
    .map(a => (a.crossNumber || '').replace(/[\s\-\.]/g,'').toUpperCase())
    .filter(c => c.length >= 5);
}

async function main() {
  const products = await prisma.product.findMany({
    where: { oemCodes: { isEmpty: false } },
    select: { id: true, nameKa: true, oemCodes: true, alternativeSearchKeys: true },
  });

  console.log('სულ: ' + products.length);
  let enriched = 0, failed = 0, skipped = 0;

  for (const p of products) {
    const codes = extractCodes(p.nameKa || '', p.oemCodes);
    if (!codes.length) { skipped++; continue; }

    try {
      const allKeys = new Set(p.alternativeSearchKeys || []);
      let found = false;

      for (const code of codes) {
        await sleep(300);
        const art = await artlookup(code);
        if (!art) continue;
        await sleep(300);
        const refs = await getCrossRefs(art.supplierId, code);
        if (!refs.length) continue;
        refs.forEach(c => allKeys.add(c));
        found = true;
        break;
      }

      if (found) {
        await prisma.product.update({
          where: { id: p.id },
          data: { alternativeSearchKeys: [...allKeys].slice(0, 100) }
        });
        enriched++;
        if (enriched % 20 === 0) {
          console.log('enriched: ' + enriched + ' | failed: ' + failed + ' | skipped: ' + skipped);
        }
      } else {
        failed++;
      }
    } catch(e) {
      failed++;
      await sleep(1000);
    }
  }

  console.log('Done! enriched: ' + enriched + ' | failed: ' + failed + ' | skipped: ' + skipped);
  await prisma.$disconnect();
}

main().catch(console.error);
