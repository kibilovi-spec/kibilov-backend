const axios = require('axios');
const BASE = 'https://autodoc-parts-catalog.p.rapidapi.com';
const HEADERS = {
  'x-rapidapi-key': process.env.RAPIDAPI_KEY,
  'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com',
  'Content-Type': 'application/json',
};
const api = axios.create({ baseURL: BASE, headers: HEADERS, timeout: 15000 });

async function call(fn) {
  try { return await fn(); }
  catch (err) {
    if (err?.response?.status === 429) {
      await new Promise(r => setTimeout(r, 1500));
      return await fn();
    }
    throw err;
  }
}

// VIN
const vinCheck    = vin => call(() => api.get(`/api/vin/tecdoc-vin-check/${vin}`).then(r => r.data));
const vinDecodeV1 = vin => call(() => api.get(`/api/vin/decoder-v1/${vin}`).then(r => r.data));
const vinDecodeV2 = vin => call(() => api.get(`/api/vin/decoder-v2/${vin}`).then(r => r.data));
const vinDecodeV3 = vin => call(() => api.get(`/api/vin/decoder-v3/${vin}`).then(r => r.data));
const vinDecodeV5 = vin => call(() => api.get(`/api/vin/decoder-v5/${vin}`).then(r => r.data));

// Manufacturers
const getManufacturersByType = (typeId=1) => call(() => api.get(`/api/manufacturers/list/type-id/${typeId}`).then(r => r.data));
const getManufacturerById    = manuId => call(() => api.get(`/api/manufacturers/find-by-id/${manuId}`).then(r => r.data));
const getManufacturerTypes   = manuId => call(() => api.get(`/api/manufacturers/get-manufacturer-types/${manuId}`).then(r => r.data));

// Models
const getModelsByManufacturer = (manuId, typeId=1, langId=4, countryId=63) => call(() => api.get(`/api/models/list/type-id/${typeId}/manufacturer-id/${manuId}/lang-id/${langId}/country-filter-id/${countryId}`).then(r => r.data));
const getModelDetails         = (modelId, typeId=1, langId=4, countryId=63) => call(() => api.get(`/api/models/type-id/${typeId}/model-id/${modelId}/lang-id/${langId}/country-filter-id/${countryId}`).then(r => r.data));
const getModelBasic           = (modelId, typeId=1) => call(() => api.get(`/api/models/type-id/${typeId}/model-id/${modelId}`).then(r => r.data));
const getModelByVehicle       = (vehicleId, typeId=1, langId=4, countryId=63) => call(() => api.get(`/api/models/type-id/${typeId}/vehicles/${vehicleId}/lang-id/${langId}/country-filter-id/${countryId}`).then(r => r.data));

// Vehicles
const getVehicleTypes       = () => call(() => api.get(`/api/types/list-vehicles-type`).then(r => r.data));
const getVehicleDetails     = (vehicleId, typeId=1, langId=4, countryId=63) => call(() => api.get(`/api/types/type-id/${typeId}/vehicle-type-details/${vehicleId}/lang-id/${langId}/country-filter-id/${countryId}`).then(r => r.data));
const getVehicleListByModel = (modelId, typeId=1, langId=4, countryId=63) => call(() => api.get(`/api/types/type-id/${typeId}/list-vehicles-id/${modelId}/lang-id/${langId}/country-filter-id/${countryId}`).then(r => r.data));
const getVehicleListTypes   = (modelId, typeId=1, langId=4, countryId=63) => call(() => api.get(`/api/types/type-id/${typeId}/list-vehicles-types/${modelId}/lang-id/${langId}/country-filter-id/${countryId}`).then(r => r.data));
const getEngineDetails      = (engineId, langId=4) => call(() => api.get(`/api/engines/engine-details/engine-id/${engineId}/lang-id/${langId}`).then(r => r.data));
const getTypeIdByVehicleId  = (vehicleId, manufacturerId) => call(() => api.get(`/api/types/get-typeid-by-vehicleid?vehicleId=${vehicleId}&manufacturerId=${manufacturerId}`).then(r => r.data));
const getVehicleSpaCriteria = (vehicleId, typeId=1, langId=4, countryId=63) => call(() => api.get(`/api/types/selecting-all-criteria-for-spare-parts-of-a-passenger-car-using-an-olap-query/type-id/${typeId}/lang-id/${langId}/country-filter-id/${countryId}/vehicle-id/${vehicleId}`).then(r => r.data));

