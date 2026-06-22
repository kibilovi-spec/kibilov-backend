const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cache = require('./cache');

// BFS — OEM Graph traversal
async function getOEMChain(startOEM, maxDepth = 3) {
  const cacheKey = `oem:chain:${startOEM}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const visited = new Set();
  const queue = [{ code: startOEM, depth: 0 }];
  const result = [];

  while (queue.length > 0) {
    const { code, depth } = queue.shift();
    if (visited.has(code) || depth > maxDepth) continue;
    visited.add(code);
    result.push(code);

    // გვერდითი კავშირები
    const edges = await prisma.$queryRaw`
      SELECT oem_to, brand_to FROM oem_edges WHERE oem_from = ${code}
      UNION
      SELECT oem_from, null FROM oem_edges WHERE oem_to = ${code}
    `;
    for (const e of edges) {
      const next = e.oem_to || e.oem_from;
      if (!visited.has(next)) queue.push({ code: next, depth: depth + 1 });
    }
  }

  await cache.set(cacheKey, result, 86400); // 24h cache
  return result;
}

// Vehicle → Compatible OEM codes
async function getVehicleOEMs(vehicleId, categoryId = null) {
  const cacheKey = `vehicle:compat:${vehicleId}:${categoryId||'all'}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const rows = categoryId
    ? await prisma.$queryRaw`SELECT oem_code FROM vehicle_part_map WHERE vehicle_id = ${String(vehicleId)} AND part_category_id = ${Number(categoryId)} LIMIT 200`
    : await prisma.$queryRaw`SELECT oem_code FROM vehicle_part_map WHERE vehicle_id = ${String(vehicleId)} LIMIT 200`;
  const codes = rows.map(r => r.oem_code);

  await cache.set(cacheKey, codes, 3600); // 1h cache
  return codes;
}

// OEM → Products (graph-based)
async function getProductsByOEMGraph(oemCode) {
  // 1. OEM chain-ი BFS-ით
  const chain = await getOEMChain(oemCode);
  
  // 2. product_oem_link-დან
  const links = await prisma.$queryRaw`
    SELECT DISTINCT product_id FROM product_oem_link
    WHERE oem_code = ANY(${chain})
  `;
  const productIds = links.map(l => l.product_id);

  if (!productIds.length) return [];

  // 3. products-დან
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true, stock: { gt: 0 } },
    take: 20
  });

  return products;
}

// Full Graph Search Pipeline
async function graphSearch(vehicleId, categoryId, partQuery) {
  console.log(`[graph] vehicle:${vehicleId} cat:${categoryId} query:${partQuery}`);

  // 1. Vehicle-ის OEM კოდები
  const vehicleOEMs = await getVehicleOEMs(vehicleId, categoryId);
  console.log(`[graph] vehicle OEMs: ${vehicleOEMs.length}`);

  if (!vehicleOEMs.length) return [];

  // 2. ყოველ OEM-ზე graph traversal
  const allProductIds = new Set();
  for (const oem of vehicleOEMs.slice(0, 20)) {
    const chain = await getOEMChain(oem);
    const links = await prisma.$queryRaw`
      SELECT product_id FROM product_oem_link WHERE oem_code = ANY(${chain})
    `;
    links.forEach(l => allProductIds.add(l.product_id));
  }

  console.log(`[graph] found products: ${allProductIds.size}`);

  if (!allProductIds.size) return [];

  // 3. Products fetch
  const products = await prisma.product.findMany({
    where: {
      id: { in: Array.from(allProductIds) },
      isActive: true,
      stock: { gt: 0 }
    },
    take: 20
  });

  return products;
}

module.exports = { getOEMChain, getVehicleOEMs, getProductsByOEMGraph, graphSearch };
