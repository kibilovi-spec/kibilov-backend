'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OWN_SHOP_ADDRESS = 'საქართველო, რუსთავი, პეტრე მელიქიშვილის ქ. N23ა';
const OWN_SHOP_PHONE = process.env.SHOP_PHONE || '+995577575052';

// წონა-კატეგორიის მიხედვით მანქანის ტიპის განსაზღვრა
const VEHICLE_BY_WEIGHT = {
  SMALL: 'BIKE',
  MEDIUM: 'CAR',
  LARGE: 'CAR',
  OVERSIZED: 'VAN',
};

/**
 * შეკვეთის შექმნის შემდეგ — ორდერ-აითემების დაჯგუფება pickup-წყაროს მიხედვით
 * და შესაბამისი Shipment ჩანაწერების შექმნა.
 * ერთ Order-ს შეიძლება ჰქონდეს რამდენიმე Shipment, თუ ნაწილები სხვადასხვა
 * მომწოდებლის/საკუთარი მაღაზიის მარაგშია.
 */
async function createShipmentsForOrder(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || !order.items.length) return [];

  // თითოეული OrderItem-ისთვის ვადგენთ pickup-წყაროს:
  // თუ productId-ს აქვს დამტკიცებული ProductListing → მომწოდებლის მისამართი
  // თუ არა → საკუთარი მაღაზია
  const productIds = order.items.map(i => i.productId);
  const listings = await prisma.productListing.findMany({
    where: { productId: { in: productIds }, status: 'APPROVED' },
    include: { supplier: true },
  });
  const listingByProductId = new Map(listings.map(l => [l.productId, l]));

  // Products-ის weightCategory-ც გვჭირდება vehicle-type-ის დასადგენად
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, weightCategory: true },
  });
  const weightByProductId = new Map(products.map(p => [p.id, p.weightCategory || 'SMALL']));

  // დაჯგუფება: key = supplierId (ან 'OWN_SHOP')
  const groups = new Map();
  for (const item of order.items) {
    const listing = listingByProductId.get(item.productId);
    const key = listing ? listing.supplierId : 'OWN_SHOP';
    if (!groups.has(key)) groups.set(key, { supplier: listing?.supplier || null, items: [] });
    groups.get(key).items.push(item);
  }

  const createdShipments = [];
  for (const [key, group] of groups) {
    // ამ ჯგუფის ყველაზე მძიმე კატეგორია განსაზღვრავს საჭირო ტრანსპორტს
    const weightRank = { SMALL: 0, MEDIUM: 1, LARGE: 2, OVERSIZED: 3 };
    let maxWeight = 'SMALL';
    for (const item of group.items) {
      const w = weightByProductId.get(item.productId) || 'SMALL';
      if (weightRank[w] > weightRank[maxWeight]) maxWeight = w;
    }

    const pickupAddress = group.supplier ? (group.supplier.address || 'მისამართი დაუზუსტებელია') : OWN_SHOP_ADDRESS;
    const pickupPhone = group.supplier ? (group.supplier.phone || '') : OWN_SHOP_PHONE;

    const shipment = await prisma.shipment.create({
      data: {
        orderId: order.id,
        pickupType: key === 'OWN_SHOP' ? 'OWN_SHOP' : 'SUPPLIER',
        supplierId: key === 'OWN_SHOP' ? null : key,
        pickupAddress,
        pickupPhone,
        deliveryAddress: order.deliveryAddress,
        vehicleType: VEHICLE_BY_WEIGHT[maxWeight] || 'BIKE',
        status: 'PENDING_CONFIRMATION',
        items: {
          create: group.items.map(item => ({ orderItemId: item.id, qty: item.qty })),
        },
      },
    });
    createdShipments.push(shipment);
  }

  return createdShipments;
}

module.exports = { createShipmentsForOrder, OWN_SHOP_ADDRESS };
