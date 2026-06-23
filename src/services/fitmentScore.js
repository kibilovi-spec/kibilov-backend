'use strict';
// Fitment Confidence Score
// პროდუქტი + მანქანის კონტექსტი → 0-100% compatibility

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getFitmentScore(product, vehicleContext) {
  if (!vehicleContext || !product) return null;

  const { make, model, year, vehicleId, generation } = vehicleContext;
  const oemCodes = product.oemCodes || [];
  const sku = product.sku || '';

  let score = 0;
  let reason = '';

  // 1. vehicle_oem-ში OEM კოდი პირდაპირ ემთხვევა — 98%
  if (vehicleId && oemCodes.length > 0) {
    try {
      const match = await prisma.$queryRaw`
        SELECT COUNT(*) as cnt FROM vehicle_oem
        WHERE vehicle_id = ${String(vehicleId)}
        AND oem_code = ANY(${oemCodes})
        LIMIT 1
      `;
      if (Number(match[0]?.cnt) > 0) {
        return { score: 98, label: '✅ ზუსტი დამთხვევა', color: '#16a34a' };
      }
    } catch(e) {}
  }

  // 2. generation DB-ში ემთხვევა — 90%
  if (generation) {
    try {
      const genMatch = await prisma.$queryRaw`
        SELECT id FROM vehicle_generations
        WHERE generation = ${generation}
        AND make ILIKE ${('%' + (make||'') + '%')}
        LIMIT 1
      `;
      if (genMatch.length > 0) {
        score = 90;
        reason = generation + '-თვის სავარაუდო';
      }
    } catch(e) {}
  }

  // 3. make/model match product name-ში — 75%
  if (!score && make) {
    const nameLower = (product.nameKa || product.nameEn || '').toLowerCase();
    const makeLower = make.toLowerCase();
    if (nameLower.includes(makeLower) || (model && nameLower.includes(model.toLowerCase()))) {
      score = 75;
      reason = make + (model ? ' ' + model : '') + '-სთვის';
    }
  }

  // 4. category match — 60%
  if (!score && product.autodocCategoryId) {
    score = 60;
    reason = 'კატეგორიის მიხედვით';
  }

  if (!score) return null;

  const label = score >= 90 ? '✅ ' + reason :
                score >= 75 ? '🟡 ' + reason :
                '⚪ ' + reason;
  const color = score >= 90 ? '#16a34a' : score >= 75 ? '#d97706' : '#6b7280';

  return { score, label, color };
}

module.exports = { getFitmentScore };
