const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const makes = await p.vehicleMake.findMany({ include: { models: true } });
  const toyotaModels = makes.find(m => m.name === 'TOYOTA')?.models || [];
  console.log('TOYOTA models in DB:', toyotaModels.slice(0,5).map(m => m.name));

  const prod = await p.product.findFirst({
    where: { alternativeSearchKeys: { hasSome: ['TOYOTA Camry'] } },
    select: { id: true, alternativeSearchKeys: true }
  });
  console.log('\nProduct altKeys:', prod?.alternativeSearchKeys?.filter(k => k.includes('TOYOTA')));

  // manual match test
  const key = 'TOYOTA Camry';
  const parts = key.split(' ');
  const makeName = parts[0].toUpperCase();
  const modelPart = parts.slice(1).join(' ').trim().toUpperCase();
  console.log('\nmakeName:', makeName, '| modelPart:', modelPart);

  const makeData = makes.find(m => m.name === makeName);
  console.log('make found:', makeData ? 'yes' : 'no');

  if (makeData) {
    const match = makeData.models.find(m => {
      const dbModel = m.name.toUpperCase();
      return dbModel === modelPart || dbModel.includes(modelPart) || modelPart.includes(dbModel);
    });
    console.log('model match:', match ? match.name : 'none');
    console.log('camry models:', makeData.models.filter(m => m.name.toUpperCase().includes('CAMRY')).map(m => m.name));
  }
  await p.$disconnect();
}
main().catch(console.error);
