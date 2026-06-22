/**
 * NHTSA + carapi.app integration test
 * უფასო, API key არ სჭირდება
 */

async function decodeVIN(vin) {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${vin}?format=json`;
  const r = await fetch(url);
  const data = await r.json();
  const res = data.Results?.[0];
  if (!res) return null;
  return {
    make: res.Make || null,
    model: res.Model || null,
    year: res.ModelYear || null,
    engine: res.DisplacementL ? res.DisplacementL + 'L' : null,
    fuel: res.FuelTypePrimary || null,
    bodyClass: res.BodyClass || null,
    cylinders: res.EngineCylinders || null,
  };
}

// ტესტი
async function test() {
  const vins = [
    'WBAPH7C51BE678254', // BMW 3 Series
    '1HGCM82633A004352', // Honda Accord
    'JT2BF22K1Y0284273', // Toyota Camry
    'WDD2050431A123456', // Mercedes
  ];
  
  for (const vin of vins) {
    const r = await decodeVIN(vin);
    console.log(vin, '→', r);
  }
}

test().catch(console.error);
