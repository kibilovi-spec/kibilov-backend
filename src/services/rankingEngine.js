'use strict';
// AUTODOC-style Ranking Engine v2
// score = availability + brand + price + oem + image + query_match + vin_match

const PREMIUM_BRANDS = ['BOSCH', 'BREMBO', 'ATE', 'TRW', 'MANN', 'MAHLE', 'SACHS', 'FEBI', 'LUK', 'SKF', 'FAG', 'INA'];
const GOOD_BRANDS    = ['DELPHI', 'VALEO', 'DENSO', 'NGK', 'GATES', 'DAYCO', 'MEYLE', 'FEBEST', 'TOPRAN'];

function scoreProduct(product, context = {}) {
  let score = 0;

  // 1. Stock availability (0-30 pts)
  if (product.stock > 100)     score += 30;
  else if (product.stock > 50) score += 25;
  else if (product.stock > 20) score += 20;
  else if (product.stock > 5)  score += 15;
  else if (product.stock > 0)  score += 10;
  else                         score -= 50;

  // 2. Brand score (0-25 pts)
  const brand = (product.brand || '').toUpperCase();
  if (PREMIUM_BRANDS.includes(brand))      score += 25;
  else if (GOOD_BRANDS.includes(brand))    score += 15;
  else if (brand && brand !== 'GENERIC')   score += 8;

  // 3. Price competitiveness (0-20 pts)
  const price = parseFloat(product.price) || 0;
  if (context.avgPrice) {
    const ratio = price / context.avgPrice;
    if (ratio < 0.8)      score += 20;
    else if (ratio < 1.0) score += 15;
    else if (ratio < 1.2) score += 10;
    else if (ratio < 1.5) score += 5;
  } else {
    if (price < 50)        score += 15;
    else if (price < 150)  score += 10;
    else if (price < 500)  score += 5;
  }
  if (!price || price <= 0) score -= 20;

  // 4. OEM code quality (0-15 pts)
  const oemCount = product.oemCodes?.length || 0;
  if (oemCount > 5)      score += 15;
  else if (oemCount > 2) score += 10;
  else if (oemCount > 0) score += 5;

  // 5. Image bonus (0-10 pts)
  if (product.images?.length > 0) score += 10;
  else if (product.imageUrl)       score += 5;

  // 6. OEM exact match bonus (+40 pts) — highest priority
  if (context.searchQuery) {
    const normQuery = context.searchQuery.replace(/[\s\-\.]/g, '').toUpperCase();
    const allCodes = [...(product.oemCodes || []), ...(product.alternativeSearchKeys || [])];
    const exactOemMatch = allCodes.some(c =>
      c.replace(/[\s\-\.]/g, '').toUpperCase() === normQuery
    );
    if (exactOemMatch) score += 40;
  }

  // 7. Query keyword match bonus (0-20 pts) — name contains search words
  if (context.searchQuery) {
    const queryWords = context.searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const nameLower = (product.nameKa || product.nameEn || '').toLowerCase();
    const matchCount = queryWords.filter(w => nameLower.includes(w)).length;
    score += Math.min(matchCount * 7, 20);
  }

  // 8. VIN vehicle match bonus (+15 pts)
  if (context.vehicleId && product.vehicleIds?.includes(String(context.vehicleId))) {
    score += 15;
  }

  return score;
}

function rankProducts(products, context = {}) {
  if (!products?.length) return [];
  const prices = products.map(p => parseFloat(p.price)).filter(p => p > 0);
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  return products
    .map(p => ({ ...p, _score: scoreProduct(p, { ...context, avgPrice }) }))
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...p }) => p);
}

function filterAvailable(products, inStockOnly = false) {
  if (inStockOnly) return products.filter(p => p.stock > 0);
  return products.sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0));
}

module.exports = { scoreProduct, rankProducts, filterAvailable };
