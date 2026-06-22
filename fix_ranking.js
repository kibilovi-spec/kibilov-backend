const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

const oldScore = `      if (partKaLow && name.includes(partKaLow)) score += 20;
      if (partKaLow && altKeys.some(k => k === partKaLow)) score += 20;`;

const newScore = `      if (partKaLow && name.includes(partKaLow)) score += 20;
      if (partKaLow && altKeys.some(k => k === partKaLow)) score += 20;
      // brand + model boost
      if (parsed.brand) {
        const brandLow = parsed.brand.toLowerCase();
        if (name.includes(brandLow)) score += 25;
        if (altKeys.some(k => k.includes(brandLow))) score += 20;
      }
      if (parsed.model) {
        const modelLow = parsed.model.toLowerCase();
        if (name.includes(modelLow)) score += 15;
        if (altKeys.some(k => k.includes(modelLow))) score += 12;
      }`;

if (c.includes(oldScore)) {
  c = c.replace(oldScore, newScore);
  console.log('✅ ranking boost დამატდა');
} else {
  console.log('❌ ვერ მოიძებნა');
}
fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
