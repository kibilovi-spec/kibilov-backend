require('dotenv').config();
const KEY = process.env.RAPIDAPI_KEY;
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const hdrs = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };

const sleep = ms => new Promise(r => setTimeout(r, ms));

const vinTests = [
  // სწორი VIN-ები
  { vin: 'WDBFA68F42F202731', label: 'Mercedes W203', expectBrand: 'MERCEDES' },
  { vin: 'WVWZZZ1KZ9W123456', label: 'VW Golf', expectBrand: 'VW' },
  { vin: 'WBA3A5C50CF256985', label: 'BMW E90', expectBrand: 'BMW' },
  // Edge cases
  { vin: 'wdbfa68f42f202731', label: 'lowercase VIN', expectBrand: 'MERCEDES' },
  { vin: 'WDBFA68F42F20273',  label: '16 სიმბოლო (short)', expectBrand: null },
  { vin: 'WDBFA68F42F2027310', label: '18 სიმბოლო (long)', expectBrand: null },
  { vin: '', label: 'ცარიელი VIN', expectBrand: null },
  { vin: 'INVALIDVIN123456X', label: 'არარსებული VIN', expectBrand: null },
  { vin: '00000000000000000', label: 'ნულოვანი VIN', expectBrand: null },
];

async function testVinDecode(vin) {
  if (!vin) return { ok: false, error: 'empty VIN' };
  const upperVin = vin.toUpperCase().replace(/\s/g,'');
  const r = await fetch(
    `https://${HOST}/api/vin/tecdoc-vin-check/${upperVin}`,
    { headers: hdrs }
  );
  const d = await r.json();
  if (d.message && d.message.includes('quota')) return { ok: false, error: 'quota exceeded' };
  const match = d?.data?.matchingVehicles?.array?.[0];
  return match ? {
    ok: true,
    carName: match.carName,
    make: match.manufacturerName || match.carName?.split(' ')[0],
    model: match.modelName,
    year: match.yearFrom,
    engine: match.typeEngineName,
  } : { ok: false, error: 'not found' };
}

async function testKibilovSearch(vin, partQuery='brake pads') {
  const r = await fetch('http://localhost:3001/api/autodoc-search/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vin, partQuery })
  });
  return r.json();
}

async function run() {
  console.log('\n' + '='.repeat(55));
  console.log('   VIN TEST — ყველა ეტაპი');
  console.log('='.repeat(55));

  let pass=0, fail=0;
  const check = (label, ok, info='') => {
    if (ok) { pass++; console.log(`  ✅ ${label} ${info}`); }
    else { fail++; console.log(`  ❌ ${label} ${info}`); }
  };

  // ═══════════ 1. AUTODOC VIN API ═══════════
  console.log('\n📍 1. AUTODOC VIN DECODE API');
  for (const t of vinTests.slice(0, 4)) {
    await sleep(1500);
    const res = await testVinDecode(t.vin);
    if (t.expectBrand) {
      check(t.label, res.ok, res.ok ? `→ ${res.carName}` : res.error);
    } else {
      check(t.label + ' (უნდა ჩავარდეს)', !res.ok, res.error || 'correctly rejected');
    }
  }

  // ═══════════ 2. VIN EDGE CASES ═══════════
  console.log('\n📍 2. VIN EDGE CASES');
  for (const t of vinTests.slice(4)) {
    await sleep(500);
    // Kibilov search-ის through ვტესტავთ
    const res = await testKibilovSearch(t.vin || '', 'brake pads');
    const hasVehicle = !!res.vehicle && res.vehicle !== '?';
    if (t.expectBrand) {
      check(t.label, hasVehicle, res.vehicle || res.error || 'no vehicle');
    } else {
      check(t.label + ' (correctly rejected)', !hasVehicle || res.products?.length === 0, 
        res.vehicle || res.error || 'ok');
    }
  }

  // ═══════════ 3. VIN → VEHICLE PIPELINE ═══════════
  console.log('\n📍 3. VIN → VEHICLE → OEM PIPELINE');
  await sleep(1000);
  const mbResult = await testVinDecode('WDBFA68F42F202731');
  check('VIN → მარკა (MERCEDES)', mbResult.ok && mbResult.carName?.includes('MERCEDES'), mbResult.carName || '');
  check('VIN → მოდელი', mbResult.ok && !!mbResult.model, mbResult.model || mbResult.carName || '');
  check('VIN → ძრავი', mbResult.ok && !!mbResult.engine, mbResult.engine || '');

  await sleep(1500);
  const mbSearch = await testKibilovSearch('WDBFA68F42F202731', 'კალოტკა');
  check('VIN → Kibilov search', !!mbSearch.vehicle, mbSearch.vehicle || mbSearch.error || '');
  check('VIN → products', (mbSearch.products?.length || 0) > 0, `${mbSearch.products?.length || 0} products`);
  check('VIN → OEM codes', (mbSearch.oemCodes?.length || 0) > 0, `${mbSearch.oemCodes?.length || 0} codes`);

  // ═══════════ 4. VIN → DIFFERENT PARTS ═══════════
  console.log('\n📍 4. VIN + სხვადასხვა ნაწილი');
  const parts = ['brake pads', 'oil filter', 'shock absorber', 'timing belt'];
  for (const part of parts) {
    await sleep(1500);
    const res = await testKibilovSearch('WDBFA68F42F202731', part);
    check(`VIN + "${part}"`, !!res.vehicle, `${res.vehicle?.substring(0,20) || '?'} | ${res.products?.length || 0} prods`);
  }

  // ═══════════ 5. VIN CACHE ═══════════
  console.log('\n📍 5. VIN CACHE (Redis)');
  await sleep(500);
  const t1 = Date.now();
  await testKibilovSearch('WDBFA68F42F202731', 'brake pads');
  const time1 = Date.now() - t1;
  
  await sleep(200);
  const t2 = Date.now();
  await testKibilovSearch('WDBFA68F42F202731', 'brake pads');
  const time2 = Date.now() - t2;
  
  check('Cache hit სწრაფია', time2 < time1, `first:${time1}ms second:${time2}ms`);
  check('Cache < 500ms', time2 < 500, `${time2}ms`);

  // ═══════════ 6. DB CACHE ═══════════
  console.log('\n📍 6. VIN → DB vehicle_cache');
  const { execSync } = require('child_process');
  const dbResult = execSync(
    `PGPASSWORD=Anarkia199090 psql -U postgres -h localhost -d kibilov_db -t -c "SELECT vin, manufacturer, model FROM vehicle_cache WHERE vin='WDBFA68F42F202731' LIMIT 1;"`
  ).toString().trim();
  check('VIN DB cache-ში', dbResult.includes('MERCEDES') || dbResult.length > 5, dbResult.substring(0,50));

  // ═══════════ SUMMARY ═══════════
  const total = pass + fail;
  console.log('\n' + '='.repeat(55));
  console.log(`   VIN TEST: ${pass}/${total} = ${Math.round(pass/total*100)}%`);
  console.log(fail === 0 ? '   🏆 100% PERFECT!' : `   ❌ ${fail} failed`);
  console.log('='.repeat(55) + '\n');
  process.exit(0);
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
