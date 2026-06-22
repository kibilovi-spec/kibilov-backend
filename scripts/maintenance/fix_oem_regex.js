const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

const oldRegex = "    const isOemCode = /^[A-Z0-9][\\w\\s\\-\\.]{3,25}$/i.test(message.trim()) && !/[ა-ჰ]/.test(message);";
const newRegex = `    // OEM კოდი: ციფრი+ასო, ლათინური, 6-20 სიმბოლო, ერთი სიტყვა
    const hasDigit = /[0-9]/.test(message);
    const hasLetter = /[A-Za-z]/.test(message);
    const hasGeorgian = /[ა-ჰ]/.test(message);
    const hasCyrillic = /[а-яА-Я]/.test(message);
    const wordCount = message.trim().split(/\\s+/).length;
    const isOemCode = hasDigit && hasLetter && !hasGeorgian && !hasCyrillic && wordCount <= 2 && message.trim().length >= 5 && message.trim().length <= 20;`;

if (c.includes(oldRegex)) {
  c = c.replace(oldRegex, newRegex);
  console.log('✅ OEM regex გასწორდა');
} else {
  console.log('❌ ვერ მოიძებნა, ვეძებ...');
  const idx = c.indexOf('isOemCode');
  console.log('line:', c.slice(Math.max(0,idx-5), idx+100));
}

fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
