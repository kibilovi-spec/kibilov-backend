'use strict';
// Local brands - Wunscher/SCT catalog, not in Autodoc
const LOCAL_BRAND_PREFIXES = ['BB','SAK','KFC','SB','GB','LF','MF','BS','OF','WO'];

function isLocalBrand(sku) {
  if (!sku) return false;
  const upper = sku.toUpperCase().replace(/\s+/g, '');
  return LOCAL_BRAND_PREFIXES.some(p => upper.startsWith(p));
}

module.exports = { isLocalBrand, LOCAL_BRAND_PREFIXES };
