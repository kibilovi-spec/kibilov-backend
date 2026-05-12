'use strict';
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin user
  const adminPass = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@2025!', 12);
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@kibilov.ge' },
    update: {},
    create: {
      name: 'ადმინი',
      email: process.env.ADMIN_EMAIL || 'admin@kibilov.ge',
      password: adminPass,
      role: 'ADMIN',
      phone: '+995555000000',
    },
  });
  console.log('✅ Admin user:', admin.email);

  // Delivery zones
  const zones = [
    { zone: 'RUSTAVI',  fee: 0,  freeFrom: 150, enabled: true, estimatedDays: 1 },
    { zone: 'TBILISI',  fee: 5,  freeFrom: 150, enabled: true, estimatedDays: 1 },
    { zone: 'MTSKHETA', fee: 7,  freeFrom: 150, enabled: true, estimatedDays: 2 },
    { zone: 'OTHER',    fee: 10, freeFrom: 150, enabled: true, estimatedDays: 3 },
  ];
  for (const z of zones) {
    await prisma.deliveryZoneConfig.upsert({
      where: { zone: z.zone },
      update: z,
      create: z,
    });
  }
  console.log('✅ Delivery zones seeded');

  // Categories
  const cats = [
    { slug: 'engines',       nameKa: 'ძრავები',         nameEn: 'Engines',       nameRu: 'Двигатели',    icon: '🔧', order: 1 },
    { slug: 'brakes',        nameKa: 'სამუხრუჭე სისტ.', nameEn: 'Brakes',        nameRu: 'Тормоза',      icon: '🛑', order: 2 },
    { slug: 'suspension',    nameKa: 'სასიარულო ნაწ.',  nameEn: 'Suspension',    nameRu: 'Подвеска',     icon: '⚙️', order: 3 },
    { slug: 'filters',       nameKa: 'ფილტრები',         nameEn: 'Filters',       nameRu: 'Фильтры',      icon: '🔬', order: 4 },
    { slug: 'electrics',     nameKa: 'ელექტრიკა',        nameEn: 'Electrics',     nameRu: 'Электрика',    icon: '⚡', order: 5 },
    { slug: 'body',          nameKa: 'კარავი / ძარა',   nameEn: 'Body Parts',    nameRu: 'Кузов',        icon: '🚗', order: 6 },
    { slug: 'oils-fluids',   nameKa: 'ზეთები / სითხ.',  nameEn: 'Oils & Fluids', nameRu: 'Масла и жидк.',icon: '🛢️', order: 7 },
    { slug: 'accessories',   nameKa: 'აქსესუარები',     nameEn: 'Accessories',   nameRu: 'Аксессуары',   icon: '🎁', order: 8 },
  ];
  for (const c of cats) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
  }
  console.log('✅ Categories seeded');

  // Sample products (only if none exist)
  const count = await prisma.product.count();
  if (count === 0) {
    const filterCat = await prisma.category.findUnique({ where: { slug: 'filters' } });
    const brakeCat  = await prisma.category.findUnique({ where: { slug: 'brakes' } });

    const products = [
      {
        finaId: 'FINA-001', sku: 'F-001-BOG',
        nameKa: 'ზეთის ფილტრი — Bosch', nameEn: 'Oil Filter — Bosch', nameRu: 'Масляный фильтр — Bosch',
        brand: 'Bosch', price: 12.50, priceOld: 15.00, stock: 50,
        categoryId: filterCat?.id, badge: 'SALE', isFeatured: true,
        images: [], description: 'მაღალი ხარისხის ზეთის ფილტრი',
      },
      {
        finaId: 'FINA-002', sku: 'B-002-TRW',
        nameKa: 'სამუხრუჭე ხუნდები — TRW', nameEn: 'Brake Pads — TRW', nameRu: 'Тормозные колодки — TRW',
        brand: 'TRW', price: 65.00, stock: 20,
        categoryId: brakeCat?.id, badge: 'TOP', isFeatured: true,
        images: [], description: 'საიმედო სამუხრუჭე ხუნდები',
      },
      {
        finaId: 'FINA-003', sku: 'F-003-MAN',
        nameKa: 'ჰაერის ფილტრი — Mann', nameEn: 'Air Filter — Mann', nameRu: 'Воздушный фильтр — Mann',
        brand: 'Mann', price: 18.00, stock: 35,
        categoryId: filterCat?.id, badge: 'NEW', isFeatured: true,
        images: [],
      },
      {
        finaId: 'FINA-004', sku: 'B-004-ATE',
        nameKa: 'სამუხრუჭე დისკები — ATE', nameEn: 'Brake Discs — ATE', nameRu: 'Тормозные диски — ATE',
        brand: 'ATE', price: 120.00, priceOld: 145.00, stock: 8,
        categoryId: brakeCat?.id, badge: 'SALE', isFeatured: false,
        images: [],
      },
    ];

    for (const p of products) {
      await prisma.product.create({ data: p });
    }
    console.log('✅ Sample products seeded');
  } else {
    console.log(`ℹ️  Products already exist (${count}), skipping sample data`);
  }

  console.log('\n🎉 Seed complete!');
  console.log(`📧 Admin: ${process.env.ADMIN_EMAIL || 'admin@kibilov.ge'}`);
  console.log(`🔑 Password: ${process.env.ADMIN_PASSWORD || 'Admin@2025!'}`);
}

main().catch(e => {
  console.error('❌ Seed error:', e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
