// Search Self-Healing Engine
// 0 results → auto recovery pipeline

const SYNONYM_EXPAND = {
  // Brake
  'brake pads': ['brake pad', 'კალოტკა', 'კოლოდკა', 'kolodka'],
  'კალოტკა': ['brake pad', 'brake pads', 'კოლოდკა', 'ხუნდი'],
  // Suspension  
  'shock absorber': ['ამორტიზატორი', 'სტოიკა', 'амортизатор'],
  'ამორტიზატორი': ['shock absorber', 'სტოიკა', 'damper'],
  // CV Joint
  'cv joint': ['გრანატა', 'შრუსი', 'граната', 'шрус'],
  'გრანატა': ['cv joint', 'შრუსი', 'constant velocity'],
  // Steering
  'steering rack': ['რეიკა', 'рулевая рейка', 'rack'],
  // Oil
  'oil filter': ['ზეთის ფილტრი', 'масляный фильтр'],
  // Timing
  'timing belt': ['ღვედი', 'ремень грм', 'belt'],
};

const CATEGORY_FALLBACK = {
  100030: [100032, 100027, 100025], // brake pads → disc, caliper, booster
  100121: [100126, 100575, 100576], // shock → spring, stabilizer, silent block
  100226: [100229, 100230],         // cv joint → drive shaft, universal joint
  100012: [100190, 100197],         // steering → rack, tie rod
  100259: [100260, 100261, 100267], // oil filter → air, fuel, cabin
};

async function selfHeal(originalQuery, vehicleId, categoryId, prisma) {
  console.log(`[self-heal] triggered for: "${originalQuery}" cat:${categoryId}`);
  
  const results = [];

  // 1. Synonym expansion
  const synonyms = SYNONYM_EXPAND[originalQuery.toLowerCase()] || [];
  if (synonyms.length > 0) {
    console.log(`[self-heal] trying synonyms: ${synonyms.slice(0,3).join(', ')}`);
    for (const syn of synonyms) {
      const found = await searchByKeyword(syn, prisma);
      results.push(...found);
      if (results.length >= 5) break;
    }
  }

  // 2. Category fallback
  if (results.length === 0 && CATEGORY_FALLBACK[categoryId]) {
    const fallbackCats = CATEGORY_FALLBACK[categoryId];
    console.log(`[self-heal] trying category fallback: ${fallbackCats}`);
    for (const cat of fallbackCats) {
      const found = await prisma.$queryRaw`
        SELECT p.* FROM products p
        WHERE p."categoryId" = ${cat} AND p."isActive" = true AND p.stock > 0
        LIMIT 5
      `;
      results.push(...found);
      if (results.length >= 5) break;
    }
  }

  // 3. Brand search fallback
  if (results.length === 0) {
    console.log('[self-heal] trying brand/text search');
    const found = await searchByKeyword(originalQuery, prisma);
    results.push(...found);
  }

  // 4. Popular products in same category
  if (results.length === 0 && categoryId) {
    console.log('[self-heal] trying popular in category');
    const found = await prisma.$queryRaw`
      SELECT * FROM products 
      WHERE "categoryId" = ${categoryId} AND "isActive" = true AND stock > 0
      ORDER BY stock DESC LIMIT 5
    `;
    results.push(...found);
  }

  // deduplicate
  const seen = new Set();
  return results.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  }).slice(0, 10);
}

async function searchByKeyword(keyword, prisma) {
  try {
    return await prisma.$queryRaw`
      SELECT * FROM products
      WHERE "isActive" = true AND stock > 0
      AND (
        "nameKa" ILIKE ${'%'+keyword+'%'}
        OR "alternativeSearchKeys" && ARRAY[${keyword}]::text[]
        OR "oemCodes" && ARRAY[${keyword.toUpperCase()}]::text[]
      )
      LIMIT 5
    `;
  } catch(e) { return []; }
}

module.exports = { selfHeal };
