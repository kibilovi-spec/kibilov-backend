require('dotenv').config();
const autodoc = require('./src/services/autodoc');

const KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const hdrs = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };

const apiFetch = async (url, opts={}) => {
  const r = await fetch(url, { headers: hdrs, ...opts });
  return r.json();
};

async function test() {
  console.log('\n========================================');
  console.log('   KIBILOV.GE — FULL AUTODOC API TEST');
  console.log('========================================\n');

  let pass = 0, fail = 0;
  const check = (label, condition, info='') => {
    if (condition) { console.log(`  ✅ ${label} ${info}`); pass++; }
    else { console.log(`  ❌ ${label} ${info}`); fail++; }
  };

  // ═══════════════════════════════════════════════
  // 1. MANUFACTURERS
  // ═══════════════════════════════════════════════
  console.log('1. MANUFACTURERS');
  const manuData = await apiFetch(`https://${HOST}/api/manufacturers/list/type-id/1`);
  check('Manufacturers loaded', manuData?.countManufactures > 0, `(${manuData?.countManufactures} მარკა)`);
  const makes = manuData?.manufacturers || [];
  const mb = makes.find(m => m.manufacturerName === 'MERCEDES-BENZ');
  const vw = makes.find(m => m.manufacturerName === 'VW');
  const bmw = makes.find(m => m.manufacturerName === 'BMW');
  const ford = makes.find(m => m.manufacturerName === 'FORD');
  const toyota = makes.find(m => m.manufacturerName === 'TOYOTA');
  const kia = makes.find(m => m.manufacturerName === 'KIA');
  check('MERCEDES-BENZ found', !!mb, `(id:${mb?.manufacturerId})`);
  check('VW found', !!vw, `(id:${vw?.manufacturerId})`);
  check('BMW found', !!bmw, `(id:${bmw?.manufacturerId})`);
  check('FORD found', !!ford, `(id:${ford?.manufacturerId})`);
  check('TOYOTA found', !!toyota, `(id:${toyota?.manufacturerId})`);
  check('KIA found', !!kia, `(id:${kia?.manufacturerId})`);

  // ═══════════════════════════════════════════════
  // 2. MODELS
  // ═══════════════════════════════════════════════
  console.log('\n2. MODELS');
  const mbModels = (await apiFetch(`https://${HOST}/api/models/list/type-id/1/manufacturer-id/${mb.manufacturerId}/lang-id/4/country-filter-id/63`))?.models || [];
  check('Mercedes models', mbModels.length > 0, `(${mbModels.length} მოდელი)`);
  const cClass = mbModels.find(m => m.modelName.includes('C-CLASS') && m.modelName.includes('W204'));
  check('C-CLASS W204 found', !!cClass, cClass?.modelName || '');

  const vwModels = (await apiFetch(`https://${HOST}/api/models/list/type-id/1/manufacturer-id/${vw.manufacturerId}/lang-id/4/country-filter-id/63`))?.models || [];
  const golf6 = vwModels.find(m => m.modelName.includes('GOLF VI'));
  check('VW Golf VI found', !!golf6, golf6?.modelName || '');

  const bmwModels = (await apiFetch(`https://${HOST}/api/models/list/type-id/1/manufacturer-id/${bmw.manufacturerId}/lang-id/4/country-filter-id/63`))?.models || [];
  const bmw3 = bmwModels.find(m => m.modelName.startsWith('3 ') || m.modelName === '3');
  check('BMW 3-Series found', !!bmw3, bmw3?.modelName || '');

  // ═══════════════════════════════════════════════
  // 3. VEHICLES (engine variants)
  // ═══════════════════════════════════════════════
  console.log('\n3. VEHICLE VARIANTS (engine)');
  const cClassVehicles = (await apiFetch(`https://${HOST}/api/types/type-id/1/list-vehicles-id/${cClass.modelId}/lang-id/4/country-filter-id/63`))?.modelTypes || [];
  check('C-CLASS W204 variants', cClassVehicles.length > 0, `(${cClassVehicles.length} variant)`);
  console.log(`     მაგ: ${cClassVehicles[0]?.typeEngineName}`);

  const golf6Vehicles = (await apiFetch(`https://${HOST}/api/types/type-id/1/list-vehicles-id/${golf6.modelId}/lang-id/4/country-filter-id/63`))?.modelTypes || [];
  check('Golf VI variants', golf6Vehicles.length > 0, `(${golf6Vehicles.length} variant)`);

  // ═══════════════════════════════════════════════
  // 4. CATEGORIES by Vehicle
  // ═══════════════════════════════════════════════
  console.log('\n4. PART CATEGORIES by Vehicle');
  const v = cClassVehicles[0];
  const cats = await apiFetch(`https://${HOST}/api/category/type-id/1/products-groups-variant-1/${v.vehicleId}/lang-id/4`);
  const catList = cats?.productGroupsVariant1 || cats || [];
  check('Categories for C-CLASS', Array.isArray(catList) && catList.length > 0, `(${Array.isArray(catList) ? catList.length : '?'} კატ.)`);

  // ═══════════════════════════════════════════════
  // 5. ARTICLES by Vehicle + Category
  // ═══════════════════════════════════════════════
  console.log('\n5. ARTICLES (parts list)');
  const arts = await apiFetch(`https://${HOST}/api/articles/list/type-id/1/vehicle-id/${v.vehicleId}/category-id/100030/lang-id/4`);
  const artList = arts?.articles || [];
  check('Brake pads articles for C-CLASS', artList.length > 0, `(${artList.length} article)`);

  // ═══════════════════════════════════════════════
  // 6. OEM CODES
  // ═══════════════════════════════════════════════
  console.log('\n6. OEM CODES');
  if (artList.length > 0) {
    const ids = artList.slice(0, 5).map(a => a.articleId);
    const oems = await apiFetch(`https://${HOST}/api/articles/get-oems-by-list-of-articles-ids`, {
      method: 'POST',
      headers: { ...hdrs, 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleIds: ids })
    });
    const oemList = (oems?.articles || []).flatMap(a => a.oemNo?.map(o => o.oemDisplayNo) || []);
    check('OEM codes fetched', oemList.length > 0, `(${oemList.length} OEM)`);
    console.log(`     მაგ: ${oemList.slice(0,3).join(', ')}`);
  }

  // ═══════════════════════════════════════════════
  // 7. VIN DECODE
  // ═══════════════════════════════════════════════
  console.log('\n7. VIN DECODE');
  const vin1 = await apiFetch(`https://${HOST}/api/vin/tecdoc-vin-check/WDBFA68F42F202731`);
  const vinMatch = vin1?.data?.matchingVehicles?.array?.[0];
  check('VIN decode', !!vinMatch, vinMatch?.carName || '');

  // ═══════════════════════════════════════════════
  // 8. CROSS REFERENCES
  // ═══════════════════════════════════════════════
  console.log('\n8. CROSS REFERENCES');
  if (artList.length > 0) {
    const crossRef = await apiFetch(`https://${HOST}/api/artlookup/select-article-cross-references/article-id/${artList[0].articleId}/lang-id/4`);
    const refs = crossRef?.articleCrossReferences || crossRef || [];
    check('Cross refs', Array.isArray(refs), `(${Array.isArray(refs) ? refs.length : '?'} ref)`);
  }

  // ═══════════════════════════════════════════════
  // 9. KIBILOV AI SEARCH
  // ═══════════════════════════════════════════════
  console.log('\n9. KIBILOV AI SEARCH PIPELINE');
  const searches = [
    { make:'MERCEDES-BENZ', model:'C-Class', year:'2007', partQuery:'კალოტკა' },
    { make:'VW', model:'Golf 6', year:'2010', partQuery:'brake pads' },
    { make:'BMW', model:'3 Series', year:'2005', partQuery:'oil filter' },
    { make:'FORD', model:'Transit', year:'2003', partQuery:'brake pads' },
    { make:'TOYOTA', model:'Camry', year:'2011', partQuery:'brake disc' },
    { make:'MERCEDES-BENZ', model:'Sprinter', year:'2005', partQuery:'fuel filter' },
    { make:'OPEL', model:'Astra', year:'2004', partQuery:'timing belt' },
    { make:'NISSAN', model:'X-Trail', year:'2008', partQuery:'CV joint' },
  ];

  for (const s of searches) {
    const r = await fetch('http://localhost:3001/api/autodoc-search/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s)
    });
    const d = await r.json();
    const v = d.vehicle ? d.vehicle.substring(0,25) : '?';
    const p = d.products?.length || 0;
    check(`${s.make} ${s.model} "${s.partQuery}"`, !!d.vehicle, `→ ${v} | ${p} products`);
  }

  // ═══════════════════════════════════════════════
  // 10. KIBILOV CATALOG ENDPOINTS
  // ═══════════════════════════════════════════════
  console.log('\n10. KIBILOV CATALOG API');
  const r1 = await fetch('http://localhost:3001/api/catalog/manufacturers');
  const mans = await r1.json();
  check('Catalog manufacturers', Array.isArray(mans) && mans.length > 0, `(${mans.length})`);

  const r2 = await fetch('http://localhost:3001/api/catalog/models?manufacturerId=74');
  const mods = await r2.json();
  check('Catalog models (Mercedes)', Array.isArray(mods) && mods.length > 0, `(${mods.length})`);

  const r3 = await fetch(`http://localhost:3001/api/catalog/vehicles?modelId=${cClass.modelId}`);
  const vars = await r3.json();
  check('Catalog vehicles (C-CLASS)', Array.isArray(vars) && vars.length > 0, `(${vars.length})`);

  // ═══════════════════════════════════════════════
  // 11. ADMIN ENDPOINTS
  // ═══════════════════════════════════════════════
  console.log('\n11. ADMIN ENDPOINTS');
  const adminEndpoints = [
    ['/api/health', 'Health Check'],
    ['/api/admin/oem-gaps', 'OEM Gaps'],
    ['/api/admin/vehicle-coverage', 'Vehicle Coverage'],
    ['/api/admin/inventory', 'Inventory'],
    ['/api/admin/search-quality', 'Search Quality'],
    ['/api/admin/funnel', 'Funnel'],
    ['/api/admin/system', 'System Health'],
  ];

  // Get admin token
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({id:'test',role:'ADMIN'}, process.env.JWT_SECRET||'kibilov-secret-2024', {expiresIn:'1h'});

  for (const [endpoint, label] of adminEndpoints) {
    try {
      const r = await fetch(`http://localhost:3001${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d = await r.json();
      check(label, r.status === 200 && !d.error, `(${r.status})`);
    } catch(e) {
      check(label, false, e.message);
    }
  }

  // ═══════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════
  const total = pass + fail;
  const rate = Math.round((pass/total)*100);
  console.log('\n========================================');
  console.log(`   RESULT: ${pass}/${total} PASSED (${rate}%)`);
  console.log(`   ✅ ${pass} passed  ❌ ${fail} failed`);
  if (rate >= 90) console.log('   🟢 PRODUCTION READY');
  else if (rate >= 70) console.log('   🟡 MOSTLY WORKING');
  else console.log('   🔴 NEEDS FIXES');
  console.log('========================================\n');

  process.exit(0);
}
test().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
