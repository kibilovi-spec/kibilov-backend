'use strict';
/**
 * FINA Excel Import Script
 * გამოყენება: node src/scripts/import-excel.js ./data/ზეთები_ნაშთი.xlsx
 * ან:         node src/scripts/import-excel.js ./data/ზეთები_ნაშთი.xlsx --clear
 */

require('dotenv').config();
const XLSX   = require('xlsx');
const path   = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── კატეგორიების ავტო-განსაზღვრა დასახელებიდან ─────────────────────────
const CATEGORY_RULES = [
  { keywords: ['ძრავის ზეთი','engine oil','моторное масло','2t','4t','moto rc'], slug: 'engine-oils',        nameKa: 'ძრავის ზეთები',        nameEn: 'Engine Oils',       nameRu: 'Моторные масла',      icon: '🛢️' },
  { keywords: ['კბილან','gear oil','gear','transmission','ტრანსმ','atf','dcf'], slug: 'transmission-oils',   nameKa: 'გადაცემათა ზეთები',    nameEn: 'Transmission Oils', nameRu: 'Трансмиссионные масла',icon: '⚙️' },
  { keywords: ['ჰიდრავ','hydraulic','hydraulic oil','steering oil','power'],    slug: 'hydraulic-oils',      nameKa: 'ჰიდრავლიკის ზეთები',  nameEn: 'Hydraulic Oils',    nameRu: 'Гидравлические масла', icon: '🔵' },
  { keywords: ['სამუხ','brake','hydrolube','brake fluid','dot'],                slug: 'brake-fluids',        nameKa: 'სამუხრუჭე სითხეები',  nameEn: 'Brake Fluids',      nameRu: 'Тормозные жидкости',  icon: '🛑' },
  { keywords: ['ანტიფრიზ','antifreeze','coolant','antifr'],                    slug: 'coolants',            nameKa: 'ანტიფრიზი/გამაგრილ.',  nameEn: 'Coolants',          nameRu: 'Антифриз/Охлаждающие',icon: '❄️' },
  { keywords: ['კომპრ','compressor','compressor oil'],                          slug: 'compressor-oils',     nameKa: 'კომპრესორის ზეთები',   nameEn: 'Compressor Oils',   nameRu: 'Компрессорные масла', icon: '💨' },
  { keywords: ['ინდ','industrial','სამრეწ'],                                    slug: 'industrial-oils',     nameKa: 'სამრეწველო ზეთები',    nameEn: 'Industrial Oils',   nameRu: 'Индустриальные масла',icon: '🏭' },
  { keywords: ['greases','გრის','смазк','lithium','grease'],                    slug: 'greases',             nameKa: 'საპოხი მასალები',      nameEn: 'Greases',           nameRu: 'Смазки',              icon: '🔩' },
];
const DEFAULT_CAT = { slug: 'fluids-lubricants', nameKa: 'სითხეები და ზეთები', nameEn: 'Fluids & Lubricants', nameRu: 'Жидкости и масла', icon: '🛢️' };

function detectCategory(name) {
  const lower = name.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) return rule;
  }
  return DEFAULT_CAT;
}

// ─── ბრენდის ამოღება დასახელებიდან ──────────────────────────────────────
const KNOWN_BRANDS = ['LUBRICO','CASTROL','SHELL','MOBIL','TOTAL','ELF','BP','VALVOLINE',
  'MANNOL','LIQUI MOLY','MOTUL','ENEOS','PETRONAS','GULF','HAVOLINE','LUKOIL',
  'GAZPROMNEFT','ROSNEFT','G-ENERGY','ZIC','COMMA','FUCHS','RAVENOL'];

function extractBrand(name) {
  const upper = name.toUpperCase();
  for (const brand of KNOWN_BRANDS) {
    if (upper.includes(brand)) return brand;
  }
  // Try to extract first all-caps word
  const match = name.match(/\b([A-Z]{3,})\b/);
  return match ? match[1] : 'Generic';
}

// ─── ფასი: FINA-ს ღირებულება vs გასაყიდი ────────────────────────────────
function calcSalePrice(costPrice) {
  // Markup: up to 20₾ cost → 40%, 20-50₾ → 30%, 50₾+ → 25%
  if (costPrice < 20)  return Math.ceil(costPrice * 1.40 / 0.5) * 0.5;
  if (costPrice < 50)  return Math.ceil(costPrice * 1.30 / 0.5) * 0.5;
  return Math.ceil(costPrice * 1.25 / 0.5) * 0.5;
}

