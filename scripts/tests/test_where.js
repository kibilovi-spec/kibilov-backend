const { PrismaClient } = require('@prisma/client');
const { enrichWithSynonyms } = require('./src/services/synonyms');
const p = new PrismaClient();

async function main() {
  const searchTerms = ['brake pad'];
  const enriched = enrichWithSynonyms(searchTerms.join(' '));
  enriched.forEach(t => { if (!searchTerms.includes(t)) searchTerms.push(t); });
  
  const engToKa = { 'brake pad': ['სამუხრუჭე ხუნდი','კალოტკა','კალოდკა'] };
  const msgLow = 'brake pad';
  for (const [eng, ka] of Object.entries(engToKa)) {
    if (msgLow.includes(eng)) ka.forEach(t => { if (!searchTerms.includes(t)) searchTerms.push(t); });
  }
  
  const normalizedTerms = [...new Set([...searchTerms, ...searchTerms.map(t=>t.replace(/\s/g,'')).filter(t=>t.length>4)])];
  console.log('terms count:', normalizedTerms.length);
  
  const whereConditions = normalizedTerms.map(term => ({
    OR: [
      { nameKa: { contains: term, mode: 'insensitive' } },
      { nameEn: { contains: term, mode: 'insensitive' } },
      { alternativeSearchKeys: { hasSome: [term, term.toUpperCase(), term.toLowerCase()] } },
    ]
  }));
  
  const products = await p.product.findMany({
    where: { OR: whereConditions, stock: { gt: 0 } },
    take: 5,
    select: { nameKa: true, stock: true }
  });
  
  console.log('found:', products.length);
  products.forEach(x => console.log(' -', x.nameKa.slice(0,50)));
  await p.$disconnect();
}
main().catch(console.error);
