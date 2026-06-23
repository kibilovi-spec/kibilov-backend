'use strict';
// Learning Loop v1 — behavior-based ranking signal calculator
// Phase 3: data accumulation → weight tuning → self-improving ranking

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cache = require('./cache');

// Behavior weights (tunable)
const WEIGHTS = {
  click:    1,
  cart:     5,
  purchase: 10,
};

// Position bias correction
// Position 1 gets more clicks naturally — normalize by expected CTR
const POSITION_BIAS = [1.0, 0.7, 0.5, 0.4, 0.3, 0.25, 0.2, 0.18, 0.15, 0.12];
function getPositionBias(pos) {
  const idx = Math.min((pos || 1) - 1, POSITION_BIAS.length - 1);
  return POSITION_BIAS[Math.max(0, idx)];
}

// Product behavior score — normalized per impression
async function getProductBehaviorScore(productId) {
  const cacheKey = `behavior:score:${productId}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  try {
    // impressions ამ პროდუქტისთვის
    const impressions = await prisma.$queryRaw`
      SELECT COUNT(*) as cnt, AVG(position) as avg_pos
      FROM search_impressions WHERE product_id = ${productId}
    `;
    const impCount = Number(impressions[0]?.cnt || 0);
    if (impCount < 5) return null; // საკმარისი data არ არის

    // clicks, cart, purchases
    const signals = await prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE clicked_product_id = ${productId}) as clicks,
        COUNT(*) FILTER (WHERE cart_added = true AND clicked_product_id = ${productId}) as cart,
        COUNT(*) FILTER (WHERE purchased = true AND clicked_product_id = ${productId}) as purchases
      FROM search_analytics
    `;

    const clicks = Number(signals[0]?.clicks || 0);
    const cart = Number(signals[0]?.cart || 0);
    const purchases = Number(signals[0]?.purchases || 0);
    const avgPos = Number(impressions[0]?.avg_pos || 1);

    // position bias correction
    const bias = getPositionBias(Math.round(avgPos));

    // raw score
    const rawScore = (clicks * WEIGHTS.click + cart * WEIGHTS.cart + purchases * WEIGHTS.purchase);

    // normalized by impressions + position bias
    const normalizedScore = impCount > 0 ? (rawScore / impCount) / bias : 0;

    const result = {
      productId,
      impressions: impCount,
      clicks, cart, purchases,
      rawScore,
      normalizedScore: Math.round(normalizedScore * 1000) / 1000,
      avgPosition: Math.round(avgPos * 10) / 10,
    };

    await cache.set(cacheKey, result, 3600); // 1h cache
    return result;
  } catch(e) {
    return null;
  }
}

// Top performing products per category
async function getTopProductsByCategory(categoryId, limit = 20) {
  const cacheKey = `behavior:top:${categoryId}:${limit}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  try {
    const rows = await prisma.$queryRaw`
      SELECT
        si.product_id,
        COUNT(DISTINCT si.id) as impressions,
        COUNT(DISTINCT sa.id) FILTER (WHERE sa.clicked_product_id = si.product_id) as clicks,
        ROUND(
          COUNT(DISTINCT sa.id) FILTER (WHERE sa.clicked_product_id = si.product_id)::numeric
          / NULLIF(COUNT(DISTINCT si.id), 0) * 100, 2
        ) as ctr
      FROM search_impressions si
      LEFT JOIN search_analytics sa ON sa.id = si.analytics_id
      JOIN products p ON p.id = si.product_id AND p."autodocCategoryId" = ${Number(categoryId)}
      GROUP BY si.product_id
      HAVING COUNT(DISTINCT si.id) >= 3
      ORDER BY ctr DESC
      LIMIT ${Number(limit)}
    `;
    await cache.set(cacheKey, rows, 1800);
    return rows;
  } catch(e) {
    return [];
  }
}

module.exports = { getProductBehaviorScore, getTopProductsByCategory, WEIGHTS, getPositionBias };
