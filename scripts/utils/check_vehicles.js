const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.product.findMany({ select: { alternativeSearchKeys: true } }).then(prods => {
  const KNOWN_MAKES = new Set([
    'TOYOTA','HONDA','NISSAN','MAZDA','SUBARU','MITSUBISHI','SUZUKI',
    'BMW','MERCEDES-BENZ','AUDI','VW','VOLKSWAGEN','SKODA','OPEL',
    'FORD','KIA','HYUNDAI','LEXUS','INFINITI','JEEP','CHRYSLER',
    'MINI','RENAULT','PEUGEOT','CITROEN','FIAT','VOLVO','SEAT',
    'LADA','UAZ','PORSCHE','ISUZU','DAEWOO','CHEVROLET',
  ]);
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
  let total = 0;
  Object.entries(vehicles).sort().forEach(([make, models]) => {
    console.log(make + ': ' + models.size + ' —', [...models].slice(0,5).join(', '));
    total += models.size;
  });
  console.log('\nსულ makes:', Object.keys(vehicles).length, '| models:', total);
  p.$disconnect();
});
