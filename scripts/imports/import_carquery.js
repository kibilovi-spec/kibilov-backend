/**
 * CarQuery API — უფასო, key არ სჭირდება
 * year/make/model/trim/engine data
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const CARQUERY_URL = 'https://www.carqueryapi.com/api/0.3/';

async function getMakes(year) {
  const url = CARQUERY_URL + '?cmd=getMakes&year=' + year + '&callback=?';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'kibilov.ge/1.0' } });
    let text = await r.text();
    // JSONP response — strip callback
    text = text.replace(/^\?\(/, '').replace(/\);?$/, '');
    return JSON.parse(text).Makes || [];
  } catch(e) { return []; }
}

async function getModels(make, year) {
  const url = CARQUERY_URL + '?cmd=getModels&make=' + encodeURIComponent(make) + '&year=' + year + '&callback=?';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'kibilov.ge/1.0' } });
    let text = await r.text();
    text = text.replace(/^\?\(/, '').replace(/\);?$/, '');
    return JSON.parse(text).Models || [];
  } catch(e) { return []; }
}

const TARGET_MAKES = [
  'Toyota','Honda','Nissan','Mazda','Subaru','Mitsubishi','Suzuki',
  'BMW','Mercedes-Benz','Audi','Volkswagen','Skoda','Opel','Ford',
  'Hyundai','Kia','Lexus','Infiniti','Jeep','Chevrolet','Renault',
  'Peugeot','Citroen','Fiat','Volvo','Seat','Lada','Porsche',
];

async function main() {
  console.log('CarQuery API-დან მოდელების იმპორტი...\n');
  
  let totalAdded = 0;
  const years = [2000, 2005, 2010, 2015, 2020];

  for (const makeName of TARGET_MAKES) {
    process.stdout.write(`${makeName}... `);
    
    const dbMakeName = makeName.toUpperCase().replace('MERCEDES-BENZ','MERCEDES-BENZ').replace('VOLKSWAGEN','VW');
    const make = await p.vehicleMake.upsert({
      where: { name: dbMakeName },
      update: {},
      create: { name: dbMakeName }
    });

    const modelSet = new Map(); // name → {yearFrom, yearTo}

    for (const year of years) {
      const models = await getModels(makeName, year);
      for (const m of models) {
        const name = m.model_name;
        if (!name) continue;
        const existing = modelSet.get(name);
        if (!existing) {
          modelSet.set(name, { yearFrom: year, yearTo: year });
        } else {
          if (year < existing.yearFrom) existing.yearFrom = year;
          if (year > existing.yearTo) existing.yearTo = year;
        }
      }
      await new Promise(r => setTimeout(r, 300));
    }

    let added = 0;
    for (const [name, years_] of modelSet) {
      try {
        await p.vehicleModel.upsert({
          where: { makeId_name: { makeId: make.id, name } },
          update: { yearFrom: years_.yearFrom, yearTo: years_.yearTo },
          create: { makeId: make.id, name, yearFrom: years_.yearFrom, yearTo: years_.yearTo }
        });
        added++;
      } catch(e) {}
    }
    
    console.log(`${modelSet.size} models, ${added} added`);
    totalAdded += added;
    await new Promise(r => setTimeout(r, 500));
  }

  const total = await p.vehicleModel.count();
  console.log(`\n✅ added: ${totalAdded} | DB total: ${total}`);
  await p.$disconnect();
}

main().catch(console.error);
