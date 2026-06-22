const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

const old = `    const text = response.content[0].text.trim().replace(/\`\`\`json\\n?/g, '').replace(/\`\`\`/g, '').trim();
    const parsed = JSON.parse(text);`;

const newParse = `    const rawResp = response.content[0].text.trim();
    // JSON-ი ამოვიღოთ — markdown code blocks, extra text
    const jsonMatch2 = rawResp.match(/\\{[\\s\\S]*\\}/);
    const text = jsonMatch2 ? jsonMatch2[0] : rawResp.replace(/\`\`\`json\\n?/g,'').replace(/\`\`\`/g,'').trim();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch(jsonErr) {
      console.log('JSON parse error, raw:', rawResp.slice(0,100));
      parsed = { brand: null, model: null, year: null, engine: null, part_ka: null, part_en: null, search_terms: [] };
    }`;

if (c.includes(old)) {
  c = c.replace(old, newParse);
  console.log('✅ JSON parse გაუმჯობესდა');
} else {
  console.log('❌ not found');
}
fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
