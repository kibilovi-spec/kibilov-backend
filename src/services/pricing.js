'use strict';

// საცალო ფასნამატი (მომწოდებლის ფასიდან)
// 0-500₾: +70%, 500₾+: +50%
function calcRetailPrice(supplierPrice) {
  const cost = parseFloat(supplierPrice);
  if (isNaN(cost) || cost <= 0) return null;
  const markup = cost <= 500 ? 1.70 : 1.50;
  return Math.round(cost * markup);
}

// B2B ფასი საცალო ფასიდან
// 0-500₾: -10%, 500₾+: -15%
function calcB2BPrice(retailPrice) {
  const price = parseFloat(retailPrice);
  if (isNaN(price) || price <= 0) return null;
  const discount = price <= 500 ? 0.90 : 0.85;
  return Math.round(price * discount);
}

function calcPrices(supplierPrice) {
  const retail = calcRetailPrice(supplierPrice);
  const b2b = retail ? calcB2BPrice(retail) : null;
  return { price: retail, b2bPrice: b2b };
}

module.exports = { calcRetailPrice, calcB2BPrice, calcPrices };
