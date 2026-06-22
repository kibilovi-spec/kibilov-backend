const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

// Fix 1: brake pad → search_terms-ში ქართული სინონიმები
// AI prompt-ში უკვე გვაქვს, მაგრამ search_terms ცარიელია
// Fix: თუ part_en არის, synonyms-ში გავატაროთ

const oldEnrich = `    const enriched = enrichWithSynonyms(searchTerms.join(' '));
    enriched.forEach(t => { if (!searchTerms.includes(t)) searchTerms.push(t); });`;

const newEnrich = `    const enriched = enrichWithSynonyms(searchTerms.join(' '));
    enriched.forEach(t => { if (!searchTerms.includes(t)) searchTerms.push(t); });
    // brake pad, колодка → ქართული
    const engToKa = {
      'brake pad': ['სამუხრუჭე ხუნდი','კალოტკა','კალოდკა'],
      'brake disc': ['სამუხრუჭე დისკი','დისკო'],
      'shock absorber': ['ამორტიზატორი','ამორტი'],
      'control arm': ['control arm','გიტარა','ბერკეტი'],
      'cv joint': ['CV joint','შრუსი','გრანატა','ყუმბარა'],
      'bushing': ['bushing','ბუქსა','ვტულკა'],
      'tie rod': ['tie rod','ტიაგა','ნაკანეჩნიკი'],
      'ball joint': ['ball joint','შარავო','სახსარი'],
      'water pump': ['წყლის ტუმბო','პომპა'],
      'timing belt': ['ღვედი','მატოს რემენი'],
      'oil filter': ['ზეთის ფილტრი'],
      'air filter': ['ჰაერის ფილტრი'],
      'колодка': ['სამუხრუჭე ხუნდი','კალოტკა','brake pad'],
      'тормозная': ['სამუხრუჭე ხუნდი','brake pad'],
      'амортизатор': ['ამორტიზატორი','shock absorber'],
      'шаровая': ['ball joint','შარავო'],
      'сальник': ['სალნიკი','oil seal'],
    };
    const msgLow = message.toLowerCase();
    for (const [eng, ka] of Object.entries(engToKa)) {
      if (msgLow.includes(eng)) ka.forEach(t => { if (!searchTerms.includes(t)) searchTerms.push(t); });
    }`;

if (c.includes(oldEnrich)) {
  c = c.replace(oldEnrich, newEnrich);
  console.log('✅ eng/rus → ka translation დამატდა');
} else {
  console.log('❌ enrich ვერ მოიძებნა');
}

// Fix 2: OEM კოდის ძებნა — alphanumeric pattern
const oldVin = `    const vinMatch = message && message.trim().match(/\\b([A-HJ-NPR-Z0-9]{17})\\b/i);`;
const newVin = `    const vinMatch = message && message.trim().match(/\\b([A-HJ-NPR-Z0-9]{17})\\b/i);
    // OEM code detection — 6-15 char alphanumeric
    const oemMatch = message && !vinMatch && message.trim().match(/^([A-Z0-9][A-Z0-9\\s\\-\\.]{4,20})$/i);
    if (oemMatch) {
      const oemCode = oemMatch[1].replace(/\\s+/g,'').trim();
      const { PrismaClient } = require('@prisma/client');
      const prismaOem = new PrismaClient();
      const oemProducts = await prismaOem.product.findMany({
        where: {
          OR: [
            { nameKa: { contains: oemCode, mode: 'insensitive' } },
            { oemCodes: { hasSome: [oemCode, oemCode.toUpperCase()] } },
            { alternativeSearchKeys: { hasSome: [oemCode, oemCode.toUpperCase()] } },
          ],
          stock: { gt: 0 }
        },
        take: 10,
        select: { id: true, nameKa: true, nameEn: true, sku: true, price: true, stock: true, images: true, oemCodes: true, category: { select: { nameKa: true } } }
      });
      await prismaOem.$disconnect();
      if (oemProducts.length > 0) {
        return res.json({ type: 'oem_search', parsed: { brand: null, model: null, part_ka: oemCode, part_en: oemCode, search_terms: [oemCode] }, products: oemProducts, count: oemProducts.length });
      }
    }`;

if (c.includes(oldVin)) {
  c = c.replace(oldVin, newVin);
  console.log('✅ OEM code search დამატდა');
} else {
  console.log('❌ vinMatch ვერ მოიძებნა');
}

fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
