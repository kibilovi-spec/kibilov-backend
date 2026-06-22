const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const KNOWN_MAKES = new Set([
  'TOYOTA','HONDA','NISSAN','MAZDA','SUBARU','MITSUBISHI','SUZUKI',
  'BMW','MERCEDES-BENZ','AUDI','VW','VOLKSWAGEN','SKODA','OPEL',
  'FORD','KIA','HYUNDAI','LEXUS','INFINITI','JEEP','CHRYSLER',
  'MINI','RENAULT','PEUGEOT','CITROEN','FIAT','VOLVO','SEAT',
  'LADA','UAZ','PORSCHE','ISUZU','DAEWOO','CHEVROLET',
]);

async function main() {
  console.log('Product ↔ Vehicle დაკავშირება...\n');

  const [products, makes] = await Promise.all([
    p.product.findMany({ select: { id: true, alternativeSearchKeys: true } }),
    p.vehicleMake.findMany({ include: { models: true } }),
  ]);

  // make name → models map
  const makeMap = {};
  for (const make of makes) {
    makeMap[make.name] = { id: make.id, models: make.models };
  }

  let linked = 0, skipped = 0, errors = 0;

  for (const prod of products) {
    const keys = prod.alternativeSearchKeys || [];
    const linkedModels = new Set();

    for (const key of keys) {
      const parts = key.trim().split(' ');
      const makeName = parts[0]?.toUpperCase();
      const modelPart = parts.slice(1).join(' ').trim().toUpperCase();

      if (!makeMap[makeName] || !modelPart || modelPart.length < 2) { skipped++; continue; }

      const models = makeMap[makeName].models;

      // მრავალმხრივი match:
      // 1. exact: "CAMRY" === "CAMRY"
      // 2. DB model starts with altKey model: "CAMRY XV40".startsWith("CAMRY")
      // 3. altKey model starts with DB model: "CAMRY 2008".startsWith("CAMRY")
      // 4. DB model contains altKey: "CAMRY XV40".includes("CAMRY")
      const matches = models.filter(m => {
        const dbModel = m.name.toUpperCase();
        return dbModel === modelPart ||
               dbModel.startsWith(modelPart) ||
               modelPart.startsWith(dbModel) ||
               dbModel.includes(modelPart) ||
               modelPart.includes(dbModel);
      });

      for (const match of matches) {
        if (linkedModels.has(match.id)) continue;
        linkedModels.add(match.id);
        try {
          await p.productVehicle.upsert({
            where: { productId_vehicleModelId: { productId: prod.id, vehicleModelId: match.id } },
            update: {},
            create: { productId: prod.id, vehicleModelId: match.id },
          });
          linked++;
        } catch(e) { errors++; }
      }
    }
    if (linkedModels.size === 0) skipped++;
  }

  console.log(`✅ linked: ${linked}`);
  console.log(`⬜ skipped: ${skipped}`);
  console.log(`❌ errors: ${errors}`);
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
