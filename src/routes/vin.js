'use strict';
const express = require('express');
const router  = express.Router();

// VIN Confidence Score
function calcConfidence(vehicle) {
  let score = 0;
  if (vehicle.make)   score += 30;
  if (vehicle.model)  score += 30;
  if (vehicle.year)   score += 20;
  if (vehicle.engine) score += 10;
  return score;
}


// ── VIN Decode ────────────────────────────────────────────────────────────
router.get('/decode', async (req, res) => {
  try {
    const { vin } = req.query;

    if (!vin || vin.length !== 17) {
      return res.status(400).json({ error: 'VIN 17 სიმბოლო უნდა იყოს', showManual: true });
    }
    if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
      return res.status(200).json({ error: 'VIN-ში I, O, Q არ შეიძლება იყოს. შეამოწმე და ხელახლა შეიყვანე.', showManual: true, invalidFormat: true });
    }

    // Autodoc VIN Decoder
    const vinResolver = require('../services/vinResolver');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const resolved = await vinResolver.resolveVIN(vin, prisma);
    let vehicleId = null;
    if (resolved) {
      vehicleId = await vinResolver.resolveVehicleId(resolved, prisma).catch(() => null);
    }
    await prisma.$disconnect();
    if (!resolved || !resolved.make) throw new Error('VIN ვერ მოიძებნა');
    const vehicle = {
      make: resolved.make,
      model: resolved.model || null,
      year: resolved.year || null,
      engine: resolved.engine || null,
      fuel: resolved.fuel || null,
      chassis: resolved.chassis || null,
    };
    // Autodoc vehicle details — წელი და ძრავი გასაუმჯობესებლად
    if (vehicleId && process.env.RAPIDAPI_KEY && (!vehicle.year || !vehicle.engine || (vehicle.engine && vehicle.engine.length < 5))) {
      try {
        const detRes = await fetch(`https://autodoc-parts-catalog.p.rapidapi.com/api/types/type-id/1/vehicle-type-details/${vehicleId}/lang-id/4/country-filter-id/63`, {
          headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY, 'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com' }
        });
        const det = await detRes.json();
        const d = det.vehicleTypeDetails;
        if (d) {
          if (!vehicle.year && d.constructionIntervalStart) {
            vehicle.year = parseInt(d.constructionIntervalStart.substring(0, 4));
          }
          const eng = [d.capacityLt ? parseFloat(d.capacityLt).toFixed(1) + 'L' : null, d.engCodes || null, d.powerKw ? Math.round(d.powerKw) + 'kW' : null].filter(Boolean).join(' ');
          if (eng) vehicle.engine = eng;
          if (!vehicle.fuel) vehicle.fuel = d.fuelType || null;
          if (!vehicle.chassis) vehicle.chassis = d.bodyType || null;
        }
      } catch(e) {}
    }
    const carImage = null;
    const confidence = calcConfidence(vehicle);

    // Confidence label
    let confidenceLabel, confidenceColor;
    if (confidence >= 90) {
      confidenceLabel = '✅ match დადასტურებულია';
      confidenceColor = 'green';
    } else if (confidence >= 70) {
      confidenceLabel = '⚠️ წელი გადაამოწმეთ';
      confidenceColor = 'yellow';
    } else {
      confidenceLabel = '❌ VIN ხელით შეიყვანეთ';
      confidenceColor = 'red';
    }

    // engine details
    let engineDetails = null;
    if (resolved.engId && process.env.RAPIDAPI_KEY) {
      try {
        const eRes = await fetch(`https://autodoc-parts-catalog.p.rapidapi.com/api/engines/engine-details/engine-id/${resolved.engId}/lang-id/4`, {
          headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY, 'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com' }
        });
        const eData = await eRes.json();
        if (eData.engId) engineDetails = {
          powerKw: eData.engPowerKwStart ? Math.round(eData.engPowerKwStart) : null,
          powerPs: eData.engPowerPsStart ? Math.round(eData.engPowerPsStart) : null,
          torqueNm: eData.engTorqueNmStart ? Math.round(eData.engTorqueNmStart) : null,
          cylinders: eData.engNumberOfCylinders || null,
          valves: eData.engNumberOfValves || null,
          displacement: eData.engCapacityCcmStart ? Math.round(eData.engCapacityCcmStart) : null,
          fuelMixture: eData.fuelMixture || null,
          chargeType: eData.chargeType || null,
          construction: eData.engineConstruction || null,
          codes: eData.engineCodes || null,
        };
      } catch(e) {}
    }
    res.json({ vehicle, confidence, confidenceLabel, confidenceColor, vehicleId, carImage, source: resolved.source, engineDetails });

  } catch (e) {
    // VIN ვერ მოიძებნა — 200 status რომ frontend-ი error-ად არ ცნოს, manual form ჩაირთოს
    res.status(200).json({
      vehicle: null,
      error: 'ვერ ვცანი ეს VIN. ხელით შეიყვანეთ მანქანის მონაცემები ან შეამოწმეთ VIN.',
      showManual: true,
      notFound: true,
    });
  }
});


