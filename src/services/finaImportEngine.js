const XLSX = require('xlsx');

// FINA ფორმატის helper-ები
function parseFina(raw) {
  // "წინა კალოტკა MB W210 | GDB1205, TRW1015 |"
  const s = String(raw || '').trim();
  const oemMatch = s.match(/\|([^|]+)\|/);
  const oemCodes = oemMatch
    ? oemMatch[1].split(',').map(c => c.replace(/[\s\-\.]/g, '').toUpperCase()).filter(c => c.length >= 4)
    : [];
  const nameKa = s.split('|')[0].trim();
  return { nameKa, oemCodes };
}

// SKU-პრეფიქსის მიხედვით ბრენდის ამოცნობა — ერთადერთი დაშვებული წყარო.
// არასდროს არ ვცდილობთ OEM/Cross-კოდიდან ან პროდუქტის სახელიდან ბრენდის გამოცნობას.
const SKU_BRAND_PREFIXES = [
  { prefixes: ['BB', 'BS', 'KFC', 'LF', 'OF', 'MF', 'WB'], brand: 'Wünscher' },
  { prefixes: ['SAK', 'SA', 'SB', 'SM'], brand: 'SCT' },
];
function extractBrand(sku) {
  const clean = String(sku || '').trim().toUpperCase();
  const firstToken = clean.split(/[\s\-]/)[0];
  for (const group of SKU_BRAND_PREFIXES) {
    if (group.prefixes.includes(firstToken)) return group.brand;
  }
  return 'Generic';
}

// ── Column Profiles ──────────────────────────────────────────────────────
// ყოველი მომწოდებლის/ტემპლატის ფორმატი ხელით დამოწმებული, ზუსტი mapping-ით.
// Excel-ის header-row უნდა ემთხვეოდეს ერთ-ერთ profile-ს სრულად — არავითარი
// fuzzy/ალბათური column-გამოცნობა, რომ ფასი/მარაგი არასდროს არასწორად არ
// ამოკითხულიყო.
const COLUMN_PROFILES = [
  {
    name: 'fina_template_v1',
    requiredHeaders: ['A — კოდი (SKU)', 'B — დასახელება + OEM კოდები'],
    getSku: r => r['A — კოდი (SKU)'],
    getName: r => r['B — დასახელება + OEM კოდები'],
    getStock: r => r['C — რაოდენობა'],
    getPrice: r => r['D — ფასი (₾)'],
    getBrand: r => r['E — ბრენდი'],
    getCategoryId: r => r['F — კატეგორია ID'],
  },
  {
    // ბუნებრივი "სასაქონლო ნაშთები" ტიპის ERP-რეპორტი (FINA/1C-სტილის ექსპორტი)
    name: 'stock_report_ge',
    requiredHeaders: ['კოდი', 'დასახელება', 'საბოლოო ნაშთი', 'ერთეულის ფასი'],
    getSku: r => r['კოდი'],
    getName: r => r['დასახელება'],
    getStock: r => r['საბოლოო ნაშთი'], // რეზერვის გამოკლებით — ეს არის რეალურად გასაყიდი მარაგი
    getPrice: r => r['ერთეულის ფასი'], // არა "ჯამური ფასი" (რაოდენობაზე გამრავლებული)
    getBrand: r => null,
    getCategoryId: r => null,
  },
];

function detectProfile(headerCells) {
  const cleaned = headerCells.map(h => String(h || '').trim());
  for (const profile of COLUMN_PROFILES) {
    if (profile.requiredHeaders.every(h => cleaned.includes(h))) {
      return { profile, headerRow: cleaned };
    }
  }
  return null;
}

/**
 * FINA-ფორმატის Excel ბუფერის დამუშავება — გაზიარებული admin-ისა და
 * supplier-ის import-ებისთვის. აბრუნებს ნორმალიზებულ, კატეგორიზებულ სტრიქონებს.
 */
