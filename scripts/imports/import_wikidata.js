/**
 * Wikidata-დან ავტომობილების მოდელების იმპორტი
 * SPARQL query — უფასო, ლიმიტი არ არის
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const SPARQL_URL = 'https://query.wikidata.org/sparql';

// საქართველოს ბაზარში პოპულარული მანქანების Wikidata IDs
const MAKE_QUERIES = [
  { make: 'TOYOTA',       wd: 'Q46970' },
  { make: 'HONDA',        wd: 'Q9584' },
  { make: 'NISSAN',       wd: 'Q10189' },
  { make: 'MAZDA',        wd: 'Q29017' },
  { make: 'SUBARU',       wd: 'Q81965' },
  { make: 'MITSUBISHI',   wd: 'Q36033' },
  { make: 'BMW',          wd: 'Q26678' },
  { make: 'MERCEDES-BENZ',wd: 'Q36008' },
  { make: 'VW',           wd: 'Q246' },
  { make: 'AUDI',         wd: 'Q23317' },
  { make: 'OPEL',         wd: 'Q40966' },
  { make: 'FORD',         wd: 'Q44294' },
  { make: 'HYUNDAI',      wd: 'Q26746' },
  { make: 'KIA',          wd: 'Q34090' },
  { make: 'SKODA',        wd: 'Q29242' },
  { make: 'LEXUS',        wd: 'Q35919' },
  { make: 'INFINITI',     wd: 'Q696985' },
  { make: 'JEEP',         wd: 'Q35551' },
  { make: 'CHEVROLET',    wd: 'Q34602' },
  { make: 'RENAULT',      wd: 'Q55' },
  { make: 'PEUGEOT',      wd: 'Q6746' },
  { make: 'CITROEN',      wd: 'Q6746' },
  { make: 'VOLVO',        wd: 'Q215293' },
  { make: 'PORSCHE',      wd: 'Q40993' },
];

async function fetchModelsFromWikidata(makeWd, makeName) {
  const query = `
SELECT DISTINCT ?modelLabel ?inception ?discontinued WHERE {
  ?model wdt:P31 wd:Q3231690 .
  ?model wdt:P176 wd:${makeWd} .
  OPTIONAL { ?model wdt:P571 ?inception . }
  OPTIONAL { ?model wdt:P2669 ?discontinued . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 100`;

  const url = SPARQL_URL + '?query=' + encodeURIComponent(query) + '&format=json';
  
  try {
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'kibilov.ge/1.0 (autoparts)' }
    });
    const data = await r.json();
    const results = data.results?.bindings || [];
    
    return results.map(row => ({
      name: row.modelLabel?.value,
      yearFrom: row.inception?.value ? parseInt(row.inception.value.slice(0,4)) : null,
      yearTo: row.discontinued?.value ? parseInt(row.discontinued.value.slice(0,4)) : null,
    })).filter(m => m.name && !m.name.startsWith('Q') && m.name.length > 1);
  } catch(e) {
    console.log(`  ❌ Wikidata error: ${e.message}`);
    return [];
  }
}

async function main() {
  console.log('Wikidata-დან მანქანების იმპორტი...\n');
  
  let totalNew = 0;

  for (const car of MAKE_QUERIES) {
    process.stdout.write(`${car.make}... `);
    
    const make = await p.vehicleMake.upsert({
      where: { name: car.make },
      update: {},
      create: { name: car.make }
    });

    const models = await fetchModelsFromWikidata(car.wd, car.make);
    process.stdout.write(`${models.length} models found... `);

    let added = 0;
    for (const m of models) {
      try {
        await p.vehicleModel.upsert({
          where: { makeId_name: { makeId: make.id, name: m.name } },
          update: { yearFrom: m.yearFrom || undefined, yearTo: m.yearTo || undefined },
          create: { makeId: make.id, name: m.name, yearFrom: m.yearFrom, yearTo: m.yearTo }
        });
        added++;
      } catch(e) {}
    }
    
    console.log(`${added} added`);
    totalNew += added;
    
    // rate limit — Wikidata-ს უყვარს
    await new Promise(r => setTimeout(r, 1000));
  }

  const total = await p.vehicleModel.count();
  console.log(`\n✅ new/updated: ${totalNew}`);
  console.log(`📊 DB total models: ${total}`);
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