// POST /api/vin/prefetch-oem — background OEM fetch
router.post('/prefetch-oem', async (req, res) => {
  const { vehicleId } = req.body;
  if (!vehicleId) return res.json({ ok: false });
  res.json({ ok: true, started: true });
  // background
  setImmediate(async () => {
    try {
      const { PrismaClient: PrismaOEM } = require('@prisma/client');
      const { saveOEMForVehicle } = require('../services/vinResolver');
      const prismaOEM = new PrismaOEM();
      const cnt = await saveOEMForVehicle(vehicleId, prismaOEM);
      console.log('OEM prefetch done for vehicle', vehicleId, ':', cnt, 'codes');
      await prismaOEM.$disconnect();
    } catch(e) { console.error('OEM prefetch error:', e.message); }
  });
});

module.exports = router;

// POST /api/vin/batch — B2B: 20 VIN ერთდროულად
router.post('/batch', async (req, res) => {
  try {
    const { vins } = req.body;
    if (!Array.isArray(vins) || vins.length === 0) {
      return res.status(400).json({ error: 'VIN სია ცარიელია' });
    }
    if (vins.length > 20) {
      return res.status(400).json({ error: 'მაქსიმუმ 20 VIN' });
    }

    const results = await Promise.allSettled(
      vins.map(async (vin) => {
        vin = vin.trim().toUpperCase();
        if (vin.length !== 17) return { vin, error: 'VIN 17 სიმბოლო უნდა იყოს' };
        try {
          const vinResolver = require('../services/vinResolver');
          const { PrismaClient } = require('@prisma/client');
          const prisma = new PrismaClient();
          const resolved = await vinResolver.resolveVIN(vin, prisma);
          if (!resolved || !resolved.make) { await prisma.$disconnect(); return { vin, error: 'VIN ვერ მოიძებნა' }; }
          const vehicleId = await vinResolver.resolveVehicleId(resolved, prisma, vin);
          await prisma.$disconnect();
          const vehicle = {
            make: resolved.make, model: resolved.model || null,
            year: resolved.year || null, engine: resolved.engine || null,
          };
          let score = 0;
          if (vehicle.make)   score += 30;
          if (vehicle.model)  score += 30;
          if (vehicle.year)   score += 20;
          if (vehicle.engine) score += 10;
          score += 10;
          return { vin, vehicle, vehicleId, confidence: score };
        } catch {
          return { vin, error: 'lookup მიუწვდომელია' };
        }
      })
    );

    const decoded = results.map(r =>
      r.status === 'fulfilled' ? r.value : { vin: '', error: 'შეცდომა' }
    );

    res.json({ decoded, total: decoded.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/vin/ocr — ფოტოდან VIN წაკითხვა
router.post('/ocr', async (req, res) => {
  try {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        if (!buffer.length) return res.status(400).json({ error: 'ფაილი ცარიელია' });
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY არ არის' });
        let mediaType = 'image/jpeg';
        if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50) mediaType = 'image/png';
        else if (buffer.length >= 3 && buffer[0] === 0x47 && buffer[1] === 0x49) mediaType = 'image/gif';
        else if (buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP') mediaType = 'image/webp';
        const base64 = buffer.toString('base64');
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey });
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: 'Extract the 17-character VIN code from this image. VIN contains only A-Z (no I,O,Q) and 0-9. Look on dashboard, door jamb, registration document, or anywhere VIN is visible. Return ONLY the 17-character VIN, nothing else. If no VIN is visible, return exactly: NOT_FOUND' }
            ]
          }]
        });
        const rawText = (response.content[0].text || '').trim().toUpperCase();
        const cleaned = rawText.replace(/[^A-HJ-NPR-Z0-9]/g, '');
        const vinMatch = cleaned.match(/[A-HJ-NPR-Z0-9]{17}/);
        if (!vinMatch || rawText.includes('NOT_FOUND')) {
          return res.json({ vin: null, raw: rawText, message: 'VIN ვერ მოიძებნა სურათში — სცადე უკეთესი განათებით ან ხელით შეიყვანე' });
        }
        res.json({ vin: vinMatch[0], raw: rawText });
      } catch (e) {
        console.error('OCR error:', e.message);
        res.status(500).json({ error: 'სურათის დამუშავება ვერ მოხერხდა: ' + e.message });
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});