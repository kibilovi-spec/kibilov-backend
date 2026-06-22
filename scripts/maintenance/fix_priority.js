const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

const old = `      // fallback — nameKa/altKeys match
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
      }`;

const newFallback = `      // fallback — brand in altKeys + part match
      if (priorityProducts.length === 0) {
        const fallbackWhere = [];
        if (parsed.brand) fallbackWhere.push({ alternativeSearchKeys: { hasSome: [parsed.brand, parsed.brand.toUpperCase()] } });
        if (parsed.model) fallbackWhere.push({ alternativeSearchKeys: { hasSome: [parsed.model] } });
        if (parsed.brand) fallbackWhere.push({ nameKa: { contains: parsed.brand, mode: 'insensitive' } });
        
        if (fallbackWhere.length > 0 && parsed.part_ka) {
          const partWords = parsed.part_ka.split(' ').filter(w => w.length > 2);
          priorityProducts = await prisma.product.findMany({
            where: {
              AND: [
                { OR: fallbackWhere },
                { OR: partWords.map(w => ({ nameKa: { contains: w, mode: 'insensitive' } })) }
              ],
              stock: { gt: 0 }
            },
            take: 20,
            select: selectFields
          });
        }
        
        // last fallback — nameKa match
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

if (c.includes(old)) {
  c = c.replace(old, newFallback);
  console.log('✅ priority fallback გაუმჯობესდა');
} else {
  console.log('❌ not found');
}
fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