// Categories
const getCategoryTree     = (typeId=1, langId=4) => call(() => api.get(`/api/category/type-id/${typeId}/list-category-tree-structure/lang-id/${langId}`).then(r => r.data));
const getCategoryGroupsV1 = (vehicleId, typeId=1, langId=4) => call(() => api.get(`/api/category/type-id/${typeId}/products-groups-variant-1/${vehicleId}/lang-id/${langId}`).then(r => r.data));
const getCategoryGroupsV2 = (vehicleId, typeId=1, langId=4) => call(() => api.get(`/api/category/type-id/${typeId}/products-groups-variant-2/${vehicleId}/lang-id/${langId}`).then(r => r.data));
const getCategoryGroupsV3 = (vehicleId, typeId=1, langId=4) => call(() => api.get(`/api/category/type-id/${typeId}/products-groups-variant-3/${vehicleId}/lang-id/${langId}`).then(r => r.data));
const getCategoryGroupsV4 = (vehicleId, typeId=1, langId=4) => call(() => api.get(`/api/category/type-id/${typeId}/products-groups-variant-4/${vehicleId}/lang-id/${langId}`).then(r => r.data));
const searchCategories    = (text, typeId=1, langId=4) => call(() => api.get(`/api/category/search-for-the-commodity-group-tree-by-description/type-id/${typeId}/lang-id/${langId}/search-text/${encodeURIComponent(text)}`).then(r => r.data));
const getProductNames     = (langId=4) => call(() => api.get(`/api/category/list-products-names/lang-id/${langId}`).then(r => r.data));

// Articles
const getArticlesByVehicle  = (vehicleId, catId, typeId=1, langId=4) => call(() => api.get(`/api/articles/list/type-id/${typeId}/vehicle-id/${vehicleId}/category-id/${catId}/lang-id/${langId}`).then(r => r.data));
const getArticleDetails     = (articleId, langId=4) => call(() => api.get(`/api/articles/details/article-id/${articleId}/lang-id/${langId}`).then(r => r.data));
const getArticleMedia       = (articleId, langId=4) => call(() => api.get(`/api/articles/article-all-media-info?langId=${langId}&articleId=${articleId}`).then(r => r.data));
const getArticleCategory    = (articleId, langId=4) => call(() => api.get(`/api/articles/get-article-category/article-id/${articleId}/lang-id/${langId}`).then(r => r.data));
const getArticleCategories  = (articleId, langId=4) => call(() => api.get(`/api/articles/get-article-categories/article-id/${articleId}/lang-id/${langId}`).then(r => r.data));
const getArticleCriteria    = (articleId, langId=4, countryId=63) => call(() => api.get(`/api/articles/selection-of-all-specifications-criterias-for-the-article/article-id/${articleId}/lang-id/${langId}/country-filter-id/${countryId}`).then(r => r.data));
const getArticleAccessories = (articleId, langId=4, countryId=63) => call(() => api.get(`/api/articles/selecting-list-of-accessories-list-for-the-article/article-id/${articleId}/lang-id/${langId}/country-filter-id/${countryId}`).then(r => r.data));
const getArticleDiagram     = articleId => call(() => api.get(`/api/articles/selecting-item-coordinators-on-the-parts-diagram-image-for-the-parts-list/article-id/${articleId}`).then(r => r.data));
const getArticlePartsList   = (articleId, langId=4, countryId=63) => call(() => api.get(`/api/articles/list-of-parts-for-article/article-id/${articleId}/lang-id/${langId}/country-filter-id/${countryId}`).then(r => r.data));
const getCompatibleCars     = (articleNo, supplierId, typeId=1, langId=4, countryId=63) => call(() => api.get(`/api/articles/get-compatible-cars-by-article-number/type-id/${typeId}?langId=${langId}&supplierId=${supplierId}&articleNo=${encodeURIComponent(articleNo)}&countryFilterId=${countryId}`).then(r => r.data));

