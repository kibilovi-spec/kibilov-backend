const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

// 1. res.json-ის წინ analytics შევინახოთ
const oldResJson = `    res.json({ parsed, products: scored, count: scored.length });`;

const newResJson = `    // Analytics logging
    try {
      await prisma.searchAnalytics.create({
        data: {
          query: message,
          brand: parsed.brand || null,
          model: parsed.model || null,
          year: parsed.year ? String(parsed.year) : null,
          partKa: parsed.part_ka || null,
          resultsCount: scored.length,
        }
      });
    } catch(e) {}

    // "ვერ ვიპოვე" — წინადადებები
    let suggestions = [];
    if (scored.length === 0 && parsed.part_ka) {
      const suggTerms = ['წინა ' + parsed.part_ka, 'უკანა ' + parsed.part_ka, parsed.part_ka + ' კომპლექტი'];
      for (const term of suggTerms) {
        const found = await prisma.product.findFirst({
          where: { nameKa: { contains: term.split(' ').pop(), mode: 'insensitive' }, stock: { gt: 0 } },
          select: { nameKa: true }
        });
        if (found) suggestions.push(term);
      }
    }

    res.json({ parsed, products: scored, count: scored.length, suggestions });`;

if (c.includes(oldResJson)) {
  c = c.replace(oldResJson, newResJson);
  console.log('✅ analytics + suggestions დამატდა');
} else {
  console.log('❌ res.json ვერ მოიძებნა');
}

fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
