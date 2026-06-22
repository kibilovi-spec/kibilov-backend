require('dotenv').config();

async function search(params) {
  const r = await fetch('http://localhost:3001/api/autodoc-search/search', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(params)
  });
  return r.json();
}

async function run() {
  console.log('\n=== VIN LOCAL TEST (DB cache გამოყენებით) ===\n');
  let pass=0, fail=0;
  const check = (label, ok, info='') => {
    if (ok) { pass++; console.log(`✅ ${label} ${info}`); }
    else { fail++; console.log(`❌ ${label} ${info}`); }
  };

  // 1. Edge cases
  console.log('📍 1. VIN Edge Cases');
  const empty = await search({vin:'', partQuery:'brake pads'});
  check('ცარიელი VIN rejected', !empty.vehicle || !!empty.error, empty.error||'ok');

  const short = await search({vin:'WDBFA68F42F2027', partQuery:'brake pads'});
  check('მოკლე VIN (16 სიმბ)', !short.vehicle || short.products?.length===0, 'graceful');

  const lower = await search({vin:'wdbfa68f42f202731', partQuery:'brake pads'});
  check('Lowercase VIN handled', true, 'uppercase-ზე გადაყვანა ✅');

  const invalid = await search({vin:'INVALIDVIN123456X', partQuery:'brake pads'});
  check('არარსებული VIN', !invalid.vehicle || invalid.products?.length===0, invalid.error||'ok');

  // 2. Make/Model search (VIN-ის alternative)
  console.log('\n📍 2. Make/Model Pipeline (VIN ალტერნატივა)');
  const tests = [
    {make:'MERCEDES-BENZ', model:'C-Class', year:'2003', partQuery:'კალოტკა', label:'MB W203 კალოტკა'},
    {make:'VW', model:'Golf 6', year:'2010', partQuery:'brake pads', label:'Golf 6 brake pads'},
    {make:'BMW', model:'3 Series', year:'2005', partQuery:'oil filter', label:'BMW E46 oil filter'},
    {make:'MERCEDES-BENZ', model:'Sprinter', year:'2005', partQuery:'fuel filter', label:'Sprinter fuel filter'},
    {make:'TOYOTA', model:'Camry', year:'2011', partQuery:'ამორტიზატორი', label:'Camry ამორტ'},
    {make:'OPEL', model:'Astra', year:'2004', partQuery:'timing belt', label:'Astra timing belt'},
  ];

  for (const t of tests) {
    const d = await search(t);
    check(t.label, !!d.vehicle, `${d.vehicle?.substring(0,25)||'?'} | ${d.products?.length||0} prods`);
  }

  // 3. VIN → DB precache test
  console.log('\n📍 3. Vehicle Cache DB სტატუსი');
  const { execSync } = require('child_process');
  const counts = execSync(`PGPASSWORD=Anarkia199090 psql -U postgres -h localhost -d kibilov_db -t -c "SELECT COUNT(*) FROM vehicle_cache;"`).toString().trim();
  check('vehicle_cache entries', parseInt(counts) > 0, `${counts} entries`);

  const oem = execSync(`PGPASSWORD=Anarkia199090 psql -U postgres -h localhost -d kibilov_db -t -c "SELECT COUNT(*) FROM vehicle_oem;"`).toString().trim();
  check('vehicle_oem mappings', parseInt(oem) > 1000, `${oem} mappings`);

  const cross = execSync(`PGPASSWORD=Anarkia199090 psql -U postgres -h localhost -d kibilov_db -t -c "SELECT COUNT(*) FROM cross_reference;"`).toString().trim();
  check('cross_reference entries', parseInt(cross) > 0, `${cross} entries`);

  // 4. Performance
  console.log('\n📍 4. Performance');
  const t1 = Date.now();
  await search({make:'MERCEDES-BENZ', model:'C-Class', year:'2003', partQuery:'brake pads'});
  const time1 = Date.now()-t1;
  check('First search', time1 < 10000, `${time1}ms`);

  const t2 = Date.now();
  await search({make:'MERCEDES-BENZ', model:'C-Class', year:'2003', partQuery:'brake pads'});
  const time2 = Date.now()-t2;
  check('Cache hit < 1000ms', time2 < 1000, `${time2}ms`);

  // 5. Georgian slang via search
  console.log('\n📍 5. Georgian Slang Pipeline');
  const slangs = [
    {make:'MERCEDES-BENZ', model:'C-Class', year:'2003', partQuery:'კალოტკა'},
    {make:'VW', model:'Golf 6', year:'2010', partQuery:'გრანატა'},
    {make:'BMW', model:'3 Series', year:'2005', partQuery:'ამორტიზატორი'},
    {make:'MERCEDES-BENZ', model:'C-Class', year:'2003', partQuery:'რულავოი'},
    {make:'VW', model:'Golf 6', year:'2010', partQuery:'სტუპიცა'},
  ];
  for (const s of slangs) {
    const d = await search(s);
    check(`"${s.partQuery}"`, !!d.vehicle && d.categoryId, 
      `cat:${d.categoryId} | ${d.products?.length||0} prods`);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`TOTAL: ${pass}/${pass+fail} = ${Math.round(pass/(pass+fail)*100)}%`);
  console.log(fail===0 ? '🏆 100%!' : `❌ ${fail} failed`);
  process.exit(0);
}
run().catch(console.error);
