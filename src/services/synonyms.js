'use strict';

const GEO_AUTO_SYNONYMS = {
  // ─── სამუხრუჭე სისტემა ───────────────────────────────────────
  'კალოტკა':       ['სამუხრუჭე ხუნდი','brake pad','тормозная колодка','კალოდკა','კოლოდკა','ხუნდი'],
  'კალოდკა':       ['სამუხრუჭე ხუნდი','brake pad','тормозная колодка','კალოტკა','ხუნდი'],
  'ხუნდი':         ['სამუხრუჭე ხუნდი','brake pad','тормозная колодка','კალოტკა'],
  'ხუნდები':       ['სამუხრუჭე ხუნდი','brake pad','тормозная колодка'],
  'აპორნი':        ['სამუხრუჭე დისკი','brake disc','тормозной диск','დისკო'],
  'დისკო':         ['სამუხრუჭე დისკი','brake disc','тормозной диск'],
  'სუპორტი':       ['სამუხრუჭე სუპორტი','brake caliper','тормозной суппорт','калипер'],
  'ხადავოი':       ['ხელის მუხრუჭის ტროსი','handbrake cable','трос ручника'],
  'ბარაბანი':      ['სამუხრუჭე დოლი','brake drum','тормозной барабан'],

  // ─── დაკიდება ────────────────────────────────────────────────
  'გიტარა':        ['control arm','wishbone','рычаг подвески','ბერკეტი','მხარი'],
  'რაგატკა':       ['control arm','wishbone','рычаг подвески','გიტარა'],
  'მხარი':         ['control arm','wishbone','рычаг подвески','გიტარა'],
  'ბერკეტი':       ['control arm','wishbone','рычаг подвески'],
  'ქვედა გიტარა':  ['lower control arm','нижний рычаг','ქვედა ბერკეტი'],
  'ზედა გიტარა':   ['upper control arm','верхний рычаг','ზედა ბერკეტი'],
  'ბუქსა':         ['bushing','втулка','сайлентблок','silent block','სალტე','ვტულკა'],
  'ვტულკა':        ['bushing','втулка','сайლентблок','ბუქსა','სალტე'],
  'ნაკანეჩნიკი':   ['tie rod end','наконечник рулевой тяги','კანეჩნიკი'],
  'სტოიკა':        ['strut','стойка стабилизатора','stabilizer link','სტერჟინი'],
  'სტერჟინი':      ['stabilizer link','стойка стабилизатора','სტოიკა','sway bar link'],
  'ამორტი':        ['ამორტიზატორი','shock absorber','амортизатор','дуга'],
  'დუშკა':         ['ამორტიზატორი','shock absorber','амортизатор'],
  'ყუმბარა':       ['CV joint','ШРУС','შრუსი','გრანატა','ახლო'],
  'შრუსი':         ['CV joint','ШРУС','ყუმბარა','გრანატა'],
  'გრანატა':       ['CV joint','ШРУС','ყუმბარა','შრუსი'],
  'ახლო':          ['CV joint','ШРУС','ყუმბარა','шрус внутренний'],
  'სტუპიცა':       ['wheel hub','ступица','საბორბლე კვანძი'],
  'შარავო':        ['ball joint','шаровая опора','სახსარი','ტყვია'],
  'შარავოი':       ['ball joint','шаровая опора','შარავო','სახსარი'],
  'სახსარი':       ['ball joint','шаровая опора','შარავო'],
  'ტყვია':         ['ball joint','шаровая опора','შარავო'],
  'ტიაგა':         ['tie rod','рулевая тяга','საჭის ბოლო','ნარულინა'],
  'ნარულინა':      ['tie rod','рулевая тяга','ტიაგა'],
  'ტიაგები':       ['tie rod','рулевая тяга'],
  'რალე':          ['steering rack','рулевая рейка','საჭის კოლოფი'],
  'ბულინგი':       ['steering rack','рулевая рейка','რალე'],
  'ზამბარა':       ['coil spring','пружина подвески','spring'],
  'ზამბარები':     ['coil spring','пружина подвески'],
  'ვარდნილი':      ['leaf spring','рессора','ფოთოლა'],
  'ფოთოლა':       ['leaf spring','рессора','ვარდნილი'],
  'სვინგარმი':     ['trailing arm','рычаг задней подвески'],
  'ბრიჯი':         ['rear axle','задний мост','ხიდი'],
  'ხიდი':          ['rear axle','задний мост','ბრიჯი'],
  'რაზვალი':       ['camber bolt','болт развала','ексცენტრიკი'],

  // ─── ძრავი / გადაცემა ────────────────────────────────────────
  'ბაბინა':        ['ignition coil','катушка зажигания','კათუშა','coil'],
  'კათუშა':        ['ignition coil','катушка зажигания','ბაბინა'],
  'სვეჩი':         ['spark plug','свеча зажигания','სანთელი'],
  'სანთელი':       ['spark plug','свеча зажигания','სვეჩი'],
  'სალნიკი':       ['oil seal','сальник','ჩოხმბალი'],
  'ჩოხმბალი':      ['oil seal','сальник','სალნიკი'],
  'ველანი':        ['crankshaft','коленвал','კოლინვალი'],
  'კოლინვალი':    ['crankshaft','коленвал','ველანი'],
  'ველანის სალნიკი': ['crankshaft seal','сальник коленвала','crankshaft oil seal'],
  'ვიჟიმნოი':      ['clutch disc','диск сцепления','ვიჟიმნაია','ჩაშკა'],
  'ვიჟიმნაია':     ['clutch disc','диск сцепления','ვიჟიმნოი'],
  'ჩაშკა':         ['clutch pressure plate','корзина сцепления','კოჩანი'],
  'კოჩანი':        ['clutch pressure plate','корзина сцепления','ჩაშკა'],
  'ვადილო':        ['drive shaft','полуось','კარდანი'],
  'პოლუოსი':       ['drive shaft','полуось','ვადილო'],
  'კარდანი':       ['driveshaft','карданный вал','ვადილო'],
  'პომპა':         ['water pump','помпа','წყლის ტუმბო','насос охлаждения'],
  'ტუმბო':         ['water pump','помпа','წყლის ტუმბო'],
  'ღვედი':         ['timing belt','ремень ГРМ','გულსარტყელი','მატოს რემენი','belt'],
  'გულსარტყელი':  ['timing belt','ремень ГРМ','ღვედი'],
  'მატოს რემენი':  ['timing belt','ремень ГРМ','ღვედი'],
  'ცეპლენია':      ['timing chain','цепь ГРМ','ჯაჭვი','chain'],
  'ჯაჭვი':         ['timing chain','цепь ГРМ','ცეპლენია'],
  'ჩოგანი':        ['connecting rod','шатун','biela'],
  'ბიელი':         ['connecting rod','шатун','ჩოგანი'],
  'გენ':           ['alternator','генератор','გენერატორი','დინამო'],
  'დინამო':        ['alternator','генератор','გენერატორი'],
  'სტარტი':        ['starter','стартер','სტარტერი'],
  'ტიუნერი':       ['alternator','генератор','გენ'],
  'ინჟექტორი':     ['fuel injector','форсунка','ფორსუნკა'],
  'ფორსუნკა':      ['fuel injector','форсунка','ინჟექტორი'],
  'კარბიურატორი':  ['carburetor','карбюратор'],
  'გიდრაჩი':       ['power steering pump','насос ГУР','ჰიდრავლური ტუმბო'],
  'ვაკუუმი':       ['brake booster','вакуумный усилитель тормозов','vacuum pump'],
  'ბალახი':        ['gasket','прокладка','გასკეტი'],
  'გასკეტი':       ['gasket','прокладка','ბალახი','joint'],
  'ბოიოკი':        ['radiator','радиатор','რადიატორი'],
  'ვენტილატორი':   ['cooling fan','вентилятор охлаждения'],
  'ტერმოსტატი':    ['thermostat','термостат'],
  'ნაბეგი':        ['wheel bearing','подшипник ступицы','bearing race'],

  // ─── ფილტრები ────────────────────────────────────────────────
  'საჰაერო ფილტრი': ['ჰაერის ფილტრი','air filter','воздушный фильтр'],
  'ზეთის ფილტრი':   ['oil filter','масляный фильтр','маслофильтр'],
  'სალონის ფილტრი': ['cabin filter','фильтр салона','пыльцевой фильтр'],
  'საწვავის ფილტრი': ['fuel filter','топливный фильтр'],

  // ─── სხეული ──────────────────────────────────────────────────
  'პლასმასი':      ['bumper','бампер','ბამპერი'],
  'ბამპერი':       ['bumper','бампер','პლასმასი'],
  'ფარი':          ['headlight','фара','სანათი'],
  'ფანარი':        ['headlight','фара','ფარი'],
  'სარკე':         ['mirror','зеркало'],
  'კაპოტი':        ['hood','капот','bonnet'],
  'ტროსი':         ['cable','трос','wire'],
  'მაყუჩი':        ['ამორტიზატორი','shock absorber','амортизатор'],
  'ბოდა':          ['control arm','wishbone','рычаг','გიტარა'],
  'ბაქანი':        ['engine mount','подушка двигателя','ძრავის საყრდენი'],
  'სიჩქარის კოლოფი': ['gearbox','коробка передач','КПП'],
  'კოლოფი':       ['gearbox','коробка передач','transmission'],
};


