const { PrismaClient } = require('@prisma/client');
const Anthropic = require('@anthropic-ai/sdk');
const p = new PrismaClient();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MISSING = [
  { make: 'TOYOTA',    models: ['Camry','Corolla','RAV4','Land Cruiser','Prado','Prius','Yaris','Highlander','Venza','FJ Cruiser','Fortuner','Hilux'] },
  { make: 'NISSAN',    models: ['X-Trail','Qashqai','Teana','Tiida','Juke','Murano','Patrol','Pathfinder','Leaf','Note','March','Cube','Navara'] },
  { make: 'MAZDA',     models: ['Mazda3','Mazda6','CX-5','CX-7','CX-9','Demio','Atenza','Axela','MX-5','BT-50'] },
  { make: 'HYUNDAI',   models: ['Elantra','Tucson','Santa Fe','Sonata','ix35','i30','i20','Accent','Creta','Kona','Ioniq'] },
  { make: 'KIA',       models: ['Sportage','Sorento','Optima','Cerato','Soul','Ceed','Rio','Stinger','Telluride','Carnival'] },
  { make: 'SKODA',     models: ['Octavia','Superb','Fabia','Yeti','Kodiaq','Rapid','Karoq','Scala'] },
  { make: 'INFINITI',  models: ['Q50','Q60','Q70','QX50','QX60','QX70','QX80','FX','EX','G'] },
  { make: 'JEEP',      models: ['Wrangler','Cherokee','Grand Cherokee','Renegade','Compass','Patriot','Commander'] },
  { make: 'CHEVROLET', models: ['Cruze','Malibu','Captiva','Tahoe','Suburban','Traverse','Equinox','Spark','Aveo'] },
  { make: 'RENAULT',   models: ['Megane','Laguna','Clio','Scenic','Duster','Koleos','Kadjar','Logan','Sandero'] },
  { make: 'LADA',      models: ['Vesta','Granta','Largus','XRAY','Niva','2107','2106','2105','2110','2114','2115','Kalina','Priora'] },
  { make: 'UAZ',       models: ['Patriot','Hunter','Pickup','Profi','3909','452','469'] },
  { make: 'DAEWOO',    models: ['Nexia','Matiz','Lacetti','Nubira','Leganza','Tosca','Gentra'] },
];

async function getGenerations(make, model) {
  try {
    const r = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: `List generations of ${make} ${model} with years. JSON only, no text:
[{"name":"${model} ChassisCode","yearFrom":YYYY,"yearTo":YYYY},...]
Max 6 entries. Use real chassis codes.` }]
    });
    const text = r.content[0].text.replace(/\`\`\`json|\`\`\`/g, '').trim();
    return JSON.parse(text);
  } catch(e) { return [{ name: model, yearFrom: null, yearTo: null }]; }
}

async function main() {
  let total = 0;
  for (const car of MISSING) {
    const make = await p.vehicleMake.upsert({ where:{name:car.make}, update:{}, create:{name:car.make} });
    for (const modelName of car.models) {
      process.stdout.write(`  ${car.make} ${modelName}... `);
      const gens = await getGenerations(car.make, modelName);
      let added = 0;
      for (const g of gens) {
        if (!g.name || g.name.length < 2) continue;
        try {
          await p.vehicleModel.upsert({
            where: { makeId_name: { makeId: make.id, name: g.name } },
            update: { yearFrom: g.yearFrom||undefined, yearTo: g.yearTo||undefined },
            create: { makeId: make.id, name: g.name, yearFrom: g.yearFrom, yearTo: g.yearTo }
          });
          added++;
        } catch(e) {}
      }
      console.log(`${added} gens`);
      total += added;
      await new Promise(r => setTimeout(r, 150));
    }
  }
  const dbTotal = await p.vehicleModel.count();
  console.log(`\n✅ added: ${total} | DB total: ${dbTotal}`);
  await p.$disconnect();
}
main().catch(console.error);
