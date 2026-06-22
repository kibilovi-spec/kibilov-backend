const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MAKE_ALIASES = {
  'vw': 'volkswagen', 'merc': 'mercedes-benz', 'мерс': 'mercedes-benz',
  'мерседес': 'mercedes-benz', 'бмв': 'bmw',
};

const MODEL_ALIASES = {
  'fit': ['jazz', 'fit'],
  'jazz': ['jazz', 'fit'],
  'e90': ['3 series'],
  'e46': ['3 series'],
  'e39': ['5 series'],
  'w204': ['c-class'],
  'w211': ['e-class'],
  'transit': ['transit'],
  'golf 6': ['golf vi'],
  'golf 7': ['golf vii'],
  'pajero io': ['pajero io', 'pajero i/o', 'pajero io 2'],
  'pajero': ['pajero', 'pajero ii', 'pajero iii', 'pajero io'],
  'camry': ['camry', 'camry xv70', 'camry viii'],
  'juke': ['juke'],
  'passat': ['passat', 'passat 2.8', 'bora-caddy-golf-passat'],
  'golf': ['golf', 'bora-caddy-golf-passat'],
};

function normalizeMake(make) {
  if (!make) return null;
  const lower = make.toLowerCase().trim();
  return MAKE_ALIASES[lower] || lower;
}

function getModelVariants(model) {
  if (!model) return [];
  const lower = model.toLowerCase().trim();
  return MODEL_ALIASES[lower] || [lower];
}

async function resolveVehicleProducts(brand, model, year, partKa) {
  if (!brand) return [];

  const makeName = normalizeMake(brand);
  const modelVariants = getModelVariants(model);
  const yearInt = year ? parseInt(year) : null;

  // Step 1: find make
  const makes = await prisma.$queryRawUnsafe(
    `SELECT id, name FROM vehicle_makes WHERE LOWER(name) = $1 OR LOWER(name) LIKE $2 LIMIT 1`,
    makeName.toLowerCase(),
    `%${makeName.toLowerCase()}%`
  ).catch(() => []);

  if (!makes || !makes.length) return [];
  const makeId = makes[0].id;

  // Step 2: find models
  const models = [];
  for (const variant of modelVariants) {
    let sql = `SELECT id, name, "yearFrom", "yearTo" FROM vehicle_models WHERE "makeId" = $1 AND LOWER(name) LIKE $2`;
    const params = [makeId, `%${variant.toLowerCase()}%`];
    if (yearInt) {
      sql += ` AND ("yearFrom" IS NULL OR "yearFrom" <= $3) AND ("yearTo" IS NULL OR "yearTo" >= $3)`;
      params.push(parseInt(yearInt));
    }
    sql += ' LIMIT 10';
    const rows = await prisma.$queryRawUnsafe(sql, ...params).catch(() => []);
    for (const r of rows) {
      if (!models.find(m => m.id === r.id)) models.push(r);
    }
  }

  if (!models.length) return [];

  // Step 3: get products
  const results = [];
  const partPositions = ['წინა', 'უკანა', 'მარჯვენა', 'მარცხენა', 'რულის', 'საჭის'];
  
  for (const vm of models) {
    let partCore = null;
    if (partKa) {
      partCore = partKa.toLowerCase();
      for (const pos of partPositions) {
        partCore = partCore.replace(pos + ' ', '').trim();
      }
    }

    let sql = `
      SELECT DISTINCT p.id, p."nameKa", p."nameEn", p.sku, p.price, p.stock,
             p.images, p.brand, p."oemCodes", p."alternativeSearchKeys",
             p.compatibility, p."articleNumber"
      FROM products p
      JOIN product_vehicles pv ON p.id = pv."productId"
      WHERE pv."vehicleModelId" = $1
      AND p."isActive" = true AND p.stock > 0
    `;
    const params = [vm.id];

    if (partCore) {
      sql += ` AND (LOWER(p."nameKa") LIKE $2 OR LOWER(p."nameEn") LIKE $2)`;
      params.push(`%${partCore}%`);
    }

    sql += ' ORDER BY p.stock DESC LIMIT 30';
    const prods = await prisma.$queryRawUnsafe(sql, ...params).catch(() => []);
    
    for (const p of prods) {
      if (!results.find(r => r.id === p.id)) {
        results.push({ ...p, _graphMatch: true, _matchedModel: vm.name, _score: 100 });
      }
    }
  }

  return results;
}

async function oemGraphSearch(brand, model, year, categoryId) {
  const cacheRows = await prisma.$queryRawUnsafe(
    `SELECT vehicle_id FROM vehicle_cache WHERE LOWER(manufacturer) LIKE $1 AND LOWER(model) LIKE $2 LIMIT 5`,
    `%${(brand||'').toLowerCase()}%`,
    `%${(model||'').toLowerCase()}%`
  ).catch(() => []);

  if (!cacheRows || !cacheRows.length) return [];

  const results = [];
  for (const row of cacheRows) {
    const vid = String(row.vehicle_id);
    let sql = `SELECT DISTINCT oem_code FROM vehicle_oem WHERE vehicle_id = $1`;
    const params = [vid];
    if (categoryId) { sql += ` AND category = $2`; params.push(String(categoryId)); }
    
    const oems = await prisma.$queryRawUnsafe(sql, ...params).catch(() => []);
    const oemCodes = oems.map(o => o.oem_code);
    if (!oemCodes.length) continue;

    const prods = await prisma.product.findMany({
      where: {
        isActive: true, stock: { gt: 0 },
        OR: [
          { oemCodes: { hasSome: oemCodes } },
          { alternativeSearchKeys: { hasSome: oemCodes } },
        ]
      },
      take: 20,
      select: { id: true, nameKa: true, nameEn: true, sku: true, price: true, stock: true, images: true, brand: true, oemCodes: true, alternativeSearchKeys: true, compatibility: true, articleNumber: true }
    }).catch(() => []);

    for (const p of prods) {
      if (!results.find(r => r.id === p.id)) {
        results.push({ ...p, _graphMatch: true, _score: 90 });
      }
    }
  }
  return results;
}

module.exports = { resolveVehicleProducts, oemGraphSearch };
