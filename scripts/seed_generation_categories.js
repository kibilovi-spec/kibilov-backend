require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// generation → autodoc category IDs mapping
// ყველა მანქანის გენერაციისთვის სტანდარტული კატეგორიები
const COMMON = [
  { id: 100030, name: 'Brake Pad' },
  { id: 100031, name: 'Brake Disc' },
  { id: 100259, name: 'Oil Filter' },
  { id: 100260, name: 'Air Filter' },
  { id: 100263, name: 'Cabin Air Filter' },
  { id: 100261, name: 'Fuel Filter' },
  { id: 102203, name: 'Oil' },
  { id: 100121, name: 'Shock Absorber' },
  { id: 100071, name: 'Clutch Kit' },
  { id: 100079, name: 'Water Pump' },
];

const GENERATIONS = [
  'E30','E36','E46','E90','F30','G20',
  'E39','E60','F10','G30',
  'E53','E70','F15',
  'W210','W211','W212','W203','W204','W205',
  'Golf 4','Golf 5','Golf 6','Golf 7',
  'XV40','XV50','XV70',
];

(async () => {
  let inserted = 0;
  for (const gen of GENERATIONS) {
    // make-ის განსაზღვრა
    let make = 'BMW';
    if (gen.startsWith('W')) make = 'Mercedes-Benz';
    else if (gen.startsWith('Golf')) make = 'Volkswagen';
    else if (gen.startsWith('XV')) make = 'Toyota';

    for (const cat of COMMON) {
      await prisma.$executeRaw`
        INSERT INTO generation_oem_categories (generation, make, autodoc_category_id, category_name)
        VALUES (${gen}, ${make}, ${cat.id}, ${cat.name})
        ON CONFLICT (generation, autodoc_category_id) DO NOTHING
      `;
      inserted++;
    }
  }
  console.log(`${inserted} generation-category mapping ჩაიწერა`);
  await prisma.$disconnect();
})();
