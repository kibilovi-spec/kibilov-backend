'use strict';
const axios   = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { enrichWithSynonyms } = require('./synonyms');

function normalizeKey(input) {
  return input.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
}

const BASE_URL = process.env.FINA_API_URL; // http://IP:PORT
const LOGIN    = process.env.FINA_LOGIN;
const PASSWORD = process.env.FINA_PASSWORD;

let cachedToken = null;
let tokenExpiry  = null;

async function getToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) return cachedToken;
  const res = await axios.post(`${BASE_URL}/api/authentication/authenticate`, {
    login: LOGIN, password: PASSWORD
  });
  if (res.data.ex) throw new Error(res.data.ex);
  cachedToken = res.data.token;
  tokenExpiry  = Date.now() + 35 * 60 * 1000; // 35 წუთი
  return cachedToken;
}

function finaHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function mapFinaProduct(item, prices, stocks) {
  const price = prices?.[item.id]?.sell_price || 0;
  const stock = stocks?.[item.id]?.quantity || 0;
  return {
    finaId:        item.id?.toString(),
    sku:           item.code || `FINA-${item.id}`,
    nameKa:        item.name || 'უცნობი',
    nameEn:        item.name_eng || item.name || '',
    nameRu:        item.name_rus || item.name || '',
    brand:         item.partnumber ? item.partnumber.split('-')[0] : 'Generic',
    articleNumber: item.partnumber || item.code || '',
    price:         parseFloat(price),
    priceOld:      null,
    discount:      0,
    stock:         parseInt(stock),
    unit:          'ც',
    images:        [],
    imagePublicIds:[],
    rating:        0,
    reviewCount:   0,
    isActive:      true,
  };
}

function parseOemCodesFromName(text) {
  const oems = [];
  const matches = text.match(/\b([A-Z0-9]{2,}[-\s][A-Z0-9]{2,}(?:[-\s][A-Z0-9]{2,})*|[A-Z]{1,3}\s?\d{4,}[A-Z]?|\d{4,}-\d{4,})\b/g);
  if (matches) matches.forEach(m => { const c = m.trim(); if (c.length >= 6 && c.length <= 20) oems.push(c); });
  return [...new Set(oems)];
}

async function syncFromFina() {
  const startTime = Date.now();
  let itemsAdded = 0, itemsUpdated = 0;

  try {
    const token = await getToken();
    const headers = finaHeaders(token);

    // პროდუქტები
    const prodRes = await axios.get(`${BASE_URL}/api/operation/getProducts`, { headers });
    const products = prodRes.data.products || [];

    // ფასები
    const priceRes = await axios.get(`${BASE_URL}/api/operation/getProductPrices`, { headers });
    const priceMap = {};
    (priceRes.data.prices || []).forEach(p => { priceMap[p.product_id] = p; });

    // სტოკი
    const stockRes = await axios.get(`${BASE_URL}/api/operation/getProductsRestSummary`, { headers });
    const stockMap = {};
    (stockRes.data.products || []).forEach(s => { stockMap[s.id] = s; });

    for (const item of products) {
      const productData = mapFinaProduct(item, priceMap, stockMap);
      if (!productData.price) continue; // ფასი 0-ია - გამოვტოვოთ

      const exists = await prisma.product.findUnique({ where: { finaId: productData.finaId } });
      if (exists) {
        await prisma.product.update({
          where: { finaId: productData.finaId },
          data: { stock: productData.stock, price: productData.price, nameKa: productData.nameKa, normalizedSku: normalizeKey(productData.sku), alternativeSearchKeys: enrichWithSynonyms(productData.nameKa, []), oemCodes: parseOemCodesFromName(productData.nameKa) }
        });
        itemsUpdated++;
      } else {
        // კატეგორია
        let categoryId = null;
        if (item.web_group_id) {
          const cat = await prisma.category.findFirst({ where: { OR: [
            { slug: item.web_group_id.toString() },
          ]}});
          categoryId = cat?.id || null;
        }
        await prisma.product.create({ data: { ...productData, categoryId, normalizedSku: normalizeKey(productData.sku), alternativeSearchKeys: enrichWithSynonyms(productData.nameKa, []), oemCodes: parseOemCodesFromName(productData.nameKa) } });
        itemsAdded++;
      }
    }

    const duration = Date.now() - startTime;
    await prisma.finaSyncLog.create({ data: { status: 'success', itemsAdded, itemsUpdated, itemsSynced: itemsAdded + itemsUpdated, duration } });
    console.log(`[FINA] Sync: +${itemsAdded} new, ~${itemsUpdated} updated (${duration}ms)`);
    return { synced: itemsAdded + itemsUpdated, added: itemsAdded, updated: itemsUpdated };
  } catch (error) {
    console.error('[FINA] Sync failed:', error.message);
    await prisma.finaSyncLog.create({ data: { status: 'error', message: error.message, itemsAdded, itemsUpdated, itemsSynced: 0 } });
    throw error;
  }
}

module.exports = { syncFromFina };
