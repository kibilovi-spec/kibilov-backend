const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const SPARQL_URL = 'https://query.wikidata.org/sparql';

// გამოტოვებული makes — სწორი WD IDs
const MAKE_QUERIES = [
  { make: 'TOYOTA',    wd: 'Q46970' },
  { make: 'NISSAN',    wd: 'Q10189' },
  { make: 'MAZDA',     wd: 'Q29017' },
  { make: 'HYUNDAI',   wd: 'Q26746' },
  { make: 'KIA',       wd: 'Q34090' },
  { make: 'SKODA',     wd: 'Q29242' },
  { make: 'INFINITI',  wd: 'Q696985' },
  { make: 'JEEP',      wd: 'Q35551' },
  { make: 'CHEVROLET', wd: 'Q34602' },
  { make: 'RENAULT',   wd: 'Q55386' },
];

async function fetchModels(makeWd) {
  // გამარტივებული query — instance of automobile model OR automobile
  const query = `
SELECT DISTINCT ?modelLabel ?inception ?discontinued WHERE {
  ?model wdt:P176 wd:${makeWd} .
  ?model wdt:P31 ?type .
  FILTER(?type IN (wd:Q3231690, wd:Q1361985, wd:Q15056995, wd:Q15056993))
  OPTIONAL { ?model wdt:P571 ?inception . }
  OPTIONAL { ?model wdt:P2669 ?discontinued . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
} LIMIT 100`;

  const url = SPARQL_URL + '?query=' + encodeURIComponent(query) + '&format=json';
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'kibilov.ge/1.0' } });
    const data = await r.json();
    return (data.results?.bindings || []).map(row => ({
      name: row.modelLabel?.value,
      yearFrom: row.inception?.value ? parseInt(row.inception.value.slice(0,4)) : null,
      yearTo: row.discontinued?.value ? parseInt(row.discontinued.value.slice(0,4)) : null,
    })).filter(m => m.name && !m.name.startsWith('Q') && m.name.length > 1);
  } catch(e) { return []; }
}

async function main() {
  let totalNew = 0;
  for (const car of MAKE_QUERIES) {
    process.stdout.write(`${car.make}... `);
    const make = await p.vehicleMake.upsert({ where:{name:car.make}, update:{}, create:{name:car.make} });
    const models = await fetchModels(car.wd);
    process.stdout.write(`${models.length} found... `);
    let added = 0;
    for (const m of models) {
      try {
        await p.vehicleModel.upsert({
          where: { makeId_name: { makeId: make.id, name: m.name } },
          update: { yearFrom: m.yearFrom||undefined, yearTo: m.yearTo||undefined },
          create: { makeId: make.id, name: m.name, yearFrom: m.yearFrom, yearTo: m.yearTo }
        });
        added++;
      } catch(e) {}
    }
    console.log(`${added} added`);
    totalNew += added;
    await new Promise(r => setTimeout(r, 1500));
  }
  const total = await p.vehicleModel.count();
  console.log(`\n✅ added: ${totalNew} | DB total: ${total}`);
  await p.$disconnect();
}
main().catch(console.error);
