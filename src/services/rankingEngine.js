// AUTODOC-style Ranking Engine
// score = availability + margin + popularity + stock

function scoreProduct(product, context = {}) {
  let score = 0;

  // 1. Stock availability (0-30 points)
  if (product.stock > 100) score += 30;
  else if (product.stock > 50) score += 25;
  else if (product.stock > 20) score += 20;
  else if (product.stock > 5) score += 15;
  else if (product.stock > 0) score += 10;
  else score -= 50; // out of stock penalty

  // 2. Brand score (0-25 points)
  const premiumBrands = ['BOSCH', 'BREMBO', 'ATE', 'TRW', 'MANN', 'MAHLE', 'SACHS', 'FEBI', 'LUK', 'SKF'];
  const goodBrands = ['DELPHI', 'VALEO', 'DENSO', 'NGK', 'GATES', 'DAYCO', 'MEYLE'];
  const brand = (product.brand || '').toUpperCase();
  if (premiumBrands.includes(brand)) score += 25;
  else if (goodBrands.includes(brand)) score += 15;
  else if (brand && brand !== 'GENERIC') score += 8;

  // 3. Price competitiveness (0-20 points)
  const price = parseFloat(product.price) || 0;
  if (context.avgPrice) {
    const ratio = price / context.avgPrice;
    if (ratio < 0.8) score += 20; // ძალიან იაფი
    else if (ratio < 1.0) score += 15;
    else if (ratio < 1.2) score += 10;
    else if (ratio < 1.5) score += 5;
  } else {
    if (price < 50) score += 15;
    else if (price < 150) score += 10;
    else if (price < 500) score += 5;
  }

  // 4. OEM code quality (0-15 points)
  const oemCount = product.oemCodes?.length || 0;
  if (oemCount > 5) score += 15;
  else if (oemCount > 2) score += 10;
  else if (oemCount > 0) score += 5;

  // 5. Image bonus (0-10 points)
  if (product.images?.length > 0) score += 10;
  else if (product.imageUrl) score += 5;

  // 6. Price validity (penalty)
  if (!price || price <= 0) score -= 20;

  return score;
}

function rankProducts(products, context = {}) {
  if (!products?.length) return [];

  // Average price for context
  const prices = products.map(p => parseFloat(p.price)).filter(p => p > 0);
  const avgPrice = prices.length ? prices.reduce((a,b) => a+b, 0) / prices.length : 0;

  return products
    .map(p => ({
      ...p,
      _score: scoreProduct(p, { ...context, avgPrice }),
    }))
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...p }) => p);
}

// Availability filter
function filterAvailable(products, inStockOnly = false) {
  if (inStockOnly) return products.filter(p => p.stock > 0);
  return products.sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0));
}

module.exports = { scoreProduct, rankProducts, filterAvailable };
