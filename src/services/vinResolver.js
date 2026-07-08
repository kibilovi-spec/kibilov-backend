const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const BASE = `https://${HOST}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getKey() { return process.env.RAPIDAPI_KEY; }

async function safeCall(url, retries = 4, method = 'GET', body = null) {
  const key = getKey();
  if (!key) return null;
  const headers = { 'x-rapidapi-key': key, 'x-rapidapi-host': HOST };
  if (method === 'POST') headers['Content-Type'] = 'application/json';
  for (let i = 0; i <= retries; i++) {
    try {
      const opts = { method, headers, signal: AbortSignal.timeout(8000) };
      if (body) opts.body = JSON.stringify(body);
      const r = await fetch(url, opts);
      const text = await r.text();
      if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
        if (i < retries) { await sleep(500 * (i + 1)); continue; }
        return null;
      }
      const parsed = JSON.parse(text);
      // rate_limit_exceeded check — retry with backoff
      if (parsed && parsed.error === 'rate_limit_exceeded') {
        if (i < retries) { await sleep(1500 * (i + 1)); continue; }
        return null;
      }
      return parsed;
    } catch(e) {
      if (i < retries) await sleep(500 * (i + 1));
    }
  }
  return null;
}

async function decodeV3(vin) {
  // v2 first — most complete data (make/model/year/engine), v3 fallback
  const d2 = await safeCall(`${BASE}/api/vin/decoder-v2/${vin}`);
  if (d2 && d2.make) {
    const displ = d2['displacement_(l)'] || d2.displacement_l;
    const engineStr = displ ? parseFloat(displ).toFixed(1) + 'L' : (d2.engine_model || null);
    return {
      make: d2.make,
      model: d2.model || null,
      year: d2.model_year ? parseInt(d2.model_year) : null,
      chassis: d2.trim || null,
      body: d2.body_class || null,
      engine: engineStr,
      fuel: d2['fuel_type_-_primary'] || d2.fuel_type_primary || null,
      source: 'v2',
      confidence: 0.95,
    };
  }
  const d = await safeCall(`${BASE}/api/vin/decoder-v3/${vin}`);
  if (d && Array.isArray(d)) {
    const general = d.find(s => s && s.title === 'General information');
    const info = (general && general.information) || {};
    if (info.Make) return {
      make: info.Make,
      model: info.Model || null,
      year: info['Model year'] ? parseInt(info['Model year']) : null,
      chassis: info['Trim level'] || null,
      body: info['Body style'] || null,
      source: 'v3_fallback',
      confidence: 0.90,
    };
  }
  return null;
}

async function decodeV1(vin) {
  const d = await safeCall(`${BASE}/api/vin/decoder-v1/${vin}`);
  if (!d || !d.manufacturer) return null;
  return {
    make: d.manufacturer,
    model: null,
    year: null,
    region: d.region || null,
    source: 'v1',
    confidence: 0.50,
  };
}

async function decodeNHTSA(vin) {
  try {
    const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${vin}?format=json`);
    const d = await r.json();
    const res = d.Results && d.Results[0];
    if (!res || !res.Make || res.Make === 'NOT SPECIFIED' || res.Make === '') return null;
    return {
      make: res.Make,
      model: res.Model || null,
      year: res.ModelYear ? parseInt(res.ModelYear) : null,
      engine: res.DisplacementL ? parseFloat(res.DisplacementL).toFixed(1) + 'L' : null,
      fuel: res.FuelTypePrimary || null,
      source: 'nhtsa',
      confidence: 0.80,
    };
  } catch(e) { return null; }
}

