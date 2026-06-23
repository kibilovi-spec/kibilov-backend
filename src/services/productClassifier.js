'use strict';
/**
 * KIBILOV PRODUCT CLASSIFIER — SINGLE SOURCE OF TRUTH
 * ყველა AI (Claude, GPT) და SQL ამ ფაილს ემორჩილება
 * Layer 1: AI proposes rules
 * Layer 2: This file is FINAL authority
 * Layer 3: Uncategorized (999999) = safety fallback
 */

const RULES = [
  // === FILTERS ===
  { match: /ჰაერის ფილტ|air.?filter/i, cat: 100260, name: 'Air Filter' },
  { match: /ზეთის ფილტ|oil.?filter/i, cat: 100259, name: 'Oil Filter' },
  { match: /სალონის.*(ფილტ|air)|cabin.?air|pollen.?filter/i, cat: 100263, name: 'Cabin Filter' },
  { match: /საწვავის ფილტ|fuel.?filter/i, cat: 100261, name: 'Fuel Filter' },

  // === OILS ===
  { match: /ATF|Dexron|Mercon|automatic.?trans/i, cat: 100240, name: 'ATF' },
  { match: /კბილანა|კბილან\.|75W|80W|85W|GL-[45]|hypoid|gear.?oil|gearbox/i, cat: 100239, name: 'Gear Oil' },
  { match: /0W-|5W-|10W-|15W-|20W-|25W-|ძრავ.*ზეთ|engine.?oil|motor.?oil|motorenoel/i, cat: 102203, name: 'Engine Oil' },
  { match: /MOTO.*2T|2T.*oil|motorcycle.*oil/i, cat: 102203, name: 'Engine Oil (Moto)' },

  // === BRAKES ===
  { match: /სამუხრუჭე ხუნდ|brake.?pad/i, cat: 100030, name: 'Brake Pad' },
  { match: /სამუხრუჭე დისკ|brake.?disc|brake.?rotor/i, cat: 100032, name: 'Brake Disc' },
  { match: /სამუხრუჭე სითხ|brake.?fluid|DOT[-. ]?[345]/i, cat: 100034, name: 'Brake Fluid' },

  // === WIPERS ===
  { match: /^WB\s|მინასაწმენდ|wiper.?blade|aerodyn/i, cat: 100133, name: 'Wiper Blade', skuMatch: /^WB/i },
  { match: /^DB-|multifunctional.?wiper/i, cat: 100133, name: 'Wiper Blade', skuMatch: /^DB-/i },

  // === CAR CARE → Uncategorized ===
  { match: /საპრიალებ|შამპუნ|პოლიროლ|ქარ.?[Xx]|ანტი.?ორთქლ|anticor|underbody|wax|polish|shampoo/i, cat: 999999, name: 'Car Care' },
  { match: /სუნამო|air.?fresh|aroma.?therapy|ლითელ.?ჯო/i, cat: 999999, name: 'Accessories' },
  { match: /epoxy|წებო|silicone|grease|lithium|RTV/i, cat: 999999, name: 'Chemicals' },
  { match: /საღებავ|spray.?paint|paint.?spray/i, cat: 999999, name: 'Paint' },
  { match: /cockpit|cocpit|interior.?spray/i, cat: 999999, name: 'Interior Care' },
  { match: /გამოხდილი წყალ|distilled.?water/i, cat: 999999, name: 'Misc' },
];

const FALLBACK = 999999;

function classifyProduct(product) {
  const text = [
    product.nameKa || '',
    product.nameEn || '',
    product.sku || '',
  ].join(' ');

  for (const rule of RULES) {
    const nameMatch = rule.match.test(text);
    const skuMatch = rule.skuMatch ? rule.skuMatch.test(product.sku || '') : false;
    if (nameMatch || skuMatch) {
      return { category: rule.cat, reason: rule.name };
    }
  }

  return { category: FALLBACK, reason: 'Unmatched' };
}

module.exports = { classifyProduct, RULES, FALLBACK };
