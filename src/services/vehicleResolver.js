'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// query → generation match DB-დან aliases-ით
async function resolveGeneration(make, model, year) {
  if (!make) return null;
  try {
    const rows = await prisma.$queryRaw`
      SELECT * FROM vehicle_generations
      WHERE LOWER(make) LIKE ${('%' + make.toLowerCase() + '%')}
      AND (${model ? model.toLowerCase() : ''} = '' OR LOWER(model) LIKE ${('%' + (model||'').toLowerCase() + '%')})
      AND (year_from IS NULL OR year_from <= ${parseInt(year)||9999})
      AND (year_to IS NULL OR year_to >= ${parseInt(year)||0})
      LIMIT 1
    `;
    return rows?.[0] || null;
  } catch { return null; }
}

// alias-ით ძებნა — "e90", "golf 6", "w211"
async function resolveByAlias(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  try {
    const rows = await prisma.$queryRaw`
      SELECT * FROM vehicle_generations
      WHERE ${q} = ANY(aliases)
      LIMIT 1
    `;
    return rows?.[0] || null;
  } catch { return null; }
}

// მთავარი ფუნქცია — query-დან vehicle context
async function resolveVehicleContext(query) {
  if (!query) return null;
  const lower = query.toLowerCase();

  // 1. alias-ით ძებნა (e90, golf6, w211...)
  const words = lower.split(/\s+/);
  for (const word of words) {
    const gen = await resolveByAlias(word);
    if (gen) return { ...gen, matchedAlias: word };
  }

  // 2. multi-word alias (bmw e90, golf 6...)
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = words[i] + ' ' + words[i+1];
    const gen = await resolveByAlias(phrase);
    if (gen) return { ...gen, matchedAlias: phrase };
  }

  return null;
}

module.exports = { resolveGeneration, resolveByAlias, resolveVehicleContext };
