// Direct require — autodoc_search module-ის გამოყენება
// მხოლოდ getCategoryId ფუნქციის ტესტი

const fs = require('fs');
const code = fs.readFileSync('./src/routes/autodoc_search.js', 'utf8');

// ამოვიღოთ CATEGORY_MAP, ALIASES, normalizeQuery, getCategoryId
// და შევქმნათ isolated module
const moduleCode = `
${code.match(/const SEARCH_ALIASES[\s\S]+?};/)[0]}
${code.match(/const CATEGORY_MAP[\s\S]+?};/)[0]}
${code.match(/function normalizeQuery[\s\S]+?\n}/)[0]}
${code.match(/function getCategoryId[\s\S]+?\n}/)[0]}
module.exports = { getCategoryId };
`;

const tmpPath = '/tmp/cat_test_module.js';
fs.writeFileSync(tmpPath, moduleCode);
const { getCategoryId } = require(tmpPath);

const tests = [
  {q:'კალოტკა', exp:100030}, {q:'კოლოდკა', exp:100030}, {q:'ხუნდი', exp:100030},
  {q:'კალოდკა', exp:100030}, {q:'ნაკანეჩნიკი', exp:100030}, {q:'სამუხრუჭე ხუნდი', exp:100030},
  {q:'წინა კალოტკა', exp:100030}, {q:'კალოტკები', exp:100030},
  {q:'колодки', exp:100030}, {q:'brake pads', exp:100030},
  {q:'დისკი', exp:100032}, {q:'სამუხრუჭე დისკი', exp:100032},
  {q:'ამორტიზატორი', exp:100121}, {q:'სტოიკა', exp:100121}, {q:'ბულდოგი', exp:100121},
  {q:'ამორტ', exp:100121}, {q:'амортизатор', exp:100121}, {q:'shock absorber', exp:100121},
  {q:'გრანატა', exp:100226}, {q:'შრუსი', exp:100226}, {q:'cv joint', exp:100226},
  {q:'граната', exp:100226}, {q:'шрус', exp:100226}, {q:'ყუმბარა', exp:100226},
  {q:'რულავოი', exp:100012}, {q:'steering', exp:100012}, {q:'საჭე', exp:100012},
  {q:'ტიაგა', exp:100197}, {q:'სტერჟინი', exp:100197}, {q:'рулевая тяга', exp:100197},
  {q:'პადმატორნი', exp:100076}, {q:'მატორის ბალიში', exp:100076}, {q:'ბალიში', exp:100076},
  {q:'engine mount', exp:100076}, {q:'подушка двигателя', exp:100076},
  {q:'სტუპიცა', exp:100579}, {q:'საკისარი', exp:100579}, {q:'ступица', exp:100579},
  {q:'wheel bearing', exp:100579}, {q:'ბუქსა', exp:100579},
  {q:'შარავოი', exp:100581}, {q:'შარავი', exp:100581}, {q:'шаровая', exp:100581},
  {q:'ball joint', exp:100581}, {q:'ბოლჯოინტი', exp:100581},
  {q:'სილენბლოკი', exp:100576}, {q:'ვტულკა', exp:100576}, {q:'сайлентблок', exp:100576},
  {q:'ზამბარა', exp:100126}, {q:'пружина', exp:100126}, {q:'coil spring', exp:100126},
  {q:'სტაბილიზატორი', exp:100575}, {q:'стабилизатор', exp:100575},
  {q:'სალნიკი', exp:100231}, {q:'ჭობალი', exp:100231}, {q:'сальник', exp:100231},
  {q:'oil seal', exp:100231},
  {q:'ბერკეტი', exp:100583}, {q:'რიჩაგი', exp:100583}, {q:'рычаг', exp:100583},
  {q:'კლაჩი', exp:100051}, {q:'clutch', exp:100051}, {q:'мурфта', exp:100051},
  {q:'ვიჟიმნოი', exp:100055}, {q:'ფერადო', exp:100053},
  {q:'ზეთის ფილტრი', exp:100259}, {q:'oil filter', exp:100259},
  {q:'ჰაერის ფილტრი', exp:100260}, {q:'air filter', exp:100260},
  {q:'საწვავის ფილტრი', exp:100261}, {q:'fuel filter', exp:100261},
  {q:'სალონის ფილტრი', exp:100267}, {q:'cabin filter', exp:100267},
  {q:'ბაბინა', exp:100150}, {q:'ignition coil', exp:100150},
  {q:'სანთელი', exp:100155}, {q:'spark plug', exp:100155}, {q:'свеча', exp:100155},
  {q:'სტარტერი', exp:100136}, {q:'starter', exp:100136}, {q:'стартер', exp:100136},
  {q:'გენერატორი', exp:100041}, {q:'alternator', exp:100041}, {q:'генератор', exp:100041},
  {q:'პომპა', exp:100091}, {q:'water pump', exp:100091}, {q:'помпа', exp:100091},
  {q:'რადიატორი', exp:100092}, {q:'radiator', exp:100092},
  {q:'თერმოსტატი', exp:100096}, {q:'thermostat', exp:100096},
  {q:'ღვედი', exp:100452}, {q:'timing belt', exp:100452}, {q:'ремень грм', exp:100452},
  {q:'ჯაჭვი', exp:100454}, {q:'timing chain', exp:100454},
  {q:'კარდანი', exp:100229}, {q:'drive shaft', exp:100229},
  {q:'ჯვარი', exp:100230}, {q:'universal joint', exp:100230},
  {q:'ბამპერი', exp:100703}, {q:'bumper', exp:100703},
  {q:'კაპოტი', exp:100700}, {q:'hood', exp:100700},
  {q:'სარკე', exp:100714}, {q:'mirror', exp:100714},
  {q:'ტურბო', exp:100062}, {q:'turbo', exp:100062},
  {q:'ინჟექტორი', exp:100303}, {q:'injector', exp:100303}, {q:'форсунка', exp:100303},
];

let pass=0, fail=0;
console.log('\n=== LOCAL SLANG TEST (no API) ===\n');
for (const t of tests) {
  const got = getCategoryId(t.q);
  const ok = got === t.exp;
  if (ok) { pass++; process.stdout.write(`✅ "${t.q}"\n`); }
  else { console.log(`❌ "${t.q}" → got:${got} exp:${t.exp}`); fail++; }
}
const total = pass+fail;
console.log(`\n${'='.repeat(40)}`);
console.log(`${pass}/${total} = ${Math.round(pass/total*100)}%`);
console.log(fail===0 ? '🏆 100% PERFECT!' : `❌ ${fail} fixes needed`);
