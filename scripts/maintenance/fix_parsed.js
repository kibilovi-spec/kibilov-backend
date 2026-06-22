const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

// პრობლემა: OEM block იყენებს `parsed` const-ს სანამ AI response-ს parse-ავს
// გამოსავალი: OEM block-ი გადავიტანოთ AI call-ის შემდეგ, ან const->let გავხადოთ

// ვნახოთ სად არის parsed declaration
const parsedIdx = c.indexOf('    const parsed = JSON.parse(');
const oemIdx = c.indexOf('    const oemMatch =');

console.log('parsed at:', parsedIdx);
console.log('oemMatch at:', oemIdx);

if (oemIdx > 0 && parsedIdx > 0 && oemIdx < parsedIdx) {
  console.log('OEM block is BEFORE parsed — this is the bug');
  
  // OEM block-ი ამოვიღოთ და parsed-ის შემდეგ გადავიტანოთ
  const oemStart = c.indexOf('    // OEM code detection');
  const oemEnd = c.indexOf('\n    }', oemIdx) + 6;
  
  if (oemStart > 0 && oemEnd > oemStart) {
    const oemBlock = c.slice(oemStart, oemEnd + 1);
    c = c.slice(0, oemStart) + c.slice(oemEnd + 1);
    
    // parsed-ის შემდეგ ჩავსვათ
    const afterParsed = c.indexOf('    if (parsed.year && parsed.model)');
    if (afterParsed > 0) {
      c = c.slice(0, afterParsed) + oemBlock + '\n\n    ' + c.slice(afterParsed);
      console.log('✅ OEM block გადავიდა parsed-ის შემდეგ');
    }
  }
} else {
  console.log('სხვა პრობლემა — ვსწორავთ const->let');
  // fallback: ვნახოთ შეცდომის ადგილი
  const lines = c.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('const parsed') || line.includes('oemMatch')) {
      console.log(i+1, ':', line.trim());
    }
  });
}

fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
