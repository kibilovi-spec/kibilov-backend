const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-backend/src/routes/ai.js', 'utf8');

const nhtsaHelper = `
// NHTSA VIN Decoder
async function decodeVINWithNHTSA(vin) {
  try {
    const url = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/' + vin + '?format=json';
    const r = await fetch(url);
    const data = await r.json();
    const res = data.Results && data.Results[0];
    if (!res || !res.Make) return null;
    return {
      make: res.Make || null,
      model: res.Model || null,
      year: res.ModelYear || null,
      engine: res.DisplacementL ? parseFloat(res.DisplacementL).toFixed(1) + 'L' : null,
      fuel: res.FuelTypePrimary || null,
      bodyClass: res.BodyClass || null,
      cylinders: res.EngineCylinders || null,
      vin: vin.toUpperCase(),
    };
  } catch(e) { return null; }
}
`;

const routerLine = "const router = express.Router();";
if (!c.includes('decodeVINWithNHTSA')) {
  c = c.replace(routerLine, routerLine + '\n' + nhtsaHelper);
  console.log('NHTSA helper added');
}

// VIN auto-detection in chat
const oldChat = "const { message, context } = req.body;";
const newChat = `const { message, context } = req.body;
    const vinMatch = message && message.trim().match(/\\b([A-HJ-NPR-Z0-9]{17})\\b/i);
    if (vinMatch) {
      const nhtsaData = await decodeVINWithNHTSA(vinMatch[1]);
      if (nhtsaData && nhtsaData.make) {
        return res.json({
          type: 'vin_decoded',
          parsed: { brand: nhtsaData.make, model: nhtsaData.model, year: nhtsaData.year, engine: nhtsaData.engine, search_terms: [] },
          vin: nhtsaData,
          products: [],
          count: 0,
          message: 'VIN: ' + nhtsaData.year + ' ' + nhtsaData.make + ' ' + (nhtsaData.model||'') + ' ' + (nhtsaData.engine||'') + ' — ახლა მიუთითეთ საჭირო ნაწილი.'
        });
      }
    }`;

if (c.includes(oldChat) && !c.includes('vinMatch')) {
  c = c.replace(oldChat, newChat);
  console.log('VIN auto-detection added');
}

fs.writeFileSync('/var/www/kibilov-backend/src/routes/ai.js', c);
console.log('Done!');
