'use strict';
const express = require('express');
const router = express.Router();
const cache = require('../services/cache');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}/api`;
const hdrs = { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': RAPIDAPI_KEY };

const apiFetch = async (url) => {
  const res = await fetch(url, { headers: hdrs });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

router.get('/vehicles', async (req, res) => {
  try {
    const { modelId } = req.query;
    if (!modelId) return res.status(400).json({ error: 'modelId საჭიროა' });
    const cacheKey = `catalog:vehicles:${modelId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);
    const data = await apiFetch(`${BASE_URL}/types/type-id/1/list-vehicles-id/${modelId}/lang-id/4/country-filter-id/63`);
    const items = data.modelTypes || data.vehicles || data || [];
    const result = items.map(v => ({
      id: v.vehicleId || v.id,
      name: v.typeEngineName || v.vehicleFullName || v.name,
      modelName: v.modelName,
      manufacturer: v.manufacturerName
    }));
    await cache.set(cacheKey, result, 86400);
    res.json(result);
  } catch(e) { console.error('[catalog.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

router.get('/categories', async (req, res) => {
  try {
    const { vehicleId } = req.query;
    if (!vehicleId) return res.status(400).json({ error: 'vehicleId საჭიროა' });
    const cacheKey = `catalog:categories:${vehicleId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);
    const data = await apiFetch(`${BASE_URL}/category/type-id/1/products-groups-variant-1/${vehicleId}/lang-id/4`);
    await cache.set(cacheKey, data, 86400);
    res.json(data);
  } catch(e) { console.error('[catalog.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

router.get('/parts', async (req, res) => {
  try {
    const { vehicleId, categoryId } = req.query;
    if (!vehicleId || !categoryId) return res.status(400).json({ error: 'vehicleId და categoryId საჭიროა' });
    const cacheKey = `catalog:parts:${vehicleId}:${categoryId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);
    const data = await apiFetch(`${BASE_URL}/articles/list/type-id/1/vehicle-id/${vehicleId}/category-id/${categoryId}/lang-id/4`);
    await cache.set(cacheKey, data, 3600);
    res.json(data);
  } catch(e) { console.error('[catalog.js]', e); res.status(500).json({ error: 'სერვერზე დაფიქსირდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით' }); }
});

// Note: /makes, /models, /years, /engines, /resolve წაშლილია აქედან 2026-07-11-ს —
// ეს ზუსტად იგივე path-ები უკვე გამართულია vehicles_catalog.js-ში (ლოკალური
// vehicle_makes/vehicle_models ცხრილებით), რომელიც ამ ფაილზე ადრეა mount-ული
// server.js-ში და ისედაც იმარჯვებდა — ეს იყო წმინდა მკვდარი, დუბლირებული კოდი.

module.exports = router;