// ─── მთავარი ─────────────────────────────────────────────────────────────
async function main() {
  const filePath = process.argv[2];
  const clearFirst = process.argv.includes('--clear');

  if (!filePath) {
    console.error('❌ ფაილი არ მიუთითებია!\nგამოყენება: node src/scripts/import-excel.js ./data/ფაილი.xlsx');
    process.exit(1);
  }

  console.log(`\n📂 ვკითხულობ ფაილს: ${path.basename(filePath)}`);

  // Read Excel
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Find header row (row with "კოდი")
  let headerRow = -1;
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    if (raw[i] && raw[i].some(c => c && c.toString().includes('კოდი'))) {
      headerRow = i; break;
    }
  }
  if (headerRow === -1) { console.error('❌ სათაური ვერ მოიძებნა'); process.exit(1); }

  const headers = raw[headerRow].map(h => h?.toString().trim() || '');
  const COL = {
    code:   headers.findIndex(h => h.includes('კოდი')),
    name:   headers.findIndex(h => h.includes('დასახელება')),
    unit:   headers.findIndex(h => h.includes('საზომი')),
    stock:  headers.findIndex(h => h.includes('საბოლოო ნაშთი') || h.includes('ნაშთი')),
    cost:   headers.findIndex(h => h.includes('ერთეულის თ')),
    price:  headers.findIndex(h => h.includes('ერთეულის ფასი')),
  };

  console.log(`📋 სვეტები: კოდი[${COL.code}], დასახ[${COL.name}], ნაშთი[${COL.stock}], ფასი[${COL.price}]`);

  const rows = raw.slice(headerRow + 1).filter(r =>
    r && r[COL.code] != null && r[COL.name] != null &&
    r[COL.code].toString().trim() !== '' &&
    !r[COL.code].toString().includes('სულ')
  );

  console.log(`📦 ვიტვირთავ ${rows.length} პოზიციას...\n`);

  // Optional: clear existing imported products
  if (clearFirst) {
    await prisma.product.updateMany({ where: { finaId: { not: null } }, data: { isActive: false } });
    console.log('🗑️  ძველი FINA პროდუქტები გასუფთავდა');
  }

  // Ensure categories exist
  const catCache = {};
  async function getOrCreateCat(catDef) {
    if (catCache[catDef.slug]) return catCache[catDef.slug];
    const cat = await prisma.category.upsert({
      where: { slug: catDef.slug },
      create: { slug: catDef.slug, nameKa: catDef.nameKa, nameEn: catDef.nameEn, nameRu: catDef.nameRu, icon: catDef.icon, order: 10 },
      update: { nameKa: catDef.nameKa, icon: catDef.icon },
    });
    catCache[catDef.slug] = cat.id;
    return cat.id;
  }

  let added = 0, updated = 0, skipped = 0;
  const errors = [];

  for (const row of rows) {
    try {
      const code    = row[COL.code]?.toString().trim();
      const name    = row[COL.name]?.toString().trim();
      const unit    = row[COL.unit]?.toString().trim() || 'ც';
      const stock   = Math.max(0, parseInt(row[COL.stock]) || 0);
      const costRaw = parseFloat(row[COL.cost]) || 0;
      const priceRaw= parseFloat(row[COL.price]) || 0;

      if (!code || !name) { skipped++; continue; }

      // Use sale price if given, else calc from cost
      const salePrice = priceRaw > 0 ? priceRaw : calcSalePrice(costRaw);
      const costPrice = costRaw > 0 ? costRaw : salePrice / 1.30;

      const catDef   = detectCategory(name);
      const catId    = await getOrCreateCat(catDef);
      const brand    = extractBrand(name);
      const finaId   = `FINA-${code}`;
      const sku      = code;

      const data = {
        finaId,
        sku,
        brand,
        nameKa:    name,
        nameEn:    name,   // will be translated later if needed
        nameRu:    name,
        price:     parseFloat(salePrice.toFixed(2)),
        stock,
        unit,
        categoryId: catId,
        isActive:  true,
        images:    [],
        imagePublicIds: [],
        discount:  0,
        rating:    0,
        reviewCount: 0,
      };

      const exists = await prisma.product.findFirst({
        where: { OR: [{ finaId }, { sku }] }
      });

      if (exists) {
        await prisma.product.update({
          where: { id: exists.id },
          data:  { stock: data.stock, price: data.price, nameKa: data.nameKa, isActive: true },
        });
        updated++;
      } else {
        await prisma.product.create({ data });
        added++;
      }

    } catch (e) {
      errors.push({ row: row[COL.code], error: e.message });
    }
  }

  // Log sync
  await prisma.finaSyncLog.create({
    data: { status: 'success', message: `Excel import: ${path.basename(filePath)}`, itemsAdded: added, itemsUpdated: updated, itemsSynced: added + updated },
  });

  console.log('─'.repeat(50));
  console.log(`✅ დაემატა:     ${added}`);
  console.log(`🔄 განახლდა:    ${updated}`);
  console.log(`⏭️  გამოტოვდა:   ${skipped}`);
  if (errors.length > 0) {
    console.log(`❌ შეცდომები:   ${errors.length}`);
    errors.slice(0, 5).forEach(e => console.log(`   ${e.row}: ${e.error}`));
  }
  console.log('─'.repeat(50));
  console.log(`🎉 სულ ${added + updated} პროდუქტი ბაზაშია!\n`);
}

main()
  .catch(e => { console.error('❌ შეცდომა:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
