const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

// Fix: brandTerms line რომელიც parsed-ს იყენებს OEM block-ში
c = c.replace(
  '      // brand/model სიტყვები ამოვიღოთ ranking-ისთვის\n    const brandTerms = [parsed.brand, parsed.model].filter(Boolean).map(t => t.toLowerCase());',
  '      // brand/model სიტყვები ამოვიღოთ ranking-ისთვის\n      const brandTerms = [];'
);

fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
console.log('✅ fixed');
