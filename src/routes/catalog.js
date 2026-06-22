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
  } catch(e) { res.status(500).json({ error: e.message }); }
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
  } catch(e) { res.status(500).json({ error: e.message }); }
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
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// GET /api/catalog/makes — alias for manufacturers
router.get('/makes', async (req, res) => {
  try {
    const cacheKey = 'catalog:manufacturers';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);
    const data = await apiFetch(`${BASE_URL}/manufacturers/list/type-id/1`);
    const result = (data.manufacturers || [])
      .map(m => ({ id: m.manufacturerId, name: m.manufacturerName }))
      .sort((a, b) => a.name.localeCompare(b.name));
    await cache.set(cacheKey, result, 86400);
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/catalog/models?makeId=X
router.get('/models', async (req, res) => {
  try {
    const makeId = req.query.makeId || req.query.manufacturerId;
    if (!makeId) return res.status(400).json({ error: 'makeId საჭიროა' });
    const cacheKey = `catalog:models:${makeId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);
    const data = await apiFetch(`${BASE_URL}/models/list/type-id/1/manufacturer-id/${makeId}/lang-id/4/country-filter-id/63`);
    const result = (data.models || data || [])
      .map(m => ({ id: m.modelId || m.id, name: m.modelName || m.name, yearFrom: m.yearOfConstructionFrom, yearTo: m.yearOfConstructionTo }))
      .sort((a, b) => (a.name||'').localeCompare(b.name||''));
    await cache.set(cacheKey, result, 86400);
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/catalog/years?modelId=X
router.get('/years', async (req, res) => {
  try {
    const { modelId } = req.query;
    if (!modelId) return res.status(400).json({ error: 'modelId საჭიროა' });
    const cacheKey = `catalog:years:${modelId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);
    const data = await apiFetch(`${BASE_URL}/types/type-id/1/list-vehicles-id/${modelId}/lang-id/4/country-filter-id/63`);
    const items = data.modelTypes || data.vehicles || data || [];
    // unique years
    const yearsSet = new Set();
    items.forEach(v => {
      if (v.yearOfConstructionFrom) yearsSet.add(parseInt(v.yearOfConstructionFrom));
    });
    const years = [...yearsSet].sort((a, b) => b - a);
    await cache.set(cacheKey, years, 86400);
    res.json(years);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/catalog/engines?modelId=X&year=Y
router.get('/engines', async (req, res) => {
  try {
    const { modelId, year } = req.query;
    if (!modelId) return res.status(400).json({ error: 'modelId საჭიროა' });
    const cacheKey = `catalog:engines:${modelId}:${year||'all'}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);
    const data = await apiFetch(`${BASE_URL}/types/type-id/1/list-vehicles-id/${modelId}/lang-id/4/country-filter-id/63`);
    const items = data.modelTypes || data.vehicles || data || [];
    let filtered = items;
    if (year) filtered = items.filter(v => v.yearOfConstructionFrom && parseInt(v.yearOfConstructionFrom) <= parseInt(year) && (!v.yearOfConstructionTo || parseInt(v.yearOfConstructionTo) >= parseInt(year)));
    const result = filtered.map(v => ({ id: v.vehicleId || v.id, name: v.typeEngineName || v.vehicleFullName || v.name, year: v.yearOfConstructionFrom }));
    await cache.set(cacheKey, result, 86400);
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/catalog/resolve?make=Ford&model=Focus&year=2010
router.get('/resolve', async (req, res) => {
  try {
    const { make, model, year } = req.query;
    if (!make) return res.status(400).json({ error: 'make საჭიროა' });
    // manufacturers
    const mfgData = await apiFetch(`${BASE_URL}/manufacturers/list/type-id/1`);
    const mfg = (mfgData.manufacturers || []).find(m => m.manufacturerName.toLowerCase() === make.toLowerCase());
    if (!mfg) return res.json({ found: false });
    if (!model) return res.json({ found: true, makeId: mfg.manufacturerId, makeName: mfg.manufacturerName });
    // models
    const modData = await apiFetch(`${BASE_URL}/models/list/type-id/1/manufacturer-id/${mfg.manufacturerId}/lang-id/4/country-filter-id/63`);
    const mod = (modData.models || []).find(m => (m.modelName||'').toLowerCase().includes(model.toLowerCase()));
    if (!mod) return res.json({ found: true, makeId: mfg.manufacturerId });
    return res.json({ found: true, makeId: mfg.manufacturerId, makeName: mfg.manufacturerName, modelId: mod.modelId, modelName: mod.modelName });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
