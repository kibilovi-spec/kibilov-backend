const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const mapping = require('./src/services/categoryMapping');

const VEHICLES = [
  ['Toyota','Camry',2018], ['Toyota','Corolla',2015], ['Toyota','RAV4',2018],
  ['Toyota','Land Cruiser Prado',2015], ['Toyota','Prius',2015], ['Toyota','Yaris',2015],
  ['Toyota','Hilux',2015], ['Hyundai','Tucson',2018], ['Hyundai','Santa Fe',2018],
  ['Hyundai','Elantra',2018], ['Hyundai','Accent',2015], ['Kia','Sportage',2018],
  ['Kia','Sorento',2018], ['BMW','3-Series',2015], ['BMW','5-Series',2015],
  ['BMW','X5',2015], ['Mercedes-Benz','C-Class',2015], ['Mercedes-Benz','E-Class',2015],
  ['Mercedes-Benz','ML-Class',2010], ['Volkswagen','Golf',2015], ['Volkswagen','Passat',2015],
  ['Volkswagen','Tiguan',2015], ['Honda','CR-V',2015], ['Honda','Civic',2015],
  ['Nissan','X-Trail',2015], ['Nissan','Qashqai',2015], ['Mitsubishi','Pajero',2010],
  ['Mitsubishi','Outlander',2015], ['Ford','Focus',2015], ['Ford','Fiesta',2015],
  ['Mazda','3',2015], ['Mazda','CX-5',2015], ['Subaru','Forester',2015],
  ['Lexus','RX',2015], ['Audi','A4',2015], ['Audi','Q5',2015],
];

const CATEGORIES = Object.keys(mapping);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchByCategoryName(make, model, year, categoryEn) {
  try {
    const url = `http://localhost:3001/api/autodoc/byCategoryName?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}&categoryEn=${encodeURIComponent(categoryEn)}`;
    const r = await fetch(url);
    return await r.json();
  } catch (e) { return { found: false, error: e.message }; }
}

async function fetchCrossRef(articleId) {
  try {
    const url = `http://localhost:3001/api/autodoc/crossref/article/${articleId}`;
    const r = await fetch(url);
    const d = await r.json();
    const arr = Array.isArray(d) ? d : (d.crossReferences || d.articles || []);
    return arr.map(x => x.articleNo || x.crossNumber || '').filter(Boolean).slice(0, 10).join(',');
  } catch (e) { return ''; }
}

(async () => {
  let totalSaved = 0, totalCalls = 0, totalCrossRefCalls = 0, totalErrors = 0;
  const startTime = Date.now();

  for (const [make, model, year] of VEHICLES) {
    for (const categoryEn of CATEGORIES) {
      totalCalls++;
      const result = await fetchByCategoryName(make, model, year, categoryEn);
      if (result.found && result.articles?.length > 0) {
        for (const a of result.articles) {
          let crossCodes = '';
          if (a.articleId) {
            crossCodes = await fetchCrossRef(a.articleId);
            totalCrossRefCalls++;
            await sleep(150);
          }
          try {
            await prisma.$executeRaw`
              INSERT INTO autodoc_reference_data (make, model, category_en, brand, article_code, description, image_url, article_id, cross_codes)
              VALUES (${make}, ${model}, ${categoryEn}, ${a.brand||null}, ${a.code||null}, ${a.desc||null}, ${a.image||null}, ${a.articleId||null}, ${crossCodes||null})
              ON CONFLICT (article_code, category_en) DO UPDATE SET cross_codes = EXCLUDED.cross_codes, article_id = EXCLUDED.article_id
            `;
            totalSaved++;
          } catch (e) { totalErrors++; }
        }
      }
      if (totalCalls % 10 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`[${elapsed}s] ${totalCalls}/${VEHICLES.length * CATEGORIES.length} category-calls, ${totalCrossRefCalls} crossref-calls, ${totalSaved} records, ${totalErrors} errors`);
      }
      await sleep(300);
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Category calls: ${totalCalls}, CrossRef calls: ${totalCrossRefCalls}, Records saved: ${totalSaved}, Errors: ${totalErrors}`);
  process.exit(0);
})();