// ═══════════════════════════════════════════════
// Vehicle Canonicalization — Model Aliases
// ═══════════════════════════════════════════════
const VEHICLE_ALIASES = {
  // Volkswagen Golf generations
  'golf 6':   ['golf vi','golf mk6','golfvi','golf6','golf mk 6','vw golf 6','volkswagen golf 6'],
  'golf vi':  ['golf 6','golf mk6','golfvi','golf6','vw golf vi'],
  'golf 5':   ['golf v','golf mk5','golf mk 5','vw golf 5'],
  'golf 7':   ['golf vii','golf mk7','vw golf 7'],
  'golf 4':   ['golf iv','golf mk4','vw golf 4'],
  // VW Passat
  'passat b6':  ['passat 2006','passat b 6','vw passat b6'],
  'passat b7':  ['passat 2011','passat b 7','vw passat b7'],
  'passat b5':  ['passat 2000','vw passat b5'],
  // BMW
  'bmw e90':  ['bmw 3 e90','3 series e90','e90','320d e90','bmw e90'],
  'bmw e60':  ['bmw 5 e60','5 series e60','e60','520d e60'],
  'bmw f10':  ['bmw 5 f10','5 series f10','f10','520d f10'],
  'bmw f30':  ['bmw 3 f30','3 series f30','f30','320d f30'],
  'bmw e46':  ['bmw 3 e46','3 series e46','e46'],
  'bmw e39':  ['bmw 5 e39','5 series e39','e39'],
  'bmw x5 e53': ['x5 e53','bmw x5 e53'],
  'bmw x5 f15': ['x5 f15','bmw x5 f15'],
  // Mercedes
  'mercedes w211': ['e-class w211','e class w211','w211','mercedes e w211','210'],
  'mercedes w212': ['e-class w212','e class w212','w212','mercedes e w212'],
  'mercedes w204': ['c-class w204','c class w204','w204','mercedes c w204'],
  'mercedes w203': ['c-class w203','c class w203','w203','mercedes c w203'],
  'mercedes w210': ['e-class w210','e class w210','w210','mercedes e w210'],
  'mercedes w220': ['s-class w220','s class w220','w220'],
  'mercedes w163': ['ml w163','mercedes ml163','w163'],
  'mercedes w164': ['ml w164','mercedes ml164','w164'],
  // Toyota
  'toyota camry xv50': ['camry xv50','camry 2012','camry 50'],
  'toyota camry xv40': ['camry xv40','camry 2006','camry 40'],
  'toyota corolla e150': ['corolla e150','corolla 2007'],
  'toyota land cruiser 200': ['lc200','land cruiser 200','prado 200'],
  // Hyundai/Kia
  'hyundai elantra md':  ['elantra md','elantra 2011'],
  'hyundai tucson ix35': ['tucson ix35','ix35'],
  'kia sportage sl':     ['sportage sl','sportage 2011'],
  // Make aliases
  'volkswagen': ['vw','фольксваген'],
  'mercedes':   ['mercedes-benz','мерседес','mers'],
  'bmw':        ['бмв','beha'],
  'toyota':     ['тойота'],
  'hyundai':    ['хёндай','хундай'],
};

function normalizeVehicleQuery(text) {
  if (!text) return text;
  const lower = text.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(VEHICLE_ALIASES)) {
    if (lower.includes(canonical) || aliases.some(a => lower.includes(a))) {
      return text + ' ' + canonical;
    }
  }
  return text;
}

function enrichWithSynonyms(text, existing = []) {
  const extras = [];
  const textLow = text.toLowerCase();
  for (const [slang, terms] of Object.entries(GEO_AUTO_SYNONYMS)) {
    const allTerms = [slang, ...terms];
    const match = allTerms.some(t => textLow.includes(t.toLowerCase()));
    if (match) extras.push(slang, ...terms);
  }
  return [...new Set([...existing, ...extras])];
}

module.exports = { enrichWithSynonyms, GEO_AUTO_SYNONYMS, VEHICLE_ALIASES, normalizeVehicleQuery };
