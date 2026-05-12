'use strict';
const axios  = require('axios');
const { prisma } = require('../middleware/auth');

async function syncFromFina() {
  const startTime = Date.now();
  let itemsAdded = 0, itemsUpdated = 0, page = 1, hasMore = true;

  if (!process.env.FINA_API_KEY) {
    console.log('[FINA] No API key — using mock sync');
    return mockSync();
  }

  const headers = {
    'Authorization': `Bearer ${process.env.FINA_API_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    while (hasMore) {
      const response = await axios.get(`${process.env.FINA_API_URL}/products`, {
        headers,
        params: { page, limit: 100, companyId: process.env.FINA_COMPANY_ID, active: true },
        timeout: 30000,
      });

      const { data, meta } = response.data;
      if (!data || !data.length) break;

      for (const item of data) {
        const productData = mapFinaProduct(item);
        const exists = await prisma.product.findUnique({ where: { finaId: productData.finaId } });

        if (exists) {
          await prisma.product.update({
            where: { finaId: productData.finaId },
            data: { stock: productData.stock, price: productData.price, priceOld: productData.priceOld, nameKa: productData.nameKa },
          });
          itemsUpdated++;
        } else {
          const category = await findOrCreateCategory(item.category);
          await prisma.product.create({ data: { ...productData, categoryId: category?.id || null } });
          itemsAdded++;
        }
      }

      hasMore = meta?.currentPage < meta?.lastPage;
      page++;
    }

    const duration = Date.now() - startTime;
    await prisma.finaSyncLog.create({ data: { status: 'success', itemsAdded, itemsUpdated, itemsSynced: itemsAdded + itemsUpdated, duration } });
    console.log(`[FINA] Sync: +${itemsAdded} new, ~${itemsUpdated} updated (${duration}ms)`);
    return { synced: itemsAdded + itemsUpdated, added: itemsAdded, updated: itemsUpdated };

  } catch (error) {
    console.error('[FINA] Sync failed:', error.message);
    await prisma.finaSyncLog.create({ data: { status: 'error', message: error.message, itemsAdded, itemsUpdated, itemsSynced: 0 } });
    throw error;
  }
}

function mapFinaProduct(item) {
  return {
    finaId:        item.id?.toString() || `fina-${Date.now()}`,
    sku:           item.code || item.barcode || `FINA-${item.id}`,
    nameKa:        item.name_ka || item.name || 'უცნობი',
    nameEn:        item.name_en || item.name || '',
    nameRu:        item.name_ru || item.name || '',
    brand:         item.brand || item.manufacturer || 'Generic',
    articleNumber: item.article || item.part_number || item.code || '',
    compatibility: item.compatibility ? JSON.stringify(item.compatibility) : null,
    descriptionKa: item.description_ka || item.description || null,
    descriptionEn: item.description_en || null,
    descriptionRu: item.description_ru || null,
    price:         parseFloat(item.sell_price || item.price || 0),
    priceOld:      item.old_price ? parseFloat(item.old_price) : null,
    discount:      item.discount || 0,
    stock:         parseInt(item.quantity || item.stock || 0),
    unit:          item.unit || 'ც',
    weight:        item.weight ? parseFloat(item.weight) : null,
    images:        Array.isArray(item.images) ? item.images : [],
    imagePublicIds:[],
  };
}

async function findOrCreateCategory(categoryName) {
  if (!categoryName) return prisma.category.findFirst({ where: { slug: 'other' } });
  const slug = categoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return prisma.category.upsert({
    where: { slug },
    create: { slug, nameKa: categoryName, nameEn: categoryName, nameRu: categoryName, icon: '📦' },
    update: {},
  });
}

async function mockSync() {
  const catMap = {};
  const cats = [
    { slug:'chassis-suspension',   nameKa:'სავალი ნაწილი',     nameEn:'Chassis & Suspension', nameRu:'Ходовая часть',      icon:'🚘', order:1 },
    { slug:'braking-system',       nameKa:'სამუხრუჭე სისტემა', nameEn:'Braking System',       nameRu:'Тормозная система',  icon:'🛑', order:2 },
    { slug:'engine-parts',         nameKa:'ძრავი და ნაწილები',  nameEn:'Engine & Parts',       nameRu:'Двигатель и детали', icon:'⚙️', order:3 },
    { slug:'filters',              nameKa:'ფილტრები',           nameEn:'Filters',              nameRu:'Фильтры',            icon:'🔵', order:4 },
    { slug:'cooling-system',       nameKa:'გაგრილების სისტემა', nameEn:'Cooling System',       nameRu:'Система охлаждения', icon:'❄️', order:5 },
    { slug:'electrical-lighting',  nameKa:'ელექტრო/განათება',   nameEn:'Electrical & Lighting',nameRu:'Электрика/Освещение',icon:'💡', order:6 },
    { slug:'fluids-lubricants',    nameKa:'სითხეები',           nameEn:'Fluids & Lubricants',  nameRu:'Жидкости и масла',   icon:'🛢️', order:7 },
    { slug:'transmission',         nameKa:'ტრანსმისია',         nameEn:'Transmission',         nameRu:'Трансмиссия',        icon:'🔄', order:8 },
  ];
  for (const cat of cats) {
    const c = await prisma.category.upsert({ where:{slug:cat.slug}, create:cat, update:{} });
    catMap[cat.slug] = c.id;
  }

  const products = [
    { finaId:'F001', sku:'BRE-09B91311', nameKa:'სამუხრუჭე დისკი წინა', nameEn:'Brake Disc Front', nameRu:'Диск тормозной передний', brand:'BREMBO', articleNumber:'09.B913.11', compatibility:'["Toyota Camry 2018-2024","Toyota Corolla 2019-2024"]', price:117, priceOld:180, discount:35, stock:14, badge:'SALE', isFeatured:true, rating:4.9, reviewCount:127, cat:'braking-system' },
    { finaId:'F002', sku:'BSH-0986626793', nameKa:'საჰაერო ფილტრი', nameEn:'Air Filter', nameRu:'Воздушный фильтр', brand:'BOSCH', articleNumber:'0986626793', compatibility:'["BMW 3 E90 2005-2012","BMW 5 E60"]', price:45, stock:32, badge:'TOP', isFeatured:true, rating:4.8, reviewCount:89, cat:'filters' },
    { finaId:'F003', sku:'PHL-12972XVS2', nameKa:'LED ნათება H7 12V', nameEn:'LED Bulb H7', nameRu:'Лампа LED H7', brand:'PHILIPS', articleNumber:'12972XV+S2', compatibility:'["Universal"]', price:72, priceOld:95, discount:24, stock:8, badge:'NEW', isFeatured:true, rating:4.6, reviewCount:54, cat:'electrical-lighting' },
    { finaId:'F004', sku:'SAC-312581', nameKa:'შოკ-აბსორბერი უკანა', nameEn:'Shock Absorber Rear', nameRu:'Амортизатор задний', brand:'SACHS', articleNumber:'312581', compatibility:'["Mercedes E-Class W213 2016-2023"]', price:285, stock:5, isFeatured:true, rating:4.9, reviewCount:203, cat:'chassis-suspension' },
    { finaId:'F005', sku:'CAS-15663C', nameKa:'ძრავის ზეთი EDGE 5W-30 4L', nameEn:'Engine Oil EDGE 5W-30 4L', nameRu:'Масло EDGE 5W-30 4L', brand:'CASTROL', articleNumber:'15663C', compatibility:'["ACEA C3","VW 504.00"]', price:76, priceOld:95, discount:20, stock:48, badge:'SALE', isFeatured:true, rating:4.9, reviewCount:445, cat:'fluids-lubricants' },
    { finaId:'F006', sku:'VAR-E38', nameKa:'აკუმულატორი 74Ah/680A', nameEn:'Battery 74Ah 680A', nameRu:'Аккумулятор 74Ah', brand:'VARTA', articleNumber:'574402068', compatibility:'["Universal 12V"]', price:320, stock:7, isFeatured:true, rating:4.7, reviewCount:166, cat:'electrical-lighting' },
    { finaId:'F007', sku:'NGK-2467', nameKa:'სანთელი Iridium IX', nameEn:'Spark Plug Iridium IX', nameRu:'Свеча Iridium IX', brand:'NGK', articleNumber:'2467', compatibility:'["Toyota","Honda","Mazda"]', price:28, stock:61, badge:'TOP', isFeatured:true, rating:4.9, reviewCount:312, cat:'engine-parts' },
    { finaId:'F008', sku:'MAH-LA308S', nameKa:'სალონის ფილტრი', nameEn:'Cabin Air Filter', nameRu:'Салонный фильтр', brand:'MAHLE', articleNumber:'LA308S', compatibility:'["VW Golf 7","Skoda Octavia 3"]', price:30, priceOld:35, discount:15, stock:23, badge:'SALE', isFeatured:true, rating:4.8, reviewCount:78, cat:'filters' },
    { finaId:'F009', sku:'LUK-602000900', nameKa:'გადაბმულობის კომპლექტი', nameEn:'Clutch Kit', nameRu:'Комплект сцепления', brand:'LuK', articleNumber:'602000900', compatibility:'["VW Golf Passat 1.9 TDI","Audi A4 2.0 TDI"]', price:245, priceOld:290, discount:16, stock:9, badge:'SALE', isFeatured:true, rating:4.8, reviewCount:134, cat:'transmission' },
    { finaId:'F010', sku:'GAT-K015687XS', nameKa:'სარემო ღვედი კომპლ.', nameEn:'Timing Belt Kit', nameRu:'Ремень ГРМ комплект', brand:'GATES', articleNumber:'K015687XS', compatibility:'["Hyundai Tucson 2.0","Kia Sportage 2.0 G4KD"]', price:185, stock:12, isFeatured:true, rating:4.7, reviewCount:88, cat:'engine-parts' },
    { finaId:'F011', sku:'ATE-13046', nameKa:'სამუხრუჭე ხუნდები წინა', nameEn:'Brake Pads Front', nameRu:'Колодки тормозные передние', brand:'ATE', articleNumber:'13046', compatibility:'["Toyota Camry 2012-2018","Toyota Corolla 2013-2019"]', price:68, priceOld:85, discount:20, stock:27, badge:'SALE', rating:4.8, reviewCount:201, cat:'braking-system' },
    { finaId:'F012', sku:'FEB-23082', nameKa:'სფერული სახსარი', nameEn:'Ball Joint', nameRu:'Шаровая опора', brand:'FEBI', articleNumber:'23082', compatibility:'["BMW 3 E46","BMW 3 E90"]', price:55, stock:18, rating:4.6, reviewCount:67, cat:'chassis-suspension' },
  ];

  let added = 0, updated = 0;
  for (const p of products) {
    const { cat, ...data } = p;
    const catId = catMap[cat];
    if (!catId) continue;
    const exists = await prisma.product.findUnique({ where: { finaId: p.finaId } });
    if (!exists) {
      await prisma.product.create({ data: { ...data, categoryId: catId, discount: data.discount || 0, images: [], imagePublicIds: [], rating: data.rating || 0, reviewCount: data.reviewCount || 0 } });
      added++;
    } else {
      await prisma.product.update({ where: { finaId: p.finaId }, data: { stock: data.stock, price: data.price } });
      updated++;
    }
  }

  await prisma.finaSyncLog.create({ data: { status: 'success', message: 'mock sync', itemsAdded: added, itemsUpdated: updated, itemsSynced: added + updated } });
  return { synced: added + updated, added, updated };
}

module.exports = { syncFromFina };
