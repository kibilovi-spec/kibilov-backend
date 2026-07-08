const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let categoryCache = null;
let aliasCache = null;
let lastLoaded = 0;
const CACHE_TTL = 60 * 60 * 1000;

async function loadCache() {
  const now = Date.now();
  if (categoryCache && aliasCache && (now - lastLoaded) < CACHE_TTL) return;

  const [categories, aliases] = await Promise.all([
    prisma.$queryRaw`SELECT autodoc_id, name_ka, name_slang, name_en, canonical_category_id FROM autodoc_categories`,
    prisma.$queryRaw`SELECT category_id, alias, confidence FROM category_aliases`
  ]);

  categoryCache = categories;
  aliasCache = aliases;
  lastLoaded = now;
  console.log(`[CategoryMatcher] Loaded ${categories.length} categories, ${aliases.length} aliases`);
}

const RU_TO_KA = {
  'а':'ა','б':'ბ','в':'ვ','г':'გ','д':'დ','е':'ე','ё':'ე',
  'ж':'ჟ','з':'ზ','и':'ი','й':'ი','к':'კ','л':'ლ','м':'მ',
  'н':'ნ','о':'ო','п':'პ','р':'რ','с':'ს','т':'ტ','у':'უ',
  'ф':'ფ','х':'ხ','ц':'ც','ч':'ჩ','ш':'შ','щ':'შ','ъ':'',
  'ы':'ი','ь':'','э':'ე','ю':'იუ','я':'ია'
};

function levenshtein(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = a[i-1] === b[j-1]
        ? m[i-1][j-1]
        : 1 + Math.min(m[i-1][j], m[i][j-1], m[i-1][j-1]);
    }
  }
  return m[a.length][b.length];
}