// OEM
const getOemsByArticleIds = articleIds => call(() => api.post('/api/articles/get-oems-by-list-of-articles-ids', { articleIds }).then(r => r.data));
const getOemEqualNumbers  = (articleOemNo, langId=4) => call(() => api.get(`/api/articles-oem/search-all-equal-oem-no/lang-id/${langId}/article-oem-no/${encodeURIComponent(articleOemNo)}`).then(r => r.data));
const searchOemByNo       = articleOemNo => call(() => api.get(`/api/articles-oem/search-by-article-oem-no?langId=4&articleOemNo=${encodeURIComponent(articleOemNo)}`).then(r => r.data));

// Cross References
const getCrossRefs          = (articleId, langId=4) => call(() => api.get(`/api/artlookup/select-article-cross-references/article-id/${articleId}/lang-id/${langId}`).then(r => r.data));
const getCrossRefsPartial   = (articleId, langId=4) => call(() => api.get(`/api/artlookup/select-article-cross-references-partial-match?articleId=${articleId}&langId=${langId}`).then(r => r.data));
const getCrossRefsByOem     = (articleNo, supplierId) => call(() => api.get(`/api/artlookup/search-for-cross-references-through-oem-numbers/article-no/${encodeURIComponent(articleNo)}/supplierId/${supplierId}`).then(r => r.data));
const getAftermarketRefs    = articleOemNo => call(() => api.post('/api/artlookup/search-for-the-oem-cross-references-through-aftermarket-parts-references', new URLSearchParams({ articleOemNo }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).then(r => r.data));
const getAnalogByOem        = articleOemNo => call(() => api.get(`/api/artlookup/search-for-analogue-of-spare-parts-by-oem-number/article-oem-no/${encodeURIComponent(articleOemNo)}`).then(r => r.data));
const searchByArticleNo     = (articleNo, articleType='ArticleNumber', langId=4) => call(() => api.get(`/api/artlookup/search-articles-by-article-no?langId=${langId}&articleNo=${encodeURIComponent(articleNo)}&articleType=${articleType}`).then(r => r.data));

// Suppliers / Languages / Countries
const getSuppliersList = () => call(() => api.get('/api/suppliers/list').then(r => r.data));
const getLanguagesList = () => call(() => api.get('/api/languages/list').then(r => r.data));
const getCountriesList = () => call(() => api.get('/api/countries/list').then(r => r.data));

module.exports = {
  vinCheck, vinDecodeV1, vinDecodeV2, vinDecodeV3, vinDecodeV5,
  getManufacturersByType, getManufacturerById, getManufacturerTypes,
  getModelsByManufacturer, getModelDetails, getModelBasic, getModelByVehicle,
  getVehicleTypes, getVehicleDetails, getVehicleListByModel, getVehicleListTypes,
  getEngineDetails, getTypeIdByVehicleId, getVehicleSpaCriteria,
  getCategoryTree, getCategoryGroupsV1, getCategoryGroupsV2, getCategoryGroupsV3, getCategoryGroupsV4,
  searchCategories, getProductNames,
  getArticlesByVehicle, getArticleDetails, getArticleMedia,
  getArticleCategory, getArticleCategories, getArticleCriteria,
  getArticleAccessories, getArticleDiagram, getArticlePartsList, getCompatibleCars,
  getOemsByArticleIds, getOemEqualNumbers, searchOemByNo,
  getCrossRefs, getCrossRefsPartial, getCrossRefsByOem,
  getAftermarketRefs, getAnalogByOem, searchByArticleNo,
  getSuppliersList, getLanguagesList, getCountriesList,
};
