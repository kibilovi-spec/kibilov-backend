const express = require('express');
const router = express.Router();
const autodoc = require('../services/autodoc');

const wrap = fn => async (req, res) => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (err) {
    const s = err?.response?.status || 500;
    res.status(s).json({ success: false, error: err?.response?.data?.message || err.message });
  }
};

// VIN
router.get('/vin/check/:vin',     wrap(r => autodoc.vinCheck(r.params.vin)));
router.get('/vin/decode/:vin',    wrap(r => autodoc.vinDecodeV3(r.params.vin)));

// Catalog
router.get('/manufacturers',      wrap(r => autodoc.getManufacturersByType(r.query.typeId || 1)));
router.get('/models/:manuId',     wrap(r => autodoc.getModelsByManufacturer(r.params.manuId, r.query.typeId || 1)));
router.get('/vehicles/:modelId',  wrap(r => autodoc.getVehicleIdsByModel(r.params.modelId)));
router.get('/vehicle/:id',        wrap(r => autodoc.getVehicleInfo(r.params.id)));
router.get('/categories/:vehicleId', wrap(r => autodoc.getCategoriesByVehicle(r.params.vehicleId, r.query.typeId || 1, r.query.langId || 4)));

// OEM flow
router.get('/articles/:vehicleId/:catId', wrap(r => autodoc.getArticlesByVehicle(r.params.vehicleId, r.params.catId)));
router.post('/oem',               wrap(r => autodoc.getOemsByArticleIds(r.body.articleIds)));
router.get('/crossref/:articleId',wrap(r => autodoc.getCrossRefs(r.params.articleId)));
router.get('/equiv-oem/:articleId', wrap(r => autodoc.getEquivalentOem(r.params.articleId)));

// Product display
router.post('/details',           wrap(r => autodoc.getArticleDetails(r.body.articleIds, r.body.langId || 4)));
router.post('/media',             wrap(r => autodoc.getArticleMedia(r.body.articleIds)));

module.exports = router;
