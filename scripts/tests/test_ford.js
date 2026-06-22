'use strict';
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const https = require('https');

const API_KEY = '98fcf77b13msh4c667e538cb11e8p15f12djsn70f2d789b288';
const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'GET', hostname: HOST, path,
      headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': HOST }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const make = { id: 'afc3c7a3-d752-4e3b-87e2-4b96ba9527c9', name: 'FORD' };
  
  // Get FORD models - need autodoc manufacturer id
  // First check what autodoc id FORD has
  const data = await apiGet('/api/manufacturers/list/type-id/1');
  const mfrs = data.manufacturers || data || [];
  const ford = mfrs.find(m => (m.manufacturerName||m.name||'').toUpperCase() === 'FORD');
  console.log('FORD autodoc:', ford);
  
  await prisma.$disconnect();
}
main().catch(console.error);
