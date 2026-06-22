const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

const POSITION_MAP = [
  [/წინა სამუხრუჭე ხუნდი/,       'წინა სამუხრუჭე ხუნდი'],
  [/უკანა სამუხრუჭე ხუნდი/,      'უკანა სამუხრუჭე ხუნდი'],
  [/სამუხრუჭე ხუნდი/,             'სამუხრუჭე ხუნდი'],
  [/სამუხრუჭე ფირფიტა/,          'სამუხრუჭე ხუნდი'],
  [/სამუხრუჭე დისკი/,             'სამუხრუჭე დისკი'],
  [/საჰაერო ფილტრი|ჰაერის\s+ფილტრი/, 'ჰაერის ფილტრი'],
  [/სალონის\s+ფილტრი/,            'სალონის ფილტრი'],
  [/ზეთის\s+ფილტრი/,              'ზეთის ფილტრი'],
  [/საწვავის\s+ფილტრი/,           'საწვავის ფილტრი'],
  [/ძრავის ზეთი/,                 'ძრავის ზეთი'],
  [/წყლის ტუმბო/,                 'წყლის ტუმბო'],
  [/საწვავის ტუმბო/,              'საწვავის ტუმბო'],
  [/ამორტიზატორი/,                'ამორტიზატორი'],
  [/სტერჟინი/,                    'სტერჟინი'],
  [/რაზვალი?ს?\s*ტულკა/,         'რაზვალის ტულკა'],
  [/ნაკანეჩნიკი/,                 'ნაკანეჩნიკი'],
  [/ყუმბარის სალნიკი/,            'ყუმბარის სალნიკი'],
  [/ძრავის სალნიკი/,              'ძრავის სალნიკი'],
  [/სალნიკი/,                     'სალნიკი'],
  [/ბაბინა|ბაბინის ჩიბუხი|სანთლის ჩიბუხი/, 'ბაბინა/ჩიბუხი'],
  [/ნათურა/,                      'ნათურა'],
  [/ღვედი/,                       'ღვედი'],
  [/ღვედის კბილანა/,              'ღვედის კბილანა'],
  [/სტუპიცა/,                     'სტუპიცა'],
  [/შარავოი/,                     'შარავოი'],
  [/ჭრიჭინა/,                     'ჭრიჭინა'],
  [/ხიდის ტულკა/,                 'ხიდის ტულკა'],
  [/სიჩქარის კოლოფის ბალიში/,    'სიჩქარის კოლოფის ბალიში'],
  [/სიჩქარის კოლოფის ხუფი/,      'სიჩქარის კოლოფის ხუფი'],
  [/ძრავის ბალიში/,               'ძრავის ბალიში'],
  [/მუხრუჭის ავზი/,               'მუხრუჭის ავზი'],
  [/სტარტერის ნახშირის ბუდე/,    'სტარტერის ნახშირის ბუდე'],
  [/მაყუჩის რეზინა/,              'მაყუჩის რეზინა'],
  [/წინა სუპორტის ჭანჭიკი/,      'სუპორტის ჭანჭიკი'],
  [/ლიმონჩიკი/,                   'ლიმონჩიკი'],
  [/ფერადო/,                      'ფერადო'],
  [/ვიჟიმნოი/,                    'შეერთების დისკი'],
  [/დინამოს რელე/,                'დინამოს რელე'],
  [/კრიშკის შუასადები/,           'კრიშკის შუასადები'],
];

const KNOWN_MAKES = new Set([
  'TOYOTA','HONDA','NISSAN','MAZDA','SUBARU','MITSUBISHI','SUZUKI',
  'BMW','MERCEDES','MB','AUDI','VW','VOLKSWAGEN','SKODA','OPEL',
  'FORD','KIA','HYUNDAI','HUNDAI','LEXUS','INFINITI','JEEP',
  'CHRYSLER','MINI','RENAULT','PEUGEOT','CITROEN','FIAT','VOLVO',
  'SEAT','LADA','UAZ','PORSCHE','ISUZU','ACURA','DAEWOO',
  'CHEVROLET','CADILLAC','DODGE','GMC','LINCOLN','CRAFTER','SPRINTER',
]);

const OEM_TOKEN = /^[A-Z0-9][A-Z0-9\-\.]{2,19}$/i;

