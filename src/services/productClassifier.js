'use strict';
/**
 * KIBILOV PRODUCT CLASSIFIER — SINGLE SOURCE OF TRUTH
 * ყველა AI (Claude, GPT) და SQL ამ ფაილს ემორჩილება
 * Layer 1: AI proposes rules
 * Layer 2: This file is FINAL authority
 * Layer 3: Uncategorized (999999) = safety fallback
 */

const RULES = [
  // === SKU-BASED RULES (highest priority) ===
  { skuMatch: /^LF\s/i, cat: 100260, name: 'Air Filter (LF)' },
  { skuMatch: /^MF\s/i, cat: 100263, name: 'Cabin Filter (MF)' },
  { skuMatch: /^(KFC|SAK)\s/i, cat: 100263, name: 'Cabin Filter (KFC/SAK)' },
  { skuMatch: /^(WB|DB-)\s?/i, cat: 100133, name: 'Wiper Blade' },
  { skuMatch: /^W-7/i, cat: 999999, name: 'Chemical (W-7)' },
  { skuMatch: /^GDB/i, cat: 100030, name: 'Brake Pad (GDB)' },
  { skuMatch: /^BB\s/i, cat: 100030, name: 'Brake Pad (BB)' },
  

  // === ADDITIONAL SKU RULES ===
  { skuMatch: /^(WO-|WU)/i, cat: 102203, name: 'Engine Oil (WO/WU)' },
  { skuMatch: /^OF\s/i, cat: 100259, name: 'Oil Filter (OF)' },
  { skuMatch: /^SB\s/i, cat: 100260, name: 'Air Filter (SB)' },
  // === ADDITIONAL NAME RULES ===
  { match: /MOTUL|MOBIL|SHELL|PETRONAS|ზეთი.*0W|ზეთი.*5W|ზეთი.*10W/i, cat: 102203, name: 'Engine Oil (brand)' },
  { match: /antifreeze|ანტიფრიზ/i, cat: 100007, name: 'Coolant/Antifreeze' },
  { match: /engine.?flush|motor.?flush|engine.?treatment|stop.?smoke|oil.?treatment|octane.?boost|steering.?stop.?leak/i, cat: 105500, name: 'Additive/Chemical' },
  { match: /სუნამო|air.?freshener|ლითელ.?ჯო/i, cat: 105500, name: 'Air Freshener' },
  { match: /epoxy|RTV|silicone|upholster|foam.?clean/i, cat: 105500, name: 'Chemical' },
  { match: /spray.?paint|საღებავ/i, cat: 105500, name: 'Spray Paint' },
  { match: /გამოხდილი წყალი|distilled.?water/i, cat: 105500, name: 'Distilled Water' },
  { match: /საქარე მინის წყალი|windscreen.?wash/i, cat: 100007, name: 'Washer Fluid' },
  { match: /სპორტული ჰ|sports.?filter|sport.?air/i, cat: 100260, name: 'Sports Air Filter' },

  { skuMatch: /^W-7/i, cat: 105500, name: 'Car Chemical (W-7)' },
  { match: /ქარ.?[XХ]|საბურავ.*საპრიალ|შამპუნ|ბიტუმ|Cocpit|AirCon.?Fresh|Underbody|Upholstery|Starter.?spray/i, cat: 105500, name: 'Car Care' },
  { match: /penetrat|Lubricant.*M-40|MANNOL.*oil/i, cat: 105500, name: 'Car Chemical' },
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
    const nameMatch = rule.match ? rule.match.test(text) : false;
    const skuMatch = rule.skuMatch ? rule.skuMatch.test(product.sku || '') : false;
    if (nameMatch || skuMatch) {
      return { category: rule.cat, reason: rule.name };
    }
  }

  return { category: FALLBACK, reason: 'Unmatched' };
}

module.exports = { classifyProduct, RULES, FALLBACK };
