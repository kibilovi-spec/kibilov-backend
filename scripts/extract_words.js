
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: { nameKa: true }
  });
  
  const words = new Set();
  products.forEach(p => {
    const parts = (p.nameKa || '').split(/[|,\s]+/);
    parts.forEach(w => {
      w = w.trim();
      if (w.length >= 4 && /[\u10D0-\u10FF]/.test(w)) words.add(w);
    });
  });
  
  const sorted = [...words].sort();
  require('fs').writeFileSync('/tmp/ka_words.txt', sorted.join('\n'));
  console.log('უნიკალური ქართული სიტყვები:', sorted.length);
}
main().catch(console.error).finally(() => process.exit());
