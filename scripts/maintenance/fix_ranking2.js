const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

// part match უფრო მაღალი სქორი
const old = `      if (partKaLow && name.includes(partKaLow)) score += 20;
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

const newScore = `      if (partKaLow && name.includes(partKaLow)) score += 40;
      if (partKaLow && altKeys.some(k => k === partKaLow)) score += 35;
      // brand + model boost — მხოლოდ თუ part match გვაქვს
      const hasPartMatch = partKaLow && (name.includes(partKaLow) || altKeys.some(k => k.includes(partKaLow)));
      if (parsed.brand) {
        const brandLow = parsed.brand.toLowerCase();
        if (name.includes(brandLow)) score += hasPartMatch ? 20 : 5;
        if (altKeys.some(k => k.includes(brandLow))) score += hasPartMatch ? 15 : 3;
      }
      if (parsed.model) {
        const modelLow = parsed.model.toLowerCase();
        if (name.includes(modelLow)) score += hasPartMatch ? 15 : 3;
        if (altKeys.some(k => k.includes(modelLow))) score += hasPartMatch ? 12 : 2;
      }`;

if (c.includes(old)) {
  c = c.replace(old, newScore);
  console.log('✅ ranking rebalanced');
} else {
  console.log('❌ not found');
}
fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
