const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const KNOWN_MAKES = new Set([
  'TOYOTA','HONDA','NISSAN','MAZDA','SUBARU','MITSUBISHI','SUZUKI',
  'BMW','MERCEDES-BENZ','AUDI','VW','VOLKSWAGEN','SKODA','OPEL',
  'FORD','KIA','HYUNDAI','LEXUS','INFINITI','JEEP','CHRYSLER',
  'MINI','RENAULT','PEUGEOT','CITROEN','FIAT','VOLVO','SEAT',
  'LADA','UAZ','PORSCHE','ISUZU','DAEWOO','CHEVROLET',
]);

// year range extraction from model string
function extractYears(model) {
  const m = model.match(/(\d{4})\s*[-–>]+\s*(\d{4})?/);
  if (m) {
    return { yearFrom: parseInt(m[1]), yearTo: m[2] ? parseInt(m[2]) : null };
  }
  // short year: "98-02" → 1998-2002
  const s = model.match(/(\d{2})\s*[-–>]+\s*(\d{2})/);
  if (s) {
    const from = parseInt(s[1]) > 50 ? 1900 + parseInt(s[1]) : 2000 + parseInt(s[1]);
    const to = parseInt(s[2]) > 50 ? 1900 + parseInt(s[2]) : 2000 + parseInt(s[2]);
    return { yearFrom: from, yearTo: to };
  }
  return { yearFrom: null, yearTo: null };
}

// clean model name — strip years and junk
function cleanModel(model) {
  return model
    .replace(/\d{4}\s*[-–>]+\s*\d{4}/g, '')
    .replace(/\d{4}\s*[-–>]+/g, '')
    .replace(/\d{2}\s*[-–>]+\s*\d{2}/g, '')
    .replace(/[|(),]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function main() {
  console.log('VehicleMake/Model ცხრილების შევსება...\n');

  const prods = await p.product.findMany({ select: { alternativeSearchKeys: true } });

  // Collect all make→models
  const vehicles = {};
  prods.forEach(prod => {
    (prod.alternativeSearchKeys || []).forEach(k => {
      const parts = k.split(' ');
      const make = parts[0]?.toUpperCase();
      const model = parts.slice(1).join(' ').trim();
      if (KNOWN_MAKES.has(make) && model && model.length > 1) {
        if (!vehicles[make]) vehicles[make] = new Set();
        vehicles[make].add(model);
      }
    });
  });

  let makeCount = 0, modelCount = 0;

  for (const [makeName, models] of Object.entries(vehicles)) {
    // Upsert make
    const make = await p.vehicleMake.upsert({
      where: { name: makeName },
      update: {},
      create: { name: makeName },
    });
    makeCount++;

    for (const rawModel of models) {
      const cleaned = cleanModel(rawModel);
      if (!cleaned || cleaned.length < 2) continue;
      const { yearFrom, yearTo } = extractYears(rawModel);

      try {
        await p.vehicleModel.upsert({
          where: { makeId_name: { makeId: make.id, name: cleaned } },
          update: { yearFrom: yearFrom || undefined, yearTo: yearTo || undefined },
          create: { makeId: make.id, name: cleaned, yearFrom, yearTo },
        });
        modelCount++;
      } catch(e) {
        // duplicate or invalid — skip
      }
    }
  }

  console.log(`✅ makes: ${makeCount}`);
  console.log(`✅ models: ${modelCount}`);
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
