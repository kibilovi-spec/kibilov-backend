const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

// fix JSON extraction
const old1 = "const rawRespText = response.content[0].text.trim();\n    // JSON extraction — markdown code blocks გამოვიღოთ\n    const jsonMatch = rawRespText.match(/\\{[\\s\\S]*\\}/);\n    const rawText = jsonMatch ? jsonMatch[0] : rawRespText;";
const new1 = "const rawRespText = response.content[0].text.trim();\n    const jsonMatch = rawRespText.match(/\\{[\\s\\S]*\\}/);\n    const rawText = jsonMatch ? jsonMatch[0] : rawRespText;";

// fix part_ka field
const old2 = "partKa: parsed.part_ka || null,";
const new2 = "part_ka: parsed.part_ka || null,";

if (c.includes('rawRespText')) {
  console.log('✅ JSON extraction უკვე არსებობს');
} else {
  c = c.replace(
    "const rawText = response.content[0].text.trim();",
    "const rawRespText = response.content[0].text.trim();\n    const jsonMatch = rawRespText.match(/{[\\s\\S]*}/);\n    const rawText = jsonMatch ? jsonMatch[0] : rawRespText;"
  );
  console.log('✅ JSON extraction დამატდა');
}

if (c.includes('partKa:')) {
  c = c.replace('partKa: parsed.part_ka || null,', 'part_ka: parsed.part_ka || null,');
  console.log('✅ partKa -> part_ka გასწორდა');
}

fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
console.log('done');