function extractOemCodes(prefix) {
  return prefix.trim()
    .split(/\s{2,}|\s+(?=[A-Z]{2,}\s+\d)|(?<=\d)\s+(?=[A-Z]{2,})/)
    .map(c => c.replace(/\s+/g, '').trim())
    .filter(c => OEM_TOKEN.test(c) && c.length >= 3);
}

function extractVehicles(text) {
  if (!text) return [];
  const words = text.replace(/[\r\n:,|]/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
  const vehicles = [];
  let currentMake = null;
  let modelWords = [];

  for (const w of words) {
    const wu = w.toUpperCase();
    if (KNOWN_MAKES.has(wu)) {
      if (currentMake) {
        const model = modelWords.filter(x => !/^\d{2,4}(->|[-]\d*>?)?$/.test(x)).join(' ').trim();
        if (model) vehicles.push({ make: currentMake, model });
      }
      currentMake = wu === 'HUNDAI' ? 'HYUNDAI' : wu === 'MB' ? 'MERCEDES-BENZ' : wu;
      modelWords = [];
    } else if (currentMake) {
      if (!/^\d{2,4}(->|[-]\d*>?)?$/.test(w)) modelWords.push(w);
    }
  }
  if (currentMake) {
    const model = modelWords.filter(x => !/^\d{2,4}(->|[-]\d*>?)?$/.test(x)).join(' ').trim();
    vehicles.push({ make: currentMake, model });
  }
  return vehicles;
}

function normalizeProduct(nameKa) {
  const clean = nameKa.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const georgianStart = clean.search(/[\u10D0-\u10FF]/);
  const prefixLatin = georgianStart > 0 ? clean.slice(0, georgianStart) : '';
  const georgianPart = georgianStart >= 0 ? clean.slice(georgianStart) : clean;

  let position = null, positionEnd = 0;
  for (const [pattern, label] of POSITION_MAP) {
    const m = georgianPart.match(pattern);
    if (m) { position = label; positionEnd = m.index + m[0].length; break; }
  }

  const oemCodes = extractOemCodes(prefixLatin);
  let vehicles = [];
  if (position && positionEnd > 0) {
    vehicles = extractVehicles(georgianPart.slice(positionEnd).trim());
  } else if (!position) {
    vehicles = extractVehicles(georgianPart);
  }

  return {
    position,
    make: vehicles[0]?.make || null,
    model: vehicles[0]?.model || null,
    oemCodesExtracted: oemCodes,
    allVehicles: vehicles,
  };
}

async function main() {
  console.log(`\nProduct Normalization — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);
  const products = await p.product.findMany({
    select: { id: true, nameKa: true, alternativeSearchKeys: true, oemCodes: true },
  });
  console.log(`პროდუქტი სულ: ${products.length}\n`);

  let updated = 0, skipped = 0;
  const sample = [];

  for (const prod of products) {
    const r = normalizeProduct(prod.nameKa);
    if (!r.position && !r.make) { skipped++; continue; }

    const newAltKeys = [...new Set([
      ...(prod.alternativeSearchKeys || []),
      ...r.oemCodesExtracted,
      ...(r.make ? [r.make] : []),
      ...(r.model ? [r.model] : []),
      ...(r.position ? [r.position] : []),
      ...(r.allVehicles.map(v => `${v.make} ${v.model}`.trim())),
    ])];

    const newOemCodes = [...new Set([
      ...(prod.oemCodes || []),
      ...r.oemCodesExtracted,
    ])];

    if (sample.length < 8) {
      sample.push({ name: prod.nameKa.replace(/[\r\n]/g,' ').slice(0, 55), pos: r.position, make: r.make, model: r.model, oem: r.oemCodesExtracted.slice(0,3).join('|') });
    }

    if (!DRY_RUN) {
      await p.product.update({
        where: { id: prod.id },
        data: { alternativeSearchKeys: newAltKeys, oemCodes: newOemCodes },
      });
    }
    updated++;
  }

  console.log(`✅ normalized: ${updated}`);
  console.log(`⬜ skipped:    ${skipped}`);
  console.log(`\nSample:\n`);
  sample.forEach(s => {
    console.log(`"${s.name}"`);
    console.log(`  pos: ${s.pos} | make: ${s.make} | model: ${s.model} | oem: ${s.oem}\n`);
  });

  if (DRY_RUN) console.log('DRY RUN — DB არ შეიცვალა. გასაშვებად: node normalize_products.js');
  else console.log('DB განახლდა!');

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
