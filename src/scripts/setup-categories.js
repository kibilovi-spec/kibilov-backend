'use strict';
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CATEGORIES = [
  {
    slug: 'braking-system',
    nameKa: 'სამუხრუჭე სისტემა',
    nameEn: 'Braking System',
    nameRu: 'Тормозная система',
    icon: '🛑',
    order: 1,
    children: [
      { slug: 'brake-pads-front', nameKa: 'წინა სამუხრუჭე ხუნდები', nameEn: 'Front Brake Pads', nameRu: 'Передние тормозные колодки', icon: '🛑' },
      { slug: 'brake-pads-rear',  nameKa: 'უკანა სამუხრუჭე ხუნდები', nameEn: 'Rear Brake Pads',  nameRu: 'Задние тормозные колодки',  icon: '🛑' },
    ],
  },
  {
    slug: 'filters',
    nameKa: 'ფილტრები',
    nameEn: 'Filters',
    nameRu: 'Фильтры',
    icon: '🔵',
    order: 2,
    children: [
      { slug: 'oil-filters',    nameKa: 'ზეთის ფილტრები',   nameEn: 'Oil Filters',    nameRu: 'Масляные фильтры',    icon: '🔵' },
      { slug: 'air-filters',    nameKa: 'ჰაერის ფილტრები',  nameEn: 'Air Filters',    nameRu: 'Воздушные фильтры',   icon: '💨' },
      { slug: 'cabin-filters',  nameKa: 'სალონის ფილტრები', nameEn: 'Cabin Filters',  nameRu: 'Салонные фильтры',    icon: '🌬️' },
      { slug: 'fuel-filters',   nameKa: 'საწვავის ფილტრები',nameEn: 'Fuel Filters',   nameRu: 'Топливные фильтры',   icon: '⛽' },
    ],
  },
  {
    slug: 'fluids-chemicals',
    nameKa: 'ზეთები და სითხეები',
    nameEn: 'Fluids & Chemicals',
    nameRu: 'Масла и жидкости',
    icon: '🛢️',
    order: 3,
    children: [
      { slug: 'engine-oils',      nameKa: 'ძრავის ზეთები',                              nameEn: 'Engine Oils',         nameRu: 'Моторные масла',          icon: '🛢️' },
      { slug: 'transmission-oils',nameKa: 'გადაცემათა კოლოფის ზეთები (ATF, Gear Oil)', nameEn: 'Transmission Oils (ATF, Gear Oil)', nameRu: 'Трансмиссионные масла (ATF, Gear Oil)', icon: '⚙️' },
      { slug: 'coolants',         nameKa: 'გაგრილების სითხეები: ანტიფრიზი G11 G12 G13',nameEn: 'Coolants: Antifreeze G11 G12 G13', nameRu: 'Охлаждающие жидкости: Антифриз G11 G12 G13', icon: '❄️' },
      { slug: 'brake-fluids',     nameKa: 'ჰიდრავლიკის და სამუხრუჭე სითხეები',        nameEn: 'Hydraulic & Brake Fluids',        nameRu: 'Гидравлические и тормозные жидкости', icon: '🔴' },
    ],
  },
  {
    slug: 'cleaning',
    nameKa: 'გამწმენდი საშუალებები',
    nameEn: 'Cleaning Products',
    nameRu: 'Очистительные средства',
    icon: '🧴',
    order: 4,
    children: [],
  },
  {
    slug: 'wipers',
    nameKa: 'მინასაწმენდები',
    nameEn: 'Windshield Wipers',
    nameRu: 'Стеклоочистители',
    icon: '🌧️',
    order: 5,
    children: [],
  },
];

