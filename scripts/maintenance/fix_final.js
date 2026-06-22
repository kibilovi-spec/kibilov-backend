const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

// Fix: OEM block-ში duplicate PrismaClient require ამოვიღოთ
c = c.replace(
  `    if (oemMatch) {
      const oemCode = oemMatch[1].replace(/\\s+/g,'').trim();
      const { PrismaClient } = require('@prisma/client');
      const prismaOem = new PrismaClient();`,
  `    if (oemMatch) {
      const oemCode = oemMatch[1].replace(/\\s+/g,'').trim();
      const prismaOem = new PrismaClient();`
);

// Fix: eng→ka block — parsed reference-ის შემდეგ გადავიტანოთ
// ვნახოთ სად არის eng→ka block
const engKaIdx = c.indexOf('    // brake pad, колодка → ქართული');
const parsedIdx = c.indexOf('    const parsed = JSON.parse(text);');

if (engKaIdx > 0 && engKaIdx < parsedIdx) {
  console.log('eng→ka block is BEFORE parsed — moving...');
  const blockStart = engKaIdx;
  const blockEnd = c.indexOf('\n    // OEM code detection', engKaIdx);
  if (blockEnd > blockStart) {
    const block = c.slice(blockStart, blockEnd);
    c = c.slice(0, blockStart) + c.slice(blockEnd);
    // ჩასვათ searchTerms push-ის შემდეგ
    const insertAt = c.indexOf('    if (parsed.part_ka) searchTerms.push(parsed.part_ka);');
    if (insertAt > 0) {
      c = c.slice(0, insertAt) + block + '\n' + c.slice(insertAt);
      console.log('✅ eng→ka block გადაიტანა');
    }
  }
} else {
  console.log('eng→ka block position OK or not found');
}

fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
console.log('done');