async function decodeTecdocVinCheck(vin) {
  const d = await safeCall(`${BASE}/api/vin/tecdoc-vin-check/${vin}`);
  if (!d || !d.data) return null;
  const matching = (d.data.matchingVehicles && d.data.matchingVehicles.array) || d.data.matchingVehicles;
  if (!Array.isArray(matching) || matching.length === 0) {
    const manuArr = (d.data.matchingManufacturers && d.data.matchingManufacturers.array) || [];
    const manuId = manuArr[0] && manuArr[0].manuId;
    const manuName = manuArr[0] && manuArr[0].manuName;
    if (manuId) {
      return {
        make: manuName || null, model: null, year: null,
        source: 'tecdoc_manu_only', manuId: manuId, confidence: 0.4,
      };
    }
    return null;
  }
  // თუ რამდენიმე vehicle — ყველა დავაბრუნოთ
  if (matching.length > 1) {
    // VIN 10-ე სიმბოლოდან წელი (ISO 3779)
    const _yc = {'A':1980,'B':1981,'C':1982,'D':1983,'E':1984,'F':1985,'G':1986,'H':1987,'J':1988,'K':1989,'L':1990,'M':1991,'N':1992,'P':1993,'R':1994,'S':1995,'T':1996,'V':1997,'W':1998,'X':1999,'Y':2000,'1':2001,'2':2002,'3':2003,'4':2004,'5':2005,'6':2006,'7':2007,'8':2008,'9':2009};
    const vinYear = vin.length >= 10 && _yc[vin[9]] ? String(_yc[vin[9]]) : null;
    // თითოეული vehicle-ისთვის წლები ავიღოთ
    const vehiclesWithYears = await Promise.all(matching.map(async v => {
      let yearStr = '';
      try {
        const det = await safeCall(`${BASE}/api/types/type-id/1/vehicle-type-details/${v.vehicleId}/lang-id/4/country-filter-id/63`);
        const start = det?.vehicleTypeDetails?.constructionIntervalStart;
        const end = det?.vehicleTypeDetails?.constructionIntervalEnd;
        if (start) {
          const sy = start.substring(0,4);
          const ey = end ? end.substring(0,4) : '';
          yearStr = ey ? ` (${sy}-${ey})` : ` (${sy}-)`;
        }
      } catch(e) {}
      return {
        vehicleId: String(v.vehicleId),
        carName: v.carName + yearStr,
        engine: v.vehicleTypeDescription || null,
      };
    }));
    return {
      make: null, model: null, year: null, engine: null,
      source: 'tecdoc_multi',
      confidence: 1.0,
      vehicles: vehiclesWithYears
    };
  }
  const v = matching[0];
  // carName მაგ: "SKODA FABIA I (6Y2) 1.4" — make/model ამოვიღოთ
  const manuArr = (d.data.matchingManufacturers && d.data.matchingManufacturers.array) || [];
  const manuName = (manuArr[0] && manuArr[0].manuName) || null;
  const modelArr = (d.data.matchingModels && d.data.matchingModels.array) || [];
  const modelName = (modelArr[0] && modelArr[0].modelName) || null;
  const carName = v.carName || '';
  const makeFinal = v.manufacturerName || manuName || (carName.split(' ')[0]) || null;
  const modelFinal = v.modelName || v.vehicleName || modelName || null;
  const vehicleIdFinal = v.vehicleId ? String(v.vehicleId) : null;

  // vehicle-type-details-დან სრული ინფო
  let yearFinal = v.yearOfConstrFrom ? parseInt(String(v.yearOfConstrFrom).substring(0,4)) : null;
  let engineFinal = v.vehicleTypeDescription || v.engineCode || v.engineName || null;
  let fuelFinal = null;
  let chassisFinal = null;
  let engIdFinal = null;

  if (vehicleIdFinal) {
    await sleep(300);
    const det = await safeCall(`${BASE}/api/types/type-id/1/vehicle-type-details/${vehicleIdFinal}/lang-id/4/country-filter-id/63`, 1);
    const d = det && det.vehicleTypeDetails;
    if (d) {
      if (!yearFinal && d.constructionIntervalStart) yearFinal = parseInt(d.constructionIntervalStart.substring(0, 4));
      const eng = [d.capacityLt ? parseFloat(d.capacityLt).toFixed(1) + 'L' : null, d.engCodes || null, d.powerKw ? Math.round(d.powerKw) + 'kW' : null].filter(Boolean).join(' ');
      if (eng) engineFinal = eng;
      fuelFinal = d.fuelType || null;
      chassisFinal = d.bodyType || null;
      if (d.engId) engIdFinal = d.engId;
    }
  }

  return {
    make: makeFinal,
    model: modelFinal,
    year: yearFinal,
    engine: engineFinal,
    fuel: fuelFinal,
    chassis: chassisFinal,
    vehicleId: vehicleIdFinal,
    engId: engIdFinal,
    source: 'tecdoc',
    confidence: 1.0,
  };
}

