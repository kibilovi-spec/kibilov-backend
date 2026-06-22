const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

const old = `      const hasPartMatch = partKaLow && (name.includes(partKaLow) || altKeys.some(k => k.includes(partKaLow)));`;

const new1 = `      // loose part match — "სამუხრუჭე ხუნდი" matches "წინა/უკანა სამუხრუჭე ხუნდი"
      const partWords = partKaLow ? partKaLow.split(' ').filter(w => w.length > 2) : [];
      const hasPartMatch = partKaLow && (
        name.includes(partKaLow) ||
        altKeys.some(k => k.toLowerCase().includes(partKaLow)) ||
        (partWords.length > 1 && partWords.every(w => name.includes(w))) ||
        (partWords.length > 1 && altKeys.some(k => partWords.every(w => k.toLowerCase().includes(w))))
      );`;

if (c.includes(old)) {
  c = c.replace(old, new1);
  console.log('✅ loose part match დამატდა');
} else {
  console.log('❌ not found');
}
fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
