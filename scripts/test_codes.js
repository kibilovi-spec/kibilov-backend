const { config } = require('dotenv');
config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function extractCodes(nameKa, oemCodes) {
  const codes = new Set();
  const SKIP = ['MERCEDES','VW','BMW','TOYOTA','BOSCH','HYUNDAI','KIA','BENZ'];
  for (const c of oemCodes) {
    const clean = c.replace(/[\s\-\.]/g, '').toUpperCase();
    const skip = SKIP.some(b => clean.includes(b));
    if (clean.length >= 4 && clean.length <= 20 && !skip) codes.add(clean);
  }
  // nameKa-დან კოდები — "SP 389", "0 986 424 830", "GDB 1455"
  const matches = nameKa.match(/[A-Z]{1,4}\s*\d{2,}|\d[\d\s]{6,}[\d]/g) || [];
  for (const m of matches) {
    const clean = m.replace(/\s/g, '').toUpperCase();
    if (clean.length >= 4 && clean.length <= 15) codes.add(clean);
  }
  return [...codes].slice(0, 5);
}

prisma.product.findMany({
  where: { nameKa: { contains: 'MERCEDES', mode: 'insensitive' }, oemCodes: { isEmpty: false } },
  select: { nameKa: true, oemCodes: true },
  take: 5
}).then(products => {
  products.forEach(p => {
    const codes = extractCodes(p.nameKa || '', p.oemCodes);
    console.log('პროდუქტი:', p.nameKa.slice(0, 55));
    console.log('oemCodes raw:', p.oemCodes);
    console.log('extracted:', codes);
    console.log('---');
  });
}).finally(() => prisma.$disconnect());