async function decodeFromCache(vin, prisma) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT vehicle_id, manufacturer, model, year, engine, fuel
      FROM vehicle_cache WHERE vin = ${vin.toUpperCase()} AND model != '' LIMIT 1
    `;
    if (!rows || !rows.length) return null;
    const row = rows[0];
    return {
      make: row.manufacturer,
      model: row.model,
      year: row.year ? parseInt(row.year) : null,
      engine: row.engine || null,
      vehicleId: row.vehicle_id,
      source: 'cache',
      confidence: 1.0,
    };
  } catch(e) { return null; }
}

async function saveToCache(vin, data, prisma) {
  if (!data || !data.make) return;
  if (!data.vehicleId || data.vehicleId === vin) return;
  try {
    // vehicle_id primary key, vin unique — ორივე შემთხვევა დავფაროთ
    await prisma.$executeRaw`
      INSERT INTO vehicle_cache (vehicle_id, vin, manufacturer, model, year, engine, fuel)
      VALUES (${String(data.vehicleId)}, ${vin}, ${data.make}, ${data.model || ''}, ${String(data.year || '')}, ${data.engine || ''}, ${data.fuel || ''})
      ON CONFLICT (vehicle_id) DO UPDATE SET
        vin = EXCLUDED.vin,
        manufacturer = EXCLUDED.manufacturer,
        model = EXCLUDED.model,
        year = EXCLUDED.year,
        engine = EXCLUDED.engine,
        fuel = EXCLUDED.fuel,
        updated_at = NOW()
    `;
  } catch(e) {}
}

async function resolveVIN(vin, prisma) {
  if (!vin || vin.length !== 17) return null;
  const vinUpper = vin.toUpperCase();

  const cached = await decodeFromCache(vinUpper, prisma);
  if (cached) return cached;

  const tecdoc = await decodeTecdocVinCheck(vinUpper);
  if (tecdoc && tecdoc.source === 'tecdoc_multi') {
    const firstVehicle = tecdoc.vehicles && tecdoc.vehicles[0];
    if (firstVehicle) {
      const cached2 = await decodeFromCache(vinUpper, prisma);
      if (cached2) return cached2;
    }
    return tecdoc;
  }
  // manuId only (e.g. Mazda) — manuId-ით models ვიღებთ, VIN-ის 4-6 სიმბოლოებით chassis ვფილტრავთ
  if (tecdoc && tecdoc.source === 'tecdoc_manu_only' && tecdoc.manuId) {
    try {
      const modelsR = await safeCall(`${BASE}/api/models/list/type-id/1/manufacturer-id/${tecdoc.manuId}/lang-id/4/country-filter-id/63`);
      const models = modelsR && modelsR.models || [];
      const vds = vinUpper.substring(3, 9); // VIN 4-9 chars = VDS
      // chassis match: modelName-ში bracket-ებს შევამოწმოთ (BM, BN etc)
      const chassis4 = vinUpper.substring(3, 7).toUpperCase();
      let matched = models.filter(m => {
        const mn = m.modelName || '';
        const brackets = mn.match(/\(([^)]+)\)/g) || [];
        return brackets.some(b => b.toUpperCase().includes(chassis4.substring(0,2)));
      });
      if (matched.length > 0) {
        // vehicles ვიღებთ პირველი matched model-ისთვის
        const vehicles = [];
        for (const m of matched.slice(0,3)) {
          const vehR = await safeCall(`${BASE}/api/types/type-id/1/list-vehicles-types/${m.modelId}/lang-id/4/country-filter-id/63`);
          const vehList = vehR && vehR.modelTypes || [];
          const seenVeh = new Set(vehicles.map(x => x.vehicleId));
          vehList.slice(0,10).forEach(v => { if (seenVeh.has(String(v.vehicleId))) return; seenVeh.add(String(v.vehicleId)); vehicles.push({
            vehicleId: String(v.vehicleId),
            carName: `${tecdoc.make} ${m.modelName} ${v.typeEngineName || ''}`.trim(),
            engine: v.typeEngineName || null,
          }); });
          if (vehicles.length >= 10) break;
          await sleep(300);
        }
        if (vehicles.length > 0) {
          return { make: tecdoc.make, model: matched[0].modelName, year: null, source: 'tecdoc_multi', confidence: 0.7, vehicles };
        }
      }
    } catch(e) {}
    // fallback — NHTSA-ს ვეძახით model/year-ისთვის
    try {
      const nhtsa = await decodeNHTSA(vinUpper);
      if (nhtsa && nhtsa.model) {
        return { make: nhtsa.make||tecdoc.make, model: nhtsa.model, year: nhtsa.year, engine: nhtsa.engine, fuel: nhtsa.fuel, source: 'nhtsa', confidence: 0.8 };
      }
    } catch(e) {}
    return { make: tecdoc.make, model: null, year: null, source: 'manu_only', manuId: tecdoc.manuId, confidence: 0.3 };
  }
  if (tecdoc && tecdoc.make) {
    await saveToCache(vinUpper, tecdoc, prisma);
    return tecdoc;
  }

  const v3 = await decodeV3(vinUpper);
  if (v3 && v3.make) {
    await saveToCache(vinUpper, v3, prisma);
    return v3;
  }

  const nhtsa = await decodeNHTSA(vinUpper);
  if (nhtsa && nhtsa.make) {
    await saveToCache(vinUpper, nhtsa, prisma);
    return nhtsa;
  }

  const v1 = await decodeV1(vinUpper);
  if (v1 && v1.make) return v1;

  return null;
}

const CHASSIS_TO_MODEL = {
  'E65': 4816, 'E66': 4816, 'E67': 4816,
  'E46': 548,  'E90': 5765, 'E91': 5766, 'E92': 5767,
  'E39': 545,  'E60': 5764, 'E61': 5764,
  'W204': 6230, 'W211': 3303, 'W124': 1236, 'W210': 3028,
};

async function lookupVehicleIdViaAutodoc(vinData) {
  if (!vinData || !vinData.make || !vinData.model) return null;
  try {
    const autodoc = require('./autodoc');
    const mfgRaw = await autodoc.getManufacturersByType(1);
    const mfgList = mfgRaw && mfgRaw.manufacturers || [];
    const makeUpper = vinData.make.toUpperCase();
    const mfg = mfgList.find(m => m.manufacturerName.toUpperCase() === makeUpper);
    if (!mfg) return null;

    const modRaw = await autodoc.getModelsByManufacturer(mfg.manufacturerId);
    const modelList = modRaw && modRaw.models || [];
    const modelWord = vinData.model.toUpperCase().split(/[\s(]/)[0];
    const targetYear = vinData.year ? parseInt(vinData.year) : null;

    let candidates = modelList.filter(m => {
      const nameUpper = m.modelName.toUpperCase();
      if (!nameUpper.includes(modelWord)) return false;
      if (!targetYear) return true;
      const from = m.modelYearFrom ? parseInt(String(m.modelYearFrom).substring(0,4)) : 0;
      const to = m.modelYearTo ? parseInt(String(m.modelYearTo).substring(0,4)) : 9999;
      return targetYear >= from && targetYear <= to;
    });
    if (candidates.length === 0) return null;

    const wantsSaloon = vinData.body && /saloon|sedan/i.test(vinData.body);
    if (wantsSaloon) {
      const saloonOnly = candidates.filter(c => /saloon|sedan/i.test(c.modelName));
      if (saloonOnly.length) candidates = saloonOnly;
    } else {
      const noVan = candidates.filter(c => !/van|bus|pickup/i.test(c.modelName));
      if (noVan.length) candidates = noVan;
    }
    candidates = candidates.slice(0, 4);

    const engineTarget = vinData.engine ? parseFloat(String(vinData.engine).replace(/[^\d.]/g, '')) : null;

    let best = null, bestScore = -1;
    for (const c of candidates) {
      const vlist = await autodoc.getVehicleListByModel(c.modelId);
      const types = vlist && vlist.modelTypes || [];
      for (const t of types) {
        let score = 0;
        if (engineTarget) {
          const tEngine = parseFloat(String(t.typeEngineName).replace(/[^\d.]/g, ''));
          if (!isNaN(tEngine) && Math.abs(tEngine - engineTarget) < 0.05) score += 10;
        }
        if (vinData.fuel && /diesel/i.test(vinData.fuel) && /tdci|tdi|cdi|hdi/i.test(t.typeEngineName)) score += 3;
        if (vinData.fuel && /gas|petrol/i.test(vinData.fuel) && !/tdci|tdi|cdi|hdi/i.test(t.typeEngineName)) score += 1;
        if (score > bestScore) { bestScore = score; best = t.vehicleId; }
      }
      if (best && bestScore >= 10) break;
    }
    return best ? String(best) : null;
  } catch (e) {
    return null;
  }
}

async function resolveVehicleId(vinData, prisma, vin) {
  if (!vinData) return null;

  if (vinData.vehicleId) return String(vinData.vehicleId);

  try {
    const rows = await prisma.$queryRaw`
      SELECT vehicle_id FROM vehicle_cache
      WHERE LOWER(manufacturer) = LOWER(${vinData.make || ''})
      AND LOWER(model) LIKE ${('%' + (vinData.chassis || vinData.model || '') + '%').toLowerCase()}
      LIMIT 1
    `;
    if (rows && rows.length) return rows[0].vehicle_id;
  } catch(e) {}

  if (vinData.chassis) {
    const modelId = CHASSIS_TO_MODEL[vinData.chassis.toUpperCase()];
    if (modelId) return String(modelId);
  }

  const found = await lookupVehicleIdViaAutodoc(vinData);
  if (found) {
    if (vin && prisma) {
      try { await saveToCache(vin, Object.assign({}, vinData, { vehicleId: found }), prisma); } catch(e) {}
    }
    return found;
  }

  return null;
}

async function prefetchOEMCategories(vehicleId, prisma) {
  if (!vehicleId) return [];
  try {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT category, COUNT(*) as cnt
      FROM vehicle_oem
      WHERE vehicle_id = ${String(vehicleId)}
      GROUP BY category
      ORDER BY cnt DESC
      LIMIT 20
    `;
    return rows.map(r => ({ categoryId: r.category, count: Number(r.cnt) }));
  } catch(e) { return []; }
}

