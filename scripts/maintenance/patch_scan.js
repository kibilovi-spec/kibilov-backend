const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

const oldScan = `    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: image }
          },
          {
            type: 'text',
            text: 'Analyze this image. If it is a vehicle registration document, extract ALL visible info and return JSON: {"type":"vin","vin":"17CHARVIN","brand":"Make e.g. Ford","model":"Model e.g. Transit","year":"Year e.g. 2010","engine":"Engine e.g. 2.4 TDCi","fuel":"Diesel or Petrol","power":"kW","capacity":"cm3"}. If it is an auto part photo, return JSON: {"type":"part","part_ka":"ქართული სახელი","part_en":"English name","brand":"brand if visible"}. Return ONLY JSON, nothing else.'
          }
        ]
      }]
    });`;

const newScan = `    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: image }
          },
          {
            type: 'text',
            text: \`Analyze this image carefully.

CASE 1 - Vehicle registration/technical passport document:
Extract ALL visible text and return JSON:
{"type":"vin","vin":"17CHARVIN","brand":"Make","model":"Model","year":"2010","engine":"2.4 TDCi","fuel":"Diesel","power":"kW","capacity":"cm3","color":"color if visible"}

CASE 2 - Auto part / spare part photo:
Identify the part type precisely. Return JSON:
{"type":"part","part_ka":"ქართული სახელი","part_en":"English technical name","part_en_alt":"alternative English name","brand":"brand if visible on part","category":"brake/suspension/engine/filter/electrical/body","position":"front/rear/left/right/upper/lower if applicable","search_terms":["term1","term2","term3"]}

Examples:
- Brake pad photo → {"type":"part","part_ka":"სამუხრუჭე ხუნდი","part_en":"brake pad","brand":"TRW","category":"brake","position":"front","search_terms":["brake pad","სამუხრუჭე ხუნდი","კალოტკა"]}
- Shock absorber → {"type":"part","part_ka":"ამორტიზატორი","part_en":"shock absorber","brand":"KYB","category":"suspension","search_terms":["ამორტიზატორი","shock absorber","amort"]}
- Oil filter → {"type":"part","part_ka":"ზეთის ფილტრი","part_en":"oil filter","brand":"Mann","category":"filter","search_terms":["ზეთის ფილტრი","oil filter"]}
- CV joint/ШРУС → {"type":"part","part_ka":"CV joint","part_en":"CV joint","category":"suspension","search_terms":["CV joint","შრუსი","გრანატა","ყუმბარა"]}

CASE 3 - Cannot identify:
{"type":"unknown","message":"Cannot identify the part or document"}

Return ONLY valid JSON, nothing else.\`
          }
        ]
      }]
    });`;

if (c.includes(oldScan)) {
  c = c.replace(oldScan, newScan);
  console.log('✅ scan prompt გაუმჯობესდა');
} else {
  console.log('❌ scan prompt ვერ მოიძებნა');
}

// გავაუმჯობესოთ part search — alternativeSearchKeys + oemCodes
const oldPartSearch = `        const terms = [parsed2.part_ka, parsed2.part_en, parsed2.brand].filter(Boolean);
        const products2 = await prisma2.product.findMany({
          where: { OR: terms.map(t => ({ nameKa: { contains: t, mode: 'insensitive' } })), stock: { gt: 0 } },
          take: 10,
          select: { id: true, nameKa: true, sku: true, price: true, stock: true, images: true, category: { select: { nameKa: true } } }
        });
        await prisma2.$disconnect();
        return res.json({ type: 'part', part: parsed2, products: products2, count: products2.length });`;

const newPartSearch = `        // search terms from AI + synonyms
        const { enrichWithSynonyms } = require('../services/synonyms');
        const allTerms = [parsed2.part_ka, parsed2.part_en, parsed2.part_en_alt, parsed2.brand, ...(parsed2.search_terms||[])].filter(Boolean);
        const enriched = enrichWithSynonyms(allTerms.join(' '), allTerms);
        const uniqueTerms = [...new Set(enriched)].filter(t => t && t.length > 1);

        const whereConditions = uniqueTerms.map(term => ({
          OR: [
            { nameKa: { contains: term, mode: 'insensitive' } },
            { nameEn: { contains: term, mode: 'insensitive' } },
            { alternativeSearchKeys: { hasSome: [term, term.toLowerCase(), term.toUpperCase()] } },
            { oemCodes: { hasSome: [term] } },
          ]
        }));

        const products2 = await prisma2.product.findMany({
          where: { OR: whereConditions, stock: { gt: 0 } },
          take: 20,
          select: { id: true, nameKa: true, nameEn: true, sku: true, price: true, stock: true, images: true, alternativeSearchKeys: true, category: { select: { nameKa: true } } }
        });

        // score by relevance
        const scored2 = products2.map(prod => {
          let score = 0;
          const name = prod.nameKa.toLowerCase();
          const altKeys = (prod.alternativeSearchKeys||[]).map(k=>k.toLowerCase());
          if (parsed2.part_ka && name.includes(parsed2.part_ka.toLowerCase())) score += 20;
          if (parsed2.part_en && name.includes(parsed2.part_en.toLowerCase())) score += 15;
          if (parsed2.brand && name.includes(parsed2.brand.toLowerCase())) score += 10;
          if (parsed2.part_ka && altKeys.some(k=>k===parsed2.part_ka.toLowerCase())) score += 15;
          return { ...prod, _score: score };
        }).sort((a,b) => b._score - a._score).slice(0,10);

        await prisma2.$disconnect();
        return res.json({ type: 'part', part: parsed2, products: scored2, count: scored2.length });`;

if (c.includes(oldPartSearch)) {
  c = c.replace(oldPartSearch, newPartSearch);
  console.log('✅ part search გაუმჯობესდა');
} else {
  console.log('❌ part search ვერ მოიძებნა');
}

fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
console.log('დასრულდა!');