// Keywords for auto-categorization during Excel import
const CATEGORY_KEYWORDS = {
  'brake-pads-front': ['წინა სამუხრ','front brake','передн.*колод','brake pad.*front','front.*pad'],
  'brake-pads-rear':  ['უკანა სამუხრ','rear brake','задн.*колод','brake pad.*rear','rear.*pad'],
  'braking-system':   ['სამუხრ','brake','тормоз','disk','დისკი','drum','барабан'],
  'oil-filters':      ['ზეთის ფილტ','oil filter','масл.*фильтр','фильтр.*масл'],
  'air-filters':      ['ჰაერის ფილტ','air filter','воздуш.*фильтр','фильтр.*воздух'],
  'cabin-filters':    ['სალონის ფილტ','cabin filter','салон.*фильтр','фильтр.*салон'],
  'fuel-filters':     ['საწვავის ფილტ','fuel filter','топлив.*фильтр','фильтр.*топлив'],
  'engine-oils':      ['ძრავის ზეთ','engine oil','моторн.*масл','масло.*мотор','titanium','5w','10w','15w','0w','sae'],
  'transmission-oils':['გადაცემ','atf','gear oil','кбилан','трансмис','transmission','ტრანსმ','კბილან','steering oil'],
  'coolants':         ['ანტიფრიზ','antifreeze','coolant','охлажд','g11','g12','g13','g14'],
  'brake-fluids':     ['სამუხრ.*სითხ','სამუხ.*სითხ','brake fluid','тормоз.*жидк','hydrolube','dot 3','dot 4','dot 5','hydraulic','ჰიდრო','hydro'],
  'cleaning':         ['გამწმენდ','cleaner','очист','промывк','промывоч'],
  'wipers':           ['მინასაწმენდ','wiper','щётк','дворник','стеклоочист'],
};

async function main() {
  console.log('🗂️  კატეგორიების დაყენება...\n');

  // Deactivate old auto-generated categories
  await prisma.category.updateMany({
    where: { slug: { in: ['chassis-suspension','braking-system-old','engine-parts','cooling-system','electrical-lighting','fluids-lubricants','transmission','engine-oils','transmission-oils','hydraulic-oils','brake-fluids-old','coolants-old','compressor-oils','industrial-oils','greases'] }},
    data: { isActive: false },
  });

  const slugToId = {};

  for (const cat of CATEGORIES) {
    const { children, ...catData } = cat;

    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      create: { ...catData, isActive: true },
      update: { nameKa: catData.nameKa, nameEn: catData.nameEn, nameRu: catData.nameRu, icon: catData.icon, order: catData.order, isActive: true },
    });
    slugToId[cat.slug] = parent.id;
    console.log(`✅ ${cat.nameKa}`);

    for (const child of children) {
      const c = await prisma.category.upsert({
        where: { slug: child.slug },
        create: { ...child, parentId: parent.id, order: 0, isActive: true },
        update: { nameKa: child.nameKa, nameEn: child.nameEn, nameRu: child.nameRu, icon: child.icon, parentId: parent.id, isActive: true },
      });
      slugToId[child.slug] = c.id;
      console.log(`   ↳ ${child.nameKa}`);
    }
  }

  // Re-categorize existing products
  console.log('\n🔄 პროდუქტების გადანაწილება კატეგორიებში...');
  const products = await prisma.product.findMany({ where: { isActive: true }, select: { id: true, nameKa: true, nameEn: true, nameRu: true } });

  let updated = 0;
  for (const p of products) {
    const searchText = `${p.nameKa} ${p.nameEn || ''} ${p.nameRu || ''}`.toLowerCase();
    let matched = null;

    // Try specific subcategories first, then parent
    for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(k => searchText.match(new RegExp(k, 'i')))) {
        matched = slug;
        break;
      }
    }

    if (matched && slugToId[matched]) {
      await prisma.product.update({ where: { id: p.id }, data: { categoryId: slugToId[matched] } });
      updated++;
    }
  }

  console.log(`✅ ${updated} პროდუქტი გადანაწილდა\n`);
  console.log('─'.repeat(50));
  console.log('🎉 კატეგორიები მზადაა!');
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