function normalize(text) {
  if (!text) return '';
  let t = text.toLowerCase()
    .replace(/[|,;\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  t = t.replace(/[а-яёъь]/g, ch => RU_TO_KA[ch] || ch);
  return t;
}

function tokenize(text) {
  return normalize(text).split(' ').filter(t => t.length >= 2);
}

function resolveCanonical(categoryId) {
  let current = categoryId;
  const seen = new Set();
  for (let hops = 0; hops < 10; hops++) {
    if (seen.has(current)) break; // ციკლისგან დაცვა
    seen.add(current);
    const cat = categoryCache.find(c => c.autodoc_id === current);
    if (!cat?.canonical_category_id) break;
    current = Number(cat.canonical_category_id);
  }
  return current;
}

// ── Signal B: სუფთა ტექსტური/alias მაჩინგი (OEM-ის გარეშე) ──────────────────
function matchByText(productName) {
  const name = normalize(productName);
  const tokens = tokenize(productName);
  let best = { categoryId: null, confidence: 0, method: null };

  // 1. ზუსტი alias (confidence 100)
  for (const a of aliasCache) {
    if (normalize(a.alias) === name) {
      return { categoryId: resolveCanonical(Number(a.category_id)), confidence: 100, method: 'exact_alias' };
    }
  }

  // 2. შემცველი alias (confidence up to 95)
  for (const a of aliasCache) {
    const aliasNorm = normalize(a.alias);
    if (name.includes(aliasNorm) && aliasNorm.length >= 3) {
      const conf = Math.min(95, Math.floor(a.confidence * 0.95));
      if (conf > best.confidence) best = { categoryId: Number(a.category_id), confidence: conf, method: 'contains_alias' };
    }
  }
  if (best.confidence >= 90) return { ...best, categoryId: resolveCanonical(best.categoryId) };

  // 3. name_slang (confidence 92)
  for (const c of categoryCache) {
    if (!c.name_slang) continue;
    const slangNorm = normalize(c.name_slang);
    if (name.includes(slangNorm) && slangNorm.length >= 3 && 92 > best.confidence) {
      best = { categoryId: Number(c.autodoc_id), confidence: 92, method: 'slang_match' };
    }
  }
  if (best.confidence >= 90) return { ...best, categoryId: resolveCanonical(best.categoryId) };

  // 4. name_ka (confidence 88)
  for (const c of categoryCache) {
    if (!c.name_ka) continue;
    const kaNorm = normalize(c.name_ka);
    if (name.includes(kaNorm) && kaNorm.length >= 4 && 88 > best.confidence) {
      best = { categoryId: Number(c.autodoc_id), confidence: 88, method: 'name_ka_match' };
    }
  }

  // 5. Token scoring (confidence 70-89)
  const scores = {};
  for (const c of categoryCache) {
    const catTokens = tokenize(`${c.name_ka} ${c.name_slang} ${c.name_en}`);
    let hits = 0;
    for (const t of tokens) {
      if (catTokens.some(ct => ct.includes(t) || t.includes(ct))) hits++;
    }
    if (hits > 0 && tokens.length > 0) scores[c.autodoc_id] = Math.floor((hits / tokens.length) * 85);
  }
  const topToken = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (topToken && topToken[1] > best.confidence) {
    best = { categoryId: Number(topToken[0]), confidence: topToken[1], method: 'token_score' };
  }

  // 5.5 Levenshtein fuzzy
  for (const a of aliasCache) {
    const aliasNorm = normalize(a.alias);
    if (aliasNorm.length < 4) continue;
    const dist = levenshtein(name, aliasNorm);
    const maxLen = Math.max(name.length, aliasNorm.length);
    const similarity = 1 - (dist / maxLen);
    if (similarity >= 0.8) {
      const conf = Math.floor(similarity * 85);
      if (conf > best.confidence) best = { categoryId: Number(a.category_id), confidence: conf, method: 'levenshtein' };
    }
  }

  if (!best.categoryId || best.confidence < 50) return { categoryId: null, confidence: 0, method: 'no_match' };
  return { categoryId: resolveCanonical(best.categoryId), confidence: best.confidence, method: best.method };
}

// ── Signal A: OEM/cross-code კონსენსუსი Autodoc-იდან (კატეგორია + ბრენდი) ───
async function matchByOem(codes) {
  const autodoc = require('./autodoc');
  const tally = {};
  let totalArticles = 0;
  const MAX_CODES = 5;
  const MAX_ARTICLES_PER_CODE = 5;

  for (const rawCode of codes.slice(0, MAX_CODES)) {
    const code = String(rawCode).trim();
    if (!code) continue;
    try {
      const searchResult = await autodoc.searchByArticleNo(code);
      const articles = (searchResult?.articles || []).slice(0, MAX_ARTICLES_PER_CODE);
      for (const art of articles) {
        try {
          const catResult = await autodoc.getArticleCategory(art.articleId);
          if (catResult?.categoryId) {
            let canonicalId = resolveCanonical(catResult.categoryId);
            let localCat = categoryCache.find(c => c.autodoc_id === canonicalId || c.autodoc_id === catResult.categoryId);
            if (!localCat) {
              try {
                const slug = String(catResult.categoryName || ('cat-' + catResult.categoryId))
                  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                await prisma.$executeRaw`
                  INSERT INTO autodoc_categories (autodoc_id, name_en, slug, is_active, sort_order, created_at, level, parent_id)
                  VALUES (${catResult.categoryId}, ${catResult.categoryName || 'Unknown'}, ${slug}, true, 999, NOW(), 2, 900012)
                  ON CONFLICT (autodoc_id) DO NOTHING
                `;
                localCat = { autodoc_id: catResult.categoryId, name_en: catResult.categoryName, name_ka: null, name_slang: null, canonical_category_id: null };
                categoryCache.push(localCat);
                canonicalId = catResult.categoryId;
                console.log(`[CategoryMatcher] Auto-added category: ${catResult.categoryId} (${catResult.categoryName})`);
              } catch (insertErr) { localCat = null; }
            }
            if (localCat) {
              totalArticles++;
              if (!tally[canonicalId]) tally[canonicalId] = { count: 0, brand: art.supplierName || null };
              tally[canonicalId].count++;
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    // ადრეული გამოსვლა — ძლიერი კონსენსუსი უკვე მიღწეულია
    if (totalArticles >= 2) {
      const sorted = Object.entries(tally).sort((a, b) => b[1].count - a[1].count);
      if (sorted[0][1].count / totalArticles >= 0.9) break;
    }
  }

  if (totalArticles === 0) return null;

  const sorted = Object.entries(tally).sort((a, b) => b[1].count - a[1].count);
  const [topCategoryId, topInfo] = sorted[0];
  const agreementRatio = topInfo.count / totalArticles;

  let confidence, method;
  if (totalArticles === 1) { confidence = 95; method = 'oem_single'; }
  else if (agreementRatio >= 0.9) { confidence = 98; method = 'oem_consensus'; }
  else if (agreementRatio >= 0.6) { confidence = 85; method = 'oem_majority'; }
  else { confidence = 60; method = 'oem_weak_majority'; }

  return { categoryId: Number(topCategoryId), confidence, method, brand: topInfo.brand, agreementRatio, totalArticles };
}

// ── ლოკალურად მოპოვებული Autodoc reference-მონაცემის შემოწმება (სწრაფი, quota-ს არ ხარჯავს) ──
const categoryMapping = require('./categoryMapping');
async function matchByLocalReference(codes) {
  if (!codes || !codes.length) return null;
  try {
    for (const code of codes) {
      const clean = String(code).replace(/\s/g, '').toUpperCase();
      const rows = await prisma.$queryRaw`
        SELECT category_en, brand FROM autodoc_reference_data
        WHERE REPLACE(UPPER(article_code), ' ', '') = ${clean}
        OR UPPER(cross_codes) LIKE ${'%' + clean + '%'}
        LIMIT 1
      `;
      if (rows.length > 0) {
        const catEn = rows[0].category_en;
        const ids = categoryMapping[catEn];
        if (ids && ids.length > 0) {
          return { categoryId: resolveCanonical(ids[0]), confidence: 95, method: 'local_reference', brand: rows[0].brand };
        }
      }
    }
  } catch (e) {}
  return null;
}
// ── მთავარი: Dual-Signal Verification ────────────────────────────────────────
async function matchCategory(productName, oemCodes = []) {
  await loadCache();

  // PK-belt regex — ცალსახა, dual-signal-ის საჭიროება არაა
  if (/\d+PK\d+/i.test(productName)) {
    return { categoryId: 100431, confidence: 98, method: 'regex_pk_belt' };
  }
  // ქართული ფრაზა-პატერნები — ცალსახა საკვანძო სიტყვები, dual-signal-ის გვერდის ავლით.
  // ეს პატერნები უფრო საიმედოა, ვიდრე OEM-cross-reference-ზე დაფუძნებული dual-signal შემოწმება,
  // რადგან მომწოდებლის სახელწოდება ყოველთვის ცალსახად აღწერს პროდუქტის ტიპს.
  const PHRASE_PATTERNS = [
    { re: /სალონის\s*ფილტრ/i, cat: 100346, name: 'phrase_cabin_filter' },
    { re: /ჰაერის\s*ფილტრ/i, cat: 100260, name: 'phrase_air_filter' },
    { re: /ზეთის\s*ფილტრ/i, cat: 100259, name: 'phrase_oil_filter' },
    { re: /საწვავის\s*ფილტრ/i, cat: 100261, name: 'phrase_fuel_filter' },
    { re: /(ძრავის\s*ზეთი|ძრ\.?\s*ზეთი)/i, cat: 101994, name: 'phrase_engine_oil' },
    { re: /კბილან\.?\s*ზეთი/i, cat: 100239, name: 'phrase_gear_oil' },
    { re: /ტრანსმ\.?\s*ზეთი/i, cat: 100240, name: 'phrase_transmission_oil' },
    { re: /სამუხრუჭე\s*ხუნდი/i, cat: 100030, name: 'phrase_brake_pad' },
    { re: /სამუხ\.?\s*სითხე|სამუხრუჭე\s*სითხე/i, cat: 102208, name: 'phrase_brake_fluid' },
    { re: /მინა\s*საწმენდ|მინის\s*მწმენდ|საქარე\s*მინის\s*საწმენდ/i, cat: 100133, name: 'phrase_wiper_blade' },
    { re: /ანტიფრიზ/i, cat: 102205, name: 'phrase_antifreeze' },
    { re: /საპრიალებელი|საბურავის\s*პოლიროლ/i, cat: 105500, name: 'phrase_car_polish' },
    { re: /საწმენდი\s*საშუალება/i, cat: 105500, name: 'phrase_cleaning_solution' },
    { re: /ავტო\s*შამპუნ|\bშამპუნ/i, cat: 105500, name: 'phrase_car_shampoo' },
    { re: /ანტი\s*(ორთქლი|წვიმა)/i, cat: 105500, name: 'phrase_anti_fog_rain' },
    { re: /ლითელ\s*ჯო/i, cat: 105500, name: 'phrase_little_joe' },
    { re: /სუნამო/i, cat: 105500, name: 'phrase_air_freshener' },
    { re: /(MAGNATEC|Top\s*Tec|Molygen|Special\s*Tec|Megol)/i, cat: 101994, name: 'phrase_oil_brand' },
    { re: /სპრეი\s*საღებავ|სპრეიბალონ/i, cat: 105500, name: 'phrase_spray_paint' },
    { re: /სამუხრუჭე\s*ხუნდი|კალოტკ|კალოდკ|კოლოდკ/i, cat: 100030, name: 'phrase_brake_pad_slang' },
    { re: /ზეთის\s*ფილტ/i, cat: 100259, name: 'phrase_oil_filter_short' },
    { re: /(სპორტული\s*ჰ|sports?\.?\s*(air)?\s*filter)/i, cat: 100260, name: 'phrase_sport_air_filter' },
    { re: /საქარე\s*მინის\s*წყალი|windscreen\s*wash/i, cat: 105500, name: 'phrase_washer_fluid' },
    { re: /საწმენდი\s*საშ/i, cat: 105500, name: 'phrase_cleaning_solution_short' },
    { re: /ქარ\s*[XХх]\s*[-–]/i, cat: 105500, name: 'phrase_car_x_scent' },
    { re: /საბურავის\s*(ფერის\s*აღმდგენ|დაშვების)/i, cat: 105500, name: 'phrase_tire_care' },
    { re: /(fuel\s*injection\s*clean|diesel\s*jet\s*clean|ინჟექტორის.*საწმენდი|კარბურატორის.*საწმენდი)/i, cat: 105500, name: 'phrase_fuel_system_cleaner' },
    { re: /lithium\s*grease|ლითიუმის?\s*გრეასი|SprayGrease/i, cat: 105500, name: 'phrase_grease' },
    { re: /(RTV|silicone|epoxy|upholster|foam\s*clean|underbody|anticor)/i, cat: 105500, name: 'phrase_chemical_misc' },
    { re: /გამოხდილი\s*წყალი|distilled\s*water/i, cat: 105500, name: 'phrase_distilled_water' },
    { re: /AirCon.*Fresh|Fresh.*Clean|კონდიციონერის\s*გამწმენდი/i, cat: 105500, name: 'phrase_aircon_clean' },
    { re: /MOTOR\s*DOCTOR|STOP\s*SMOKE|ბოლის\s*შემაჩერებელი/i, cat: 105500, name: 'phrase_stop_smoke' },
    { re: /(engine|motor)\s*flush|ძრავის\s*გამოსარეცხი/i, cat: 105500, name: 'phrase_engine_flush' },
    { re: /STOP\s*LEAK|POWER\s*STEERING.*(LEAK|FLUID)|გაჟონვის\s*შემაჩერებელი/i, cat: 105500, name: 'phrase_steering_stop_leak' },
    { re: /Octane\s*Booster|ოქტანის\s*გამაძლიერებელი/i, cat: 105500, name: 'phrase_octane_booster' },
    { re: /Cocpit|Cockpit/i, cat: 105500, name: 'phrase_cockpit' },
    { re: /Motor\s*Power\s*Starter|დაქოქვისას\s*გამოსაყენებელი/i, cat: 105500, name: 'phrase_starter_fluid' },
    { re: /Penetrating\s*oil|MANNOL.*oil|M-40/i, cat: 105500, name: 'phrase_penetrating_oil' },
    { re: /WUNSCHER|WOLVER/i, cat: 101994, name: 'phrase_oil_brand2' },
  ];
  for (const p of PHRASE_PATTERNS) {
    if (p.re.test(productName)) {
      return { categoryId: p.cat, confidence: 96, method: p.name };
    }
  }

  const signalB = matchByText(productName);

  let codesToTry = Array.isArray(oemCodes) ? oemCodes.filter(Boolean) : [];
  if (!codesToTry.length && /^[A-Za-z0-9.\/ -]+$/.test(productName) && productName.trim().length >= 3) {
    codesToTry = [productName.trim()];
  }

  let signalA = null;
  if (codesToTry.length) {
    signalA = await matchByLocalReference(codesToTry);
    if (!signalA) {
      try { signalA = await matchByOem(codesToTry); } catch (e) { signalA = null; }
    }
  }

  const hasA = signalA && signalA.categoryId;
  const hasB = signalB && signalB.categoryId;

  if (hasA && hasB) {
    if (signalA.categoryId === signalB.categoryId) {
      return { categoryId: signalA.categoryId, confidence: 99, method: 'dual_signal_agree', brand: signalA.brand };
    }
    return {
      categoryId: signalA.categoryId, confidence: 60, method: 'dual_signal_conflict',
      conflictCategoryId: signalB.categoryId, brand: signalA.brand,
    };
  }
  if (hasA) return { categoryId: signalA.categoryId, confidence: signalA.confidence, method: signalA.method, brand: signalA.brand };
  if (hasB) return signalB;
  return { categoryId: null, confidence: 0, method: 'no_match' };
}

async function learnAlias(productName, categoryId, confirmedBy = 'user') {
  const name = normalize(productName);
  if (!name || name.length < 3) return;

  await prisma.$executeRaw`
    INSERT INTO category_aliases (category_id, alias, lang, confidence, source)
    VALUES (${categoryId}, ${name}, 'ka', 98, ${confirmedBy})
    ON CONFLICT DO NOTHING
  `;

  aliasCache = null;
  console.log(`[CategoryMatcher] Learned: "${name}" → ${categoryId}`);
}

async function invalidateCache() {
  categoryCache = null;
  aliasCache = null;
}

module.exports = { matchCategory, learnAlias, invalidateCache };
