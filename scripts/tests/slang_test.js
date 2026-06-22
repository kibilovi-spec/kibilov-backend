require('dotenv').config();

const tests = [
  // Brakes
  {q:'კალოტკა', exp:100030}, {q:'კოლოდკა', exp:100030}, {q:'ხუნდი', exp:100030},
  {q:'კალოდკა', exp:100030}, {q:'ნაკანეჩნიკი', exp:100030}, {q:'სამუხრუჭე ხუნდი', exp:100030},
  {q:'წინა კალოტკა', exp:100030}, {q:'უკანა კალოტკა', exp:100030}, {q:'კალოტკები', exp:100030},
  {q:'колодки', exp:100030}, {q:'тормозные колодки', exp:100030}, {q:'brake pads', exp:100030},
  // Brake disc
  {q:'დისკი', exp:100032}, {q:'სამუხრუჭე დისკი', exp:100032}, {q:'ტორმუზის დისკი', exp:100032},
  // Shock absorber
  {q:'ამორტიზატორი', exp:100121}, {q:'სტოიკა', exp:100121}, {q:'ბულდოგი', exp:100121},
  {q:'ამორტ', exp:100121}, {q:'სტოიჩკა', exp:100121}, {q:'амортизатор', exp:100121},
  {q:'shock absorber', exp:100121}, {q:'ვიაბრაზნი', exp:100121},
  // CV Joint
  {q:'გრანატა', exp:100226}, {q:'შრუსი', exp:100226}, {q:'ყუმბარა', exp:100226},
  {q:'cv joint', exp:100226}, {q:'граната', exp:100226}, {q:'шрус', exp:100226},
  {q:'ახლო სახსარი', exp:100226}, {q:'გრანატი', exp:100226},
  // Steering
  {q:'რულავოი', exp:100012}, {q:'საჭის სისტემა', exp:100012}, {q:'steering', exp:100012},
  {q:'საჭე', exp:100012}, {q:'სარულე', exp:100012},
  // Tie rod
  {q:'ტიაგა', exp:100197}, {q:'სტერჟინი', exp:100197}, {q:'უდარნი', exp:100197},
  {q:'საჭის ბოლო', exp:100197}, {q:'рулевая тяга', exp:100197},
  // Engine mount
  {q:'პადმატორნი', exp:100076}, {q:'მატორის ბალიში', exp:100076}, {q:'ბალიში', exp:100076},
  {q:'engine mount', exp:100076}, {q:'подушка двигателя', exp:100076},
  // Wheel bearing
  {q:'სტუპიცა', exp:100579}, {q:'საკისარი', exp:100579}, {q:'პაჩებნიკი', exp:100579},
  {q:'ступица', exp:100579}, {q:'wheel bearing', exp:100579}, {q:'ბუქსა', exp:100579},
  // Ball joint
  {q:'შარავოი', exp:100581}, {q:'შარავი', exp:100581}, {q:'шаровая', exp:100581},
  {q:'ball joint', exp:100581}, {q:'ბოლჯოინტი', exp:100581},
  // Silent block
  {q:'სილენბლოკი', exp:100576}, {q:'ვტულკა', exp:100576}, {q:'сайлентблок', exp:100576},
  // Spring
  {q:'ზამბარა', exp:100126}, {q:'пружина', exp:100126}, {q:'coil spring', exp:100126},
  // Stabilizer
  {q:'სტაბილიზატორი', exp:100575}, {q:'стабилизатор', exp:100575},
  // Oil seal
  {q:'სალნიკი', exp:100231}, {q:'ჭობალი', exp:100231}, {q:'сальник', exp:100231}, {q:'oil seal', exp:100231},
  // Wishbone
  {q:'ბერკეტი', exp:100583}, {q:'რიჩაგი', exp:100583}, {q:'рычаг', exp:100583},
  // Clutch
  {q:'კლაჩი', exp:100051}, {q:'мурфტა', exp:100051}, {q:'clutch', exp:100051},
  {q:'ვიჟიმნოი', exp:100055}, {q:'ფერადო', exp:100053},
  // Filters
  {q:'ზეთის ფილტრი', exp:100259}, {q:'oil filter', exp:100259}, {q:'масляный фильтр', exp:100259},
  {q:'ჰაერის ფილტრი', exp:100260}, {q:'air filter', exp:100260},
  {q:'საწვავის ფილტრი', exp:100261}, {q:'fuel filter', exp:100261},
  {q:'სალონის ფილტრი', exp:100267}, {q:'cabin filter', exp:100267},
  // Engine
  {q:'ბაბინა', exp:100150}, {q:'ignition coil', exp:100150}, {q:'катушка зажигания', exp:100150},
  {q:'სანთელი', exp:100155}, {q:'spark plug', exp:100155}, {q:'свеча', exp:100155},
  {q:'სტარტერი', exp:100136}, {q:'starter', exp:100136}, {q:'стартер', exp:100136},
  {q:'გენერატორი', exp:100041}, {q:'alternator', exp:100041}, {q:'генератор', exp:100041},
  // Cooling
  {q:'პომპა', exp:100091}, {q:'water pump', exp:100091}, {q:'помпа', exp:100091},
  {q:'რადიატორი', exp:100092}, {q:'radiator', exp:100092}, {q:'радиатор', exp:100092},
  {q:'თერმოსტატი', exp:100096}, {q:'thermostat', exp:100096},
  // Timing
  {q:'ღვედი', exp:100452}, {q:'timing belt', exp:100452}, {q:'ремень грм', exp:100452},
  {q:'ჯაჭვი', exp:100454}, {q:'timing chain', exp:100454}, {q:'цепь грм', exp:100454},
  // Drive
  {q:'კარდანი', exp:100229}, {q:'drive shaft', exp:100229},
  {q:'ჯვარი', exp:100230}, {q:'universal joint', exp:100230},
  // Body
  {q:'ბამპერი', exp:100703}, {q:'bumper', exp:100703},
  {q:'კაპოტი', exp:100700}, {q:'hood', exp:100700},
  {q:'სარკე', exp:100714}, {q:'mirror', exp:100714},
  // Turbo
  {q:'ტურბო', exp:100062}, {q:'turbo', exp:100062},
  // Injection
  {q:'ინჟექტორი', exp:100303}, {q:'injector', exp:100303}, {q:'форсунка', exp:100303},
];

async function run() {
  let pass=0, fail=0;
  console.log('\n=== Georgian Slang Intelligence Engine — Full Test ===\n');
  
  for (const t of tests) {
    await new Promise(r => setTimeout(r, 2000)); // rate limit 2s
    const r = await fetch('http://localhost:3001/api/autodoc-search/search', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({make:'MERCEDES-BENZ', model:'C-Class', year:'2007', partQuery: t.q})
    });
    const d = await r.json();
    const got = d.categoryId;
    const ok = got === t.exp;
    if (ok) { pass++; process.stdout.write(`✅ "${t.q}" → ${got}\n`); }
    else { fail++; process.stdout.write(`❌ "${t.q}" → got:${got} exp:${t.exp}\n`); }
  }
  
  const total = pass+fail;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Georgian Slang: ${pass}/${total} = ${Math.round(pass/total*100)}%`);
  console.log(fail===0 ? '🏆 100% PERFECT!' : `❌ ${fail} შეცდომა`);
  process.exit(0);
}
run().catch(console.error);
