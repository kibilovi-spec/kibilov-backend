const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');
const lines = c.split('\n');

lines.forEach((line, i) => {
  if (line.includes('const parsed') || line.includes('const parsed2')) {
    console.log(i+1, ':', line.trim());
  }
});

// line 645 — scan route-შია, chat route-ში შეიცვალოს
// chat route-ის parsed (line 308) სწორია
// scan route-ს parsed → parsedScan
c = c.replace(
  /\/\/ JSON თუ დაბრუნდა structured data[\s\S]*?const parsed = JSON\.parse/,
  (match) => match.replace('const parsed = JSON.parse', 'const parsedScan = JSON.parse')
);
c = c.replace(
  /if \(parsedScan\.vin\)/g, 'if (parsedScan && parsedScan.vin)'
);
// fix scan route references
const scanStart = c.indexOf('// JSON თუ დაბრუნდა structured data');
if (scanStart > 0) {
  const scanEnd = c.indexOf('module.exports', scanStart);
  let scanSection = c.slice(scanStart, scanEnd);
  scanSection = scanSection
    .replace(/parsed\.vin/g, 'parsedScan.vin')
    .replace(/parsed\.brand/g, 'parsedScan.brand')
    .replace(/parsed\.model/g, 'parsedScan.model')
    .replace(/parsed\.year/g, 'parsedScan.year')
    .replace(/const parsed2/g, 'const parsedPart');
  c = c.slice(0, scanStart) + scanSection + c.slice(scanEnd);
  console.log('✅ scan route parsed -> parsedScan');
}

fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
