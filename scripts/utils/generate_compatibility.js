/**
 * generate_compatibility.js
 * Claude AI-ს გამოყენებით VehicleModel ცხრილის შევსება
 * და product-vehicle კავშირების გაუმჯობესება
 */
const { PrismaClient } = require('@prisma/client');
const Anthropic = require('@anthropic-ai/sdk');

const p = new PrismaClient();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// საქართველოში პოპულარული მანქანები + სრული თაობები
const POPULAR_CARS = [
  // Toyota
  { make: 'TOYOTA', models: ['Camry','Corolla','RAV4','Land Cruiser','Prado','Prius','Yaris','Vitz','Auris','Hilux','Alphard','Voxy','Noah'] },
  // Honda
  { make: 'HONDA', models: ['Accord','CR-V','Civic','Fit','Jazz','HR-V','Pilot','Odyssey','Stream','Freed'] },
  // Nissan
  { make: 'NISSAN', models: ['X-Trail','Qashqai','Teana','Tiida','Juke','Murano','Pathfinder','Leaf','Note','March','Cube'] },
  // Mazda
  { make: 'MAZDA', models: ['Mazda3','Mazda6','CX-5','CX-7','CX-9','Atenza','Axela','Tribute','Demio'] },
  // Subaru
  { make: 'SUBARU', models: ['Forester','Outback','Impreza','Legacy','XV','Tribeca'] },
  // Mitsubishi
  { make: 'MITSUBISHI', models: ['Outlander','Pajero','Lancer','Eclipse Cross','ASX','L200','Galant','Colt','Airtrek'] },
  // BMW
  { make: 'BMW', models: ['3 Series','5 Series','X5','X3','7 Series','1 Series','X1','X6'] },
  // Mercedes
  { make: 'MERCEDES-BENZ', models: ['E-Class','C-Class','S-Class','ML-Class','Sprinter','Vito','GLC','GLE','A-Class'] },
  // VW
  { make: 'VW', models: ['Golf','Passat','Tiguan','Touareg','Transporter','Polo','Jetta','Caddy','Crafter'] },
  // Audi
  { make: 'AUDI', models: ['A4','A6','Q5','Q7','A3','A8','Q3','TT'] },
  // Opel
  { make: 'OPEL', models: ['Astra','Vectra','Zafira','Insignia','Corsa','Mokka','Antara','Combo'] },
  // Ford
  { make: 'FORD', models: ['Transit','Focus','Mondeo','Ranger','Explorer','Escape','Fusion','Kuga'] },
  // Hyundai
  { make: 'HYUNDAI', models: ['Elantra','Tucson','Santa Fe','Sonata','ix35','i30','Accent','Creta'] },
  // KIA
  { make: 'KIA', models: ['Sportage','Sorento','Optima','Cerato','Soul','Ceed','Rio','Stinger'] },
  // Skoda
  { make: 'SKODA', models: ['Octavia','Superb','Fabia','Yeti','Kodiaq','Rapid'] },
  // Lexus
  { make: 'LEXUS', models: ['RX','ES','LX','GX','IS','NX','LS'] },
];

async function getModelGenerations(make, model) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `List all generations/body codes of ${make} ${model} with year ranges. Return ONLY JSON array, no other text:
[{"name":"${model} generation_name_or_code","yearFrom":YYYY,"yearTo":YYYY},...]
Example for Toyota Camry: [{"name":"Camry XV40","yearFrom":2006,"yearTo":2011},{"name":"Camry XV50","yearFrom":2011,"yearTo":2017}]
Be concise, max 8 generations. Use actual chassis codes when known (E90, W204, XV40 etc).`
    }]
  });
  
  try {
    const text = response.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch(e) {
    return [];
  }
}

async function main() {
  console.log('Claude-ის ცოდნით VehicleModel ცხრილის შევსება...\n');
  
  let makeCount = 0, modelCount = 0, skipped = 0;

  for (const car of POPULAR_CARS) {
    // Upsert make
    const make = await p.vehicleMake.upsert({
      where: { name: car.make },
      update: {},
      create: { name: car.make }
    });
    makeCount++;

    for (const modelName of car.models) {
      console.log(`  ${car.make} ${modelName}...`);
      
      try {
        const generations = await getModelGenerations(car.make, modelName);
        
        if (generations.length === 0) {
          // fallback — ზოგადი entry
          await p.vehicleModel.upsert({
            where: { makeId_name: { makeId: make.id, name: modelName } },
            update: {},
            create: { makeId: make.id, name: modelName, yearFrom: 1990, yearTo: null }
          });
          modelCount++;
          continue;
        }

        for (const gen of generations) {
          const name = gen.name || modelName;
          if (!name || name.length < 2) continue;
          
          await p.vehicleModel.upsert({
            where: { makeId_name: { makeId: make.id, name } },
            update: { yearFrom: gen.yearFrom, yearTo: gen.yearTo },
            create: { makeId: make.id, name, yearFrom: gen.yearFrom || null, yearTo: gen.yearTo || null }
          });
          modelCount++;
        }
        
        // rate limit
        await new Promise(r => setTimeout(r, 200));
      } catch(e) {
        console.log(`    ❌ ${e.message}`);
        skipped++;
      }
    }
  }

  const total = await p.vehicleModel.count();
  console.log(`\n✅ makes: ${makeCount}`);
  console.log(`✅ new models: ${modelCount}`);
  console.log(`⬜ skipped: ${skipped}`);
  console.log(`📊 DB total models: ${total}`);
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