async function processFinaExcel(buffer, { markup = 0 } = {}) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // ვეძებთ header-row-ს პირველ 15 row-ში (ზოგ ERP-ექსპორტს header-ის წინ
  // სათაურის/თარიღის row-ები აქვს)
  let headerRowIndex = -1;
  let matched = null;
  for (let i = 0; i < Math.min(15, rawRows.length); i++) {
    const detected = detectProfile(rawRows[i] || []);
    if (detected) { headerRowIndex = i; matched = detected; break; }
  }

  if (!matched) {
    return {
      normalized: [], rejected: [],
      errors: [{ error: 'ფაილის ფორმატი უცნობია — column headers არ ემთხვევა არცერთ ცნობილ Profile-ს. საჭიროა ახალი Profile-ის დამატება.' }],
      reviewQueue: [],
    };
  }

  const { profile, headerRow } = matched;
  const dataRows = rawRows.slice(headerRowIndex + 1)
    .filter(r => Array.isArray(r) && r.some(c => String(c || '').trim() !== ''))
    .map(r => {
      const obj = {};
      headerRow.forEach((h, idx) => { obj[h] = r[idx]; });
      return obj;
    });

  if (!dataRows.length) return { normalized: [], rejected: [], errors: [{ error: 'ფაილში მონაცემები ვერ მოიძებნა' }], reviewQueue: [] };

  const errors = [];

  const normalized = dataRows.map((row, i) => {
    const sku = String(profile.getSku(row) ?? '').trim();
    const rawB = String(profile.getName(row) ?? '').trim();

    if (!sku || !rawB) { errors.push({ row: headerRowIndex + i + 2, sku, error: 'SKU ან დასახელება ცარიელია' }); return null; }

    const { nameKa, oemCodes } = parseFina(rawB);
    const rawPriceVal = profile.getPrice(row);
    const rawPrice = isNaN(parseFloat(rawPriceVal)) ? null : parseFloat(rawPriceVal);
    let price = null;
    if (rawPrice !== null) {
      price = markup > 0 ? Math.round(rawPrice * (1 + markup / 100)) : parseFloat(rawPrice.toFixed(2));
    }
    const stockVal = profile.getStock(row);
    const stock = isNaN(parseInt(stockVal)) ? 0 : parseInt(stockVal);

    if (price === null) { errors.push({ row: headerRowIndex + i + 2, sku, error: 'ფასი არასწორია' }); return null; }

    const brandFromProfile = String(profile.getBrand(row) ?? '').trim();
    const brand = brandFromProfile || extractBrand(sku);

    const categoryIdRaw = profile.getCategoryId(row);
    const categoryIdFromExcel = parseInt(categoryIdRaw || '0') || null;

    return {
      sku, nameKa,
      nameEn: nameKa,
      nameRu: nameKa,
      price, stock,
      brand,
      _brandFromE: !!brandFromProfile,
      oemCodes: oemCodes.length ? oemCodes : [],
      alternativeSearchKeys: oemCodes.length ? oemCodes : undefined,
      categoryIdFromExcel,
      _rawName: nameKa,
    };
  }).filter(Boolean);

  // ── 100%-სიზუსტის Gate ──────────────────────────────────────────────────
  const HARD_MATCH_METHODS = new Set([
    'exact_alias', 'dual_signal_agree', 'regex_pk_belt', 'oem_consensus', 'oem_single', 'local_reference',
    'phrase_cabin_filter', 'phrase_air_filter', 'phrase_oil_filter', 'phrase_fuel_filter',
    'phrase_engine_oil', 'phrase_gear_oil', 'phrase_transmission_oil', 'phrase_brake_pad',
    'phrase_brake_fluid', 'phrase_wiper_blade', 'phrase_antifreeze',
    'phrase_car_polish', 'phrase_cleaning_solution', 'phrase_car_shampoo',
    'phrase_anti_fog_rain', 'phrase_little_joe', 'phrase_air_freshener', 'phrase_oil_brand',
    'phrase_spray_paint', 'phrase_brake_pad_slang', 'phrase_oil_filter_short',
    'phrase_sport_air_filter', 'phrase_washer_fluid', 'phrase_cleaning_solution_short',
    'phrase_car_x_scent', 'phrase_tire_care', 'phrase_fuel_system_cleaner', 'phrase_grease',
    'phrase_chemical_misc', 'phrase_distilled_water', 'phrase_aircon_clean',
    'phrase_stop_smoke', 'phrase_engine_flush', 'phrase_steering_stop_leak',
    'phrase_octane_booster', 'phrase_cockpit', 'phrase_starter_fluid',
    'phrase_penetrating_oil', 'phrase_oil_brand2',
  ]);
  const MIN_HARD_CONFIDENCE = 95;

  function rejectionReason(match, row) {
    if (match.method === 'dual_signal_conflict') return 'SIGNAL_CONFLICT';
    if (match.method === 'no_match') {
      return (row.oemCodes || []).length ? 'OEM_NOT_FOUND' : 'NAME_NOT_RECOGNIZED';
    }
    if ((row.oemCodes || []).length && match.method && match.method.startsWith('oem_')) {
      return 'OEM_LOW_CONFIDENCE';
    }
    return 'CATEGORY_LOW_CONFIDENCE';
  }

  const { matchCategory, learnAlias } = require('./categoryMatcher');
  const reviewQueue = [];
  const rejected = [];
  const accepted = [];

  for (const row of normalized) {
    if (row.categoryIdFromExcel) {
      row.autodocCategoryId = row.categoryIdFromExcel;
      row.categoryConfidence = 100;
      row.categoryMethod = 'manual_excel_column';
      accepted.push(row);
    } else {
      const match = await matchCategory(row._rawName, row.oemCodes || []);
      const isHard = HARD_MATCH_METHODS.has(match.method) && match.confidence >= MIN_HARD_CONFIDENCE;

      if (isHard) {
        row.autodocCategoryId = match.categoryId;
        row.categoryConfidence = match.confidence;
        row.categoryMethod = match.method;
        try { await learnAlias(row._rawName, match.categoryId, 'auto_dual_signal'); } catch (e) {}
        accepted.push(row);
      } else {
        reviewQueue.push({ sku: row.sku, name: row._rawName, categoryId: match.categoryId, confidence: match.confidence, method: match.method, conflictCategoryId: match.conflictCategoryId || null });
        rejected.push({
          sku: row.sku,
          nameKa: row._rawName,
          oemCodes: row.oemCodes || [],
          crossCodes: row.alternativeSearchKeys || [],
          matchedCategoryId: match.categoryId || null,
          confidence: match.confidence,
          method: match.method,
          reason: rejectionReason(match, row),
        });
      }
    }
    delete row.categoryIdFromExcel;
    delete row._rawName;
    delete row._brandFromE;
  }

  return { normalized: accepted, rejected, errors, reviewQueue, detectedProfile: profile.name };
}

module.exports = { processFinaExcel, parseFina, extractBrand };
