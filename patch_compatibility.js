const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

// priority query-ში year filter დავამატოთ ProductVehicle-ით
const oldPriority = `    // 1. პრიორიტეტული query — brand+model ზუსტი match
    let priorityProducts = [];
    if (parsed.brand && parsed.model) {
      priorityProducts = await prisma.product.findMany({
        where: {
          OR: [
            { nameKa: { contains: parsed.brand + ' ' + parsed.model, mode: 'insensitive' } },
            { alternativeSearchKeys: { has: parsed.brand + ' ' + parsed.model } },
          ],
          stock: { gt: 0 }
        },
        take: 20,
        select: selectFields
      });
    }`;

const newPriority = `    // 1. პრიორიტეტული query — brand+model + year compatibility
    let priorityProducts = [];
    if (parsed.brand && parsed.model) {
      // ProductVehicle-ით ზუსტი year match
      if (parsed.year) {
        const userYear = parseInt(parsed.year);
        try {
          const compatibleVehicles = await prisma.vehicleModel.findMany({
            where: {
              make: { name: { contains: parsed.brand, mode: 'insensitive' } },
              name: { contains: parsed.model, mode: 'insensitive' },
              OR: [
                { yearFrom: null },
                { yearFrom: { lte: userYear } },
              ],
              AND: [
                { OR: [{ yearTo: null }, { yearTo: { gte: userYear } }] }
              ]
            },
            select: { id: true, name: true, yearFrom: true, yearTo: true },
            take: 20
          });

          if (compatibleVehicles.length > 0) {
            const vehicleIds = compatibleVehicles.map(v => v.id);
            const compatProducts = await prisma.productVehicle.findMany({
              where: { vehicleModelId: { in: vehicleIds } },
              select: { productId: true },
              take: 50
            });
            const productIds = [...new Set(compatProducts.map(p => p.productId))];
            if (productIds.length > 0) {
              priorityProducts = await prisma.product.findMany({
                where: { id: { in: productIds }, stock: { gt: 0 } },
                take: 20,
                select: selectFields
              });
            }
          }
        } catch(e) {}
      }

      // fallback — nameKa/altKeys match
      if (priorityProducts.length === 0) {
        priorityProducts = await prisma.product.findMany({
          where: {
            OR: [
              { nameKa: { contains: parsed.brand + ' ' + parsed.model, mode: 'insensitive' } },
              { alternativeSearchKeys: { has: parsed.brand + ' ' + parsed.model } },
            ],
            stock: { gt: 0 }
          },
          take: 20,
          select: selectFields
        });
      }
    }`;

if (c.includes(oldPriority)) {
  c = c.replace(oldPriority, newPriority);
  console.log('✅ Compatibility Engine დამატდა');
} else {
  console.log('❌ priority query ვერ მოიძებნა');
}

fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
console.log('დასრულდა!');
