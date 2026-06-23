'use strict';
// Ranking Engine v3

// Category-aware ranking weights
// სხვადასხვა კატეგორიაში ranking პრიორიტეტები განსხვავდება
const CATEGORY_WEIGHTS = {
  100030: { // Brake Pad — safety critical, brand + OEM ყველაზე მნიშვნელოვანია
    stockWeight: 1.0, brandWeight: 1.5, priceWeight: 0.8, oemWeight: 1.5
  },
  100031: { // Brake Lining/Shoe
    stockWeight: 1.0, brandWeight: 1.5, priceWeight: 0.8, oemWeight: 1.5
  },
  100032: { // Brake Disc — safety critical
    stockWeight: 1.0, brandWeight: 1.5, priceWeight: 0.8, oemWeight: 1.5
  },
  100259: { // Oil Filter — price ყველაზე მნიშვნელოვანია
    stockWeight: 1.0, brandWeight: 1.0, priceWeight: 1.5, oemWeight: 1.2
  },
  100260: { // Air Filter
    stockWeight: 1.0, brandWeight: 1.0, priceWeight: 1.5, oemWeight: 1.2
  },
  100263: { // Cabin Air Filter
    stockWeight: 1.0, brandWeight: 0.8, priceWeight: 1.5, oemWeight: 1.0
  },
  102203: { // Oil — brand ყველაზე მნიშვნელოვანია
    stockWeight: 1.2, brandWeight: 2.0, priceWeight: 1.0, oemWeight: 0.5
  },
  100121: { // Shock Absorber — brand + OEM
    stockWeight: 1.0, brandWeight: 1.5, priceWeight: 0.9, oemWeight: 1.5
  },
};

function getCategoryWeights(categoryId) {
  return CATEGORY_WEIGHTS[categoryId] || { stockWeight: 1.0, brandWeight: 1.0, priceWeight: 1.0, oemWeight: 1.0 };
}

 — improved per senior architect review
const PREMIUM_BRANDS = ['BOSCH','BREMBO','ATE','TRW','MANN','MAHLE','SACHS','FEBI','LUK','SKF','FAG','INA'];
const GOOD_BRANDS    = ['DELPHI','VALEO','DENSO','NGK','GATES','DAYCO','MEYLE','FEBEST','TOPRAN'];
const STOPWORDS      = new Set(['for','and','the','of','a','an','to','in','on','at','by','with','is','or']);
function normalizeCode(c){return(c||'').replace(/[\s\-\._\/]/g,'').toUpperCase();}
function scoreProduct(product, context = {}) {
  let score = 0;
  if (context.searchQuery) {
    const nq = normalizeCode(context.searchQuery);
    const codes = [...(product.oemCodes||[]),...(product.alternativeSearchKeys||[])];
    if (codes.some(c => normalizeCode(c) === nq)) return 9999;
  }
  if      (product.stock > 100) score += 30;
  else if (product.stock > 50)  score += 25;
  else if (product.stock > 20)  score += 20;
  else if (product.stock > 5)   score += 15;
  else if (product.stock > 0)   score += 10;
  const brand = (product.brand||'').toUpperCase();
  if      (PREMIUM_BRANDS.includes(brand)) score += Math.round(10 * cw.brandWeight);
  else if (GOOD_BRANDS.includes(brand))    score += Math.round(7 * cw.brandWeight);
  else if (brand && brand !== 'GENERIC')   score += 4;
  const price = parseFloat(product.price)||0;
  if (price <= 0) { score -= 10; } else {
    const r = price / (context.avgPrice || price);
    if      (r < 0.8) score += 20;
    else if (r < 1.0) score += 15;
    else if (r < 1.2) score += 10;
    else if (r < 1.5) score += 5;
  }
  const oc = product.oemCodes?.length||0;
  if (oc > 5) score += 10; else if (oc > 2) score += 7; else if (oc > 0) score += 4;
  if (product.images?.length > 0) score += 5; else if (product.imageUrl) score += 2;
  if (context.searchQuery) {
    const words = context.searchQuery.toLowerCase().split(/\s+/).filter(w=>w.length>2&&!STOPWORDS.has(w));
    const name = (product.nameKa||product.nameEn||'').toLowerCase();
    score += Math.min(words.filter(w=>name.includes(w)).length * 7, 20);
  }
  if (context.vehicleId && product.vehicleIds?.includes(String(context.vehicleId))) score += 15;
  if (product._clickRate)    score += Math.min(product._clickRate*10, 10);
  if (product._cartRate)     score += Math.min(product._cartRate*10, 8);
  if (product._purchaseRate) score += Math.min(product._purchaseRate*10, 12);
  if (!product.stock || product.stock <= 0) score = Math.round(score * 0.7);
  return score;
}
function rankProducts(products, context = {}) {
  if (!products?.length) return [];
  const prices = products.map(p=>parseFloat(p.price)).filter(p=>p>0);
  const avgPrice = prices.length ? prices.reduce((a,b)=>a+b,0)/prices.length : 0;
  return products.map(p=>({...p,_score:scoreProduct(p,{...context,avgPrice})}))
    .sort((a,b)=>b._score-a._score).map(({_score,...p})=>p);
}
function filterAvailable(products, inStockOnly = false) {
  if (inStockOnly) return products.filter(p=>p.stock>0);
  return products.sort((a,b)=>(b.stock>0?1:0)-(a.stock>0?1:0));
}
module.exports = { scoreProduct, rankProducts, filterAvailable, normalizeCode };