async function saveOEMForVehicle(vehicleId, prisma) {
  if (!vehicleId) return 0;
  try {
    const existing = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM vehicle_oem WHERE vehicle_id = ${String(vehicleId)}`;
    if (existing[0] && Number(existing[0].cnt) > 0) return Number(existing[0].cnt);
  } catch(e) {}

  // Autodoc-დან OEM კოდები ყველა კატეგორიისთვის
  const MAIN_CATEGORIES = [100004,100005,100007,100008,100009,100010,100011,100012,100013,100014,100015,100016,100017,100018,100019,100020,100021,100023,100024,100025,100026,100027,100028,100029,100030,100032,100033,100034,100037,100038,100039,100040,100041,100042,100043,100044];
  let totalSaved = 0;

  for (const catId of MAIN_CATEGORIES) {
    try {
      await sleep(200);
      const data = await safeCall(`${BASE}/api/articles/list/type-id/1/vehicle-id/${vehicleId}/category-id/${catId}/lang-id/4`, 1);
      const articles = (data && data.articles) ? data.articles : (Array.isArray(data) ? data : []);
      if (!articles.length) continue;

      // batch: 50 articleId ერთდროულად OEM კოდებისთვის
      const ids = articles.map(a => a.articleId).filter(Boolean);
      for (let i = 0; i < ids.length; i += 50) {
        await sleep(200);
        const batch = ids.slice(i, i + 50);
        const oemData = await safeCall(`${BASE}/api/articles/get-oems-by-list-of-articles-ids`, 1, 'POST', { articleIds: batch });
        if (!oemData || !oemData.articles) continue;
        for (const art of oemData.articles) {
          if (!art.oemNo) continue;
          for (const oem of art.oemNo) {
            const code = oem.oemDisplayNo;
            if (!code) continue;
            try {
              await prisma.$executeRaw`
                INSERT INTO vehicle_oem (vehicle_id, oem_code, category)
                VALUES (${String(vehicleId)}, ${String(code).toUpperCase().replace(/\s+/g,'')}, ${String(catId)})
                ON CONFLICT DO NOTHING
              `;
              totalSaved++;
            } catch(e) {}
          }
        }
      }
    } catch(e) {}
  }
  return totalSaved;
}

module.exports = { resolveVIN, resolveVehicleId, prefetchOEMCategories, saveOEMForVehicle };
