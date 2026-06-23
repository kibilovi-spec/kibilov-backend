const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const autodoc = require('../services/autodoc');
const cache = require('../services/cache');
const { rankProducts, filterAvailable } = require('../services/rankingEngine');
const { selfHeal } = require('../services/selfHealingSearch');
const prisma = new PrismaClient();

// Search normalizer — typos და ვარიანტები
const SEARCH_ALIASES = {
  'კალოდკა': 'კალოტკა', 'კალოდი': 'კალოტკა', 'კოლოდკა': 'კალოტკა',
  'ხუნდები': 'ხუნდი', 'колодки': 'კალოტკა', 'brake pads': 'brake pad',
  'შარავოი': 'შარავო', 'шаровой': 'შარავო', 'ball joints': 'შარავო',
  'ამორტ': 'ამორტიზატორი', 'аморт': 'ამორტიზატორი', 'стойка': 'ამორტიზატორი',
  'ბაბინები': 'ბაბინა', 'катушка': 'ბაბინა', 'coil': 'ბაბინა',
  'სანთლები': 'სანთელი', 'свечи': 'სანთელი', 'plugs': 'სანთელი',
  'ზეთის ფილტრი': 'ზეთის ფილტ', 'масло фильтр': 'ზეთის ფილტ',
  'генератор': 'გენერატ', 'alternators': 'გენერატ',
  'стартер': 'სტარტერ', 'стартера': 'სტარტერ',
  'шрус': 'შრუსი', 'граната': 'გრანატა', 'cv joints': 'შრუსი', 'grenata': 'გრანატა', 'oil seal': 'სალნიკი', 'oilseal': 'სალნიკი',
  'მატორის ბალიში': 'engine mount', 'matoros balishi': 'engine mount',
  'კალოდკა': 'კალოტკა', 'колодка': 'კალოტკა', 'тормозные колодки': 'კალოტკა',
  'амортизатор': 'ამორტიზატორი', 'amorta': 'ამორტიზატორი',
  'ручка': 'სახელური', 'руль': 'საჭე',
  'подвеска': 'ხადავოი', 'suspension': 'ხადავოი',
  'ступица': 'სტუპიცა', 'подшипник': 'საკისარი',
  'шаровая': 'შარავოი', 'тяга': 'ტიაგა',
  'сцепление': 'კლაჩი', 'диск': 'დისკი',
  'свечи': 'სანთელი', 'катушка': 'ბაბინა',
  'помпа': 'პომპა', 'термостат': 'თერმოსტატი',
  'радиатор': 'რადიატორი', 'вентилятор': 'ვენტილატორი',
  'ремень': 'ღვედი', 'цепь': 'ჯაჭვი',
  'масло': 'ზეთი', 'фильтр': 'ფილტრი',
  'топливо': 'საწვავი', 'форсунка': 'ინჟექტორი',
  'генератор': 'გენერატორი', 'стартер': 'სტარტერი',
  'турбо': 'ტურბო', 'intercooler': 'ინტერქულერი',
  'glushak': 'გლუშაკი', 'глушак': 'გლუშიტელი',
  'brake': 'კალოტკა', 'brakes': 'კალოტკა',
  'ბარბაჩო': 'შარავო', 'барбачо': 'შარავო', 'barbacho': 'შარავო',
  'სამუხრუჭე დისკი': 'brake disc', 'დისკი': 'brake disc', 'brake disc': 'brake disc', 'ротор': 'brake disc',
  'oil': 'ზეთის ფილტრი', 'filter': 'ფილტრი',
  'сальник': 'სალნიკი', 'seal': 'სალნიკი',
  'подшипник': 'საკისარი', 'bearing': 'საკისარი',
  'საბუქსე': 'საკისარი', 'sabukse': 'საკისარი', 'ступица': 'სტუპიცა',
  'тяга': 'ტიაგა', 'tie rods': 'ტიაგა',
  'რულევი ტიაგა': 'ტიაგა', 'რულის ტიაგა': 'ტიაგა', 'საჭის ტიაგა': 'ტიაგა',
  'рейка': 'საჭის რეიკა', 'rack': 'საჭის რეიკა',
  'радиатор': 'რადიატორი', 'термостат': 'თერმოსტატი',
  'помпа': 'პომპა', 'water pumps': 'პომპა',
  'ремень': 'მატოს', 'timing belts': 'მატოს',
  'цепь': 'ჯაჭვი', 'timing chains': 'ჯაჭვი',
  'сцепление': 'კლაჩი', 'clutches': 'კლაჩი',
  'катализатор': 'კატალიზატ', 'каталист': 'კატალიზატ',
  'лямбда': 'ლამბდა', 'lambda': 'ლამბდა',
  'турбо': 'ტურბო', 'турбина': 'ტურბო',
  'подушка': 'ბალიში', 'mount': 'ბალიში',
  'прокладка': 'შუასადები', 'gaskets': 'შუასადები',
};

function normalizeQuery(q) {
  const lower = q.toLowerCase().trim();
  for (const [alias, canonical] of Object.entries(SEARCH_ALIASES)) {
    if (lower.includes(alias.toLowerCase())) {
      return lower.replace(alias.toLowerCase(), canonical.toLowerCase());
    }
  }
  return lower;
}

// კატეგორიების mapping — ქართული სლენგი → Autodoc categoryId
const CATEGORY_MAP = {
  'კუზაო': 100001, 'ძარა': 100001,
  'მატორის ბალიში': 100076, 'matoros balishi': 100076,
  'engine': 100002, 'მატორი': 100002, 'მოტორი': 100002, 'ძრავა': 100002,
  'გრემენი': 100003, 'გაზგამანაწილებელი მექანიზმი': 100003,
  'exhaust': 100004, 'გამონაბოლქვის სისტემა': 100004, 'გლუშიტელი': 100004, 'ვიხლოპი': 100004,
  'ფილტრები': 100005,
  'ტორმუზები': 100006, 'სამუხრუჭე სისტემა': 100006,
  'ანტიფრიზი': 100007, 'გაგრილების სისტემა': 100007, 'cooling': 100007, 'რადიატ.': 100007,
  'ელექტრიკა': 100010, 'ელექტროობა': 100010,
  'პადვესკა': 100011, 'სავალი ნაწილი': 100011, 'suspension': 100011, 'ხადავოი': 100011,
  'რულავოი': 100012, 'საჭის სისტემა': 100012, 'steering': 100012,
  'brake booster': 100025, 'ვაკუუმ-ბოსტერი': 100025,
  'brake master cylinder': 100026, 'სამუხრუჭე ცილინდრი': 100026,
  'brake caliper': 100027, 'caliper': 100027, 'სამუხრუჭე სუპორტი': 100027, 'სტრემიანკა': 100027, 'სტრემონკა': 100027, 'სუპორტი': 100027,
  'brake fluid': 100029, 'სამუხრუჭე სითხე': 100029, 'ტორმოზის სითხე': 100029,
  'brake pad': 100030, 'კალოდი': 100030, 'კალოდკა': 100030, 'კალოდკები': 100030, 'კალოტკა': 100030, 'ნაკანეჩნ': 100030, 'ნაკანეჩნიკი': 100030, 'ხუნდი': 100030,
  'brake disc': 100032, 'disk': 100032, 'დისკი': 100032, 'სამუხრუჭე დისკი': 100032, 'ტორმუზის დისკი': 100032,
  'ბარაბანი': 100033, 'brake drum': 100033, 'სამუხრუჭე დოლი': 100033,
  'handbrake': 100034, 'ручник': 100034, 'ხელის მუხრუჭი': 100034,
  'brake hose': 100035, 'სამუხრუჭე შლანგი': 100035,
  'brake lines': 100036, 'სამუხრუჭე მილი': 100036,
  'vacuum pump': 100039, 'ვაკუუმი': 100039, 'ვაკუუმ-ნასოსი': 100039, 'ვაკუმნასუსი': 100039,
  'starter parts': 100040, 'სტარტერის ნაწილები': 100040,
  'alternator': 100041, 'გენერატორი': 100041, 'დინამო': 100041, 'генератор': 100041,
  'battery': 100042, 'აკუმ': 100042, 'ბატარეა': 100042, 'аккумулятор': 100042,
  'headlight': 100043, 'фара': 100043, 'ნათურა': 100043, 'ფარი': 100043,
  'catalytic converter': 100047, 'катализатор': 100047, 'კატალიზატორი': 100047,
  'oxygen sensor': 100048, 'лямбда': 100048, 'ლამბდა': 100048,
  'clutch': 100051, 'сцепление': 100051, 'кулаче': 100051, 'муфта': 100051, 'мурфта': 100051, 'კლაჩი': 100051, 'მუფტა': 100051,
  'clutch disc': 100053, 'диск сцепления': 100053, 'კლაჩის დისკი': 100053, 'ფერადო': 100053,
  'clutch release bearing': 100055, 'ვიჟიმნოი': 100055, 'კლაჩის საკისარი': 100055,
  'turbo': 100062, 'ტურბო': 100062,
  'crankshaft': 100066, 'коленвал': 100066, 'კოლმასრა': 100066,
  'camshaft': 100067, 'распредвал': 100067, 'ბუნკი': 100067, 'რასპრედვალი': 100067,
  'valve': 100073, 'клапан': 100073, 'ახველი': 100073, 'კლაპანი': 100073, 'სარქველი': 100073,
  'engine mount': 100076, 'подушка двигателя': 100076, 'ბალიში': 100076, 'ძრავის საყრდენი': 100076, 'პადმატორნი': 100076, 'padmatorna': 100076, 'მატ. ბალიში': 100076,
  'gasket': 100078, 'გალოვკის შუასადები': 100078, 'შუასადები': 100078,
  'oil pan': 100082, 'კარტერი': 100082,
  'water pump': 100091, 'помпа': 100091, 'პომპა': 100091, 'ტოსოლის პომპა': 100091, 'წყლის ტუმბო': 100091,
  'radiator': 100092, 'радиатор': 100092, 'რადიატორი': 100092,
  'coolant': 100094, 'антифриз': 100094, 'ანტიფრიზი': 100094,
  'thermostat': 100096, 'термостат': 100096, 'თერმოსტატი': 100096,
  'fan': 100098, 'вентилятор': 100098, 'ვენტილატორი': 100098, 'ვინტილატორი': 100098,
  'compressor': 100114, 'კომპრესორი': 100114, 'კონდიციონერი': 100114,
  'intercooler': 100115, 'გამაგრილებელი': 100115, 'ინტერქულერი': 100115,
  'shock absorber': 100121, 'амортизатор': 100121, 'ამორტიზატორი': 100121, 'ბულდოგი': 100121, 'ვიაბრაზნი': 100121, 'პადვესნოი': 100121, 'სტოიკა': 100121, 'სტოიკი': 100121,
  'coil spring': 100126, 'пружина': 100126, 'ზამბარა': 100126, 'სუსპენზიის ზამბარა': 100126,
  'wiper': 100133, 'ჯაგრისი': 100133, 'მინასაწმენდი': 100133,
  'alternator parts': 100135, 'starter': 100136, 'стартер': 100136, 'სტარტერი': 100136, 'ბენდექსი': 100136,
  'ignition coil': 100150, 'катушка зажигания': 100150, 'ბაბინა': 100150,
  'spark plug': 100155, 'свеча': 100155, 'სანთელი': 100155,
  'cable': 100158, 'ტროსი': 100158,
  'steering rack': 100190, 'рулевая рейка': 100190, 'რეიკა': 100190, 'საჭის რეიკა': 100190,
  'power steering pump': 100192, 'насос гур': 100192, 'საჭის ნასოსი': 100192,
  'inner tie rod': 100197, 'рулевая тяга': 100197, 'საჭის ბოლო': 100197, 'საჭის ტიაგა': 100197, 'სტეჟინი': 100197, 'სტერჟინი': 100197, 'ტიაგა': 100197, 'ტიაგი': 100197, 'უდარნი': 100197,
  'cv joint': 100226, 'шрус': 100226, 'კვ სახსარი': 100226, 'შრუსი': 100226, 'ყუმბარა': 100226, 'გრანატა': 100226, 'გრენატა': 100226,
  'drive shaft': 100229, 'кардан': 100229, 'კარდანი': 100229,
  'universal joint': 100230, 'крестовина': 100230, 'ჯვარი': 100230,
  'oil seal': 100231, 'oilseal': 100231, 'oil-seal': 100231, 'сальник': 100231, 'ჩობალი': 100231, 'ჭობალი': 100231, 'სალნიკი': 100231,
  'oil filter': 100259, 'масляный фильтр': 100259, 'ზეთის ფილტრი': 100259, 'ზეთფილტრი': 100259,
  'air filter': 100260, 'воздушный фильтр': 100260, 'ჰაერის ფილტრი': 100260, 'ჰაერფილტრი': 100260,
  'fuel filter': 100261, 'топливный фильтр': 100261, 'საწვავის ფილტრი': 100261,
  'cabin filter': 100267, 'салонный фильтр': 100267, 'სალონის ფილტრი': 100267,
  'fuel pump': 100302, 'топливный насос': 100302, 'თელი': 100302, 'საწვავის ტუმბო': 100302,
  'injector': 100303, 'форсунка': 100303, 'ინჟექტორი': 100303,
  'timing belt': 100452, 'ремень грм': 100452, 'ბელტი': 100452, 'გრმ': 100452, 'მატოს რემენი': 100452, 'ღვედი': 100452,
  'belt tensioner': 100453, 'დამჭიმი': 100453, 'ღვედის დამჭიმი': 100453, 'ღვედის დამჭიმი როლიკი': 100453, 'როლიკი': 100453,
  'timing chain': 100454, 'цепь грм': 100454, 'ჯაჭვი': 100454, 'ცეპი': 100454,
  'pulley': 100456, 'კალენვალის შკივი': 100456, 'შკივი': 100456,
  'sensor': 100487, 'датчик': 100487, 'დაჩიკი': 100487, 'სენსორი': 100487,
  'abs sensor': 100493, 'датчик абс': 100493, 'abs სენსორი': 100493,
  'stabilizer': 100575, 'стабилизатор': 100575, 'სტაბილიზატორი': 100575,
  'silent block': 100576, 'сайлентблок': 100576, 'სილენბლოკი': 100576, 'ვტულკა': 100576, 'ტულკა': 100576,
  'wheel bearing': 100579, 'подшипник': 100579, 'პაჩებნიკი': 100579, 'სტუპიცა': 100579, 'სტუპიცის პაჩებნიკი': 100579, 'სტუპიცის საკისარი': 100579, 'წინა სტუპიცის საკისარი': 100579, 'წინა სტუპიცის პაჩებნიკი': 100579, 'საკისარი': 100579, 'საკისრები': 100579, 'პოლუოსის საკისარი': 100579, 'პოლუოსის პაჩებნიკი': 100579, 'უკანა სტუპიცის საკისარი': 100579, 'უკანა სტუპიცის პაჩებნიკი': 100579, 'ступица': 100579, 'ступичный подшипник': 100579,
  'ball joint': 100581, 'шаровая': 100581, 'შარავი': 100581, 'შარავო': 100581, 'შარავოი': 100581,
  'wishbone': 100583, 'рычаг': 100583, 'ბერკეტი': 100583, 'ქვედა ბერკეტი': 100583, 'რიჩაგი': 100583,
  'exhaust system': 100046, 'выхлоп': 100046, 'ამომყვანი': 100046, 'გლუშაკი': 100046, 'გლუშიტელი': 100046,
  'hood': 100700, 'капот': 100700, 'კაპოტი': 100700,
  // დამატებითი ქართული სლენგი
  'კალოტკები': 100030, 'წინა კალოტკა': 100030, 'უკანა კალოტკა': 100030, 'სამუხრუჭე ხუნდი': 100030, 'ხუნდები': 100030,
  'ამორტ': 100121, 'ამორტი': 100121, 'სტოიჩკა': 100121,
  'გრანატი': 100226, 'ახლო სახსარი': 100226,
  'საჭე': 100012, 'სარულე': 100012,
  'ბუქსა': 100579, 'ბუქსი': 100579,
  'ბოლ-ჯოინტი': 100581, 'ბოლჯოინტი': 100581,
  'ამონაბოლქვი': 100046, 'ამომყვანი მილი': 100046,
  'გრმ ღვედი': 100452, 'ვარვარი': 100452,
  'ძრავი': 100002,
  'გადამრთველი': 100010, 'ელ. სისტემა': 100010,
  'კვების ბლოკი': 100010, 'გამათბობელი': 100007,
  'პომპი': 100091, 'ტოსოლი': 100094,
  'ანთება': 100150, 'ანთების სისტემა': 100150,
  'ზეთი': 100259, 'საპოხი': 100259,
  'ჰაერი': 100260, 'სალონი': 100267,
  'საწვავი': 100261, 'ბენზინი': 100261,
  'გამარტივება': 100051, 'ფორსუნკა': 100303,
  'ინჟექცია': 100303, 'ინჟექტ': 100303,
  'ტუმბო': 100302, 'ბალასტი': 100042,
  'შუქი': 100043, 'ნათ': 100043,
  'სარკეები': 100714, 'კარი': 100714,
  'bumper': 100703, 'бампер': 100703, 'ბამპერი': 100703,
  'mirror': 100714, 'სარკე': 100714,
};

function getCategoryId(query) {
  const normalized = normalizeQuery(query);
  const q = normalized.toLowerCase();
  const orig = query.toLowerCase();

  // longest match პირველ რიგში (უფრო სპეციფიკური)
  let bestKey = '', bestId = null;
  for (const [key, id] of Object.entries(CATEGORY_MAP)) {
    const k = key.toLowerCase();
    if ((q.includes(k) || orig.includes(k)) && k.length > bestKey.length) {
      bestKey = k; bestId = id;
    }
  }
  if (bestId !== null) return bestId;
  return 100030;
}

// vehicleId cache-დან ან Autodoc-იდან

// Vehicle Generation Year Aliases
// Vehicle family + year routing
const VEHICLE_FAMILY_MAP = {
  'transit': {
    family: ['transit', 't-12', 't-15', 'v-184', 'v-347'],
    yearMap: {
      '1986-2000': 't-12',
      '2000-2006': 'v-184',
      '2006-2014': 'v-347',
    }
  },
  'e90': { family: ['3 series', 'e90', '320', '318', '316', '325', '330'] },
  'e46': { family: ['3 series', 'e46', '318', '320', '323', '325', '328', '330'] },
  'e39': { family: ['5 series', 'e39', '520', '523', '525', '528', '530', '535'] },
  'w204': { family: ['c-class', 'w204', 'c180', 'c200', 'c220', 'c250', 'c300'] },
  'w211': { family: ['e-class', 'w211', 'e200', 'e220', 'e270', 'e280', 'e320'] },
  'w124': { family: ['e-class', 'w124', '200', '220', '230', '250', '280', '300', '320'] },
  'w210': { family: ['e-class', 'w210', 'e200', 'e220', 'e230', 'e280', 'e320'] },
  'golf 6': { family: ['golf vi', 'golf 6', 'golf mk6'] },
  'golf 7': { family: ['golf vii', 'golf 7', 'golf mk7'] },
  'pajero io': { family: ['pajero', 'pajero io', 'pajero i/o'] },
  'pajero': { family: ['pajero', 'pajero ii', 'pajero iii', 'pajero iv'] },
  'land cruiser': { family: ['land cruiser', 'landcruiser', 'lc'] },
  'camry': { family: ['camry', 'camry v30', 'camry v40', 'camry v50', 'camry v70'] },
  'corolla': { family: ['corolla', 'auris'] },
};

function resolveVehicleFamily(model, year) {
  if (!model) return null;
  const m = model.toLowerCase();
  for (const [key, data] of Object.entries(VEHICLE_FAMILY_MAP)) {
    if (m.includes(key) || data.family.some(f => m.includes(f))) {
      // year-based routing
      if (year && data.yearMap) {
        const y = parseInt(year);
        for (const [range, variant] of Object.entries(data.yearMap)) {
          const [from, to] = range.split('-').map(Number);
          if (y >= from && y <= to) return variant;
        }
      }
      return data.family[0];
    }
  }
  return null;
}

const VEHICLE_ALIASES = {
  'golf 6':   [2008,2013], 'golf vi':  [2008,2013], 'golf6': [2008,2013],
  'golf 7':   [2012,2021], 'golf vii': [2012,2021], 'golf7': [2012,2021],
  'golf 5':   [2003,2009], 'golf v':   [2003,2009],
  'golf 4':   [1997,2006], 'golf iv':  [1997,2006],
  'passat b6':[2005,2011], 'passat b7':[2010,2015], 'passat b5':[1996,2005],
  'e90':      [2004,2012], 'e46':      [1997,2006], 'f30':      [2011,2019],
  'e60':      [2003,2010], 'e39':      [1995,2004],
  'w204':     [2007,2014], 'w211':     [2002,2009], 'w212':     [2009,2016],
  'w210':     [1995,2003], 'w203':     [2000,2007],
};

function filterVehiclesByAlias(vehicles, query) {
  if (!vehicles || !vehicles.length) return vehicles;
  const q = (query||'').toLowerCase();
  let range = null;
  for (const [key, yrs] of Object.entries(VEHICLE_ALIASES)) {
    if (q.includes(key)) { range = yrs; break; }
  }
  if (!range) return vehicles;
  const [yF, yT] = range;
  const filtered = vehicles.filter(v => {
    const vF = parseInt(v.yearFrom || v.year_from || 0);
    const vT = parseInt(v.yearTo   || v.year_to   || 9999);
    return vF <= yT && vT >= yF;
  });
  console.log('[year-filter]', query, vehicles.length, '->', filtered.length, 'range:', yF, yT);
  return filtered.length > 0 ? filtered : vehicles;
}

async function resolveVehicleId(vin, make, model, year, partQuery) {
  // VIN-ით
  if (vin) {
    // Redis cache
    const redisKey = `vin:${vin.toUpperCase()}`;
    const redisCached = await cache.get(redisKey);
    if (redisCached) return { ...redisCached, fromCache: true };

    const cached = await prisma.$queryRaw`
      SELECT vehicle_id FROM vehicle_cache WHERE vin = ${vin.toUpperCase()} LIMIT 1
    `;
    if (cached.length) {
      const result = { vehicleId: cached[0].vehicle_id, fromCache: true };
      await cache.set(redisKey, result, cache.TTL.VIN);
      return result;
    }

    const raw = await autodoc.vinCheck(vin);
    const v = raw?.data?.matchingVehicles?.array?.[0];
    if (!v) return null;

    await prisma.$executeRaw`
      INSERT INTO vehicle_cache (vehicle_id, vin, manufacturer, model, year, engine)
      VALUES (${String(v.vehicleId)}, ${vin.toUpperCase()}, ${v.carName?.split(' ')[0] || ''}, ${v.vehicleTypeDescription || ''}, '', '')
      ON CONFLICT (vehicle_id) DO UPDATE SET vin = EXCLUDED.vin
    `;
    return { vehicleId: v.vehicleId, carName: v.carName, fromCache: false };
  }

  // make/model/year-ით — manufacturers → models → vehicles
  if (make && model) {
    // Make name normalization map
    const MAKE_ALIASES = {
      'VW': 'VOLKSWAGEN', 'VOLKSWAGEN': 'VW',
      'MERCEDES': 'MERCEDES-BENZ', 'MB': 'MERCEDES-BENZ',
      'MERCEDES-BENZ': 'MERCEDES-BENZ',
      'VAZ': 'LADA', 'LAND-ROVER': 'LAND ROVER',
    };
    const makeUpper = make.toUpperCase();
    const _manuKey = 'autodoc:manufacturers:type1';
    let manuData = await cache.get(_manuKey);
    if (!manuData) {
      manuData = await autodoc.getManufacturersByType(1);
      if (manuData) await cache.set(_manuKey, manuData, 86400 * 30);
    }
    const makes = manuData?.manufacturers || [];
    let manu = makes.find(m => m.manufacturerName.toUpperCase() === makeUpper);
    if (!manu && MAKE_ALIASES[makeUpper]) {
      const alias = MAKE_ALIASES[makeUpper];
      manu = makes.find(m => m.manufacturerName.toUpperCase() === alias.toUpperCase());
    }
    // fallback — word boundary match (not substring)
    if (!manu) {
      manu = makes.find(m => {
        const n = m.manufacturerName.toUpperCase();
        return n === makeUpper || n.startsWith(makeUpper + ' ') || n.endsWith(' ' + makeUpper);
      });
    }
    if (!manu) return null;

    const _modelKey = `autodoc:models:${manu.manufacturerId}`;
    let modelData = await cache.get(_modelKey);
    if (!modelData) {
      modelData = await autodoc.getModelsByManufacturer(manu.manufacturerId);
      if (modelData) await cache.set(_modelKey, modelData, 86400 * 30);
    }
    // Model name aliases
    const MODEL_ALIASES = {
      '3 series': '3', '5 series': '5', '7 series': '7',
      '1 series': '1', '2 series': '2', '4 series': '4', '6 series': '6',
      'x3': 'X3', 'x5': 'X5', 'x1': 'X1', 'x6': 'X6',
      'transit': 'TRANSIT Bus', 'c-class': 'C-CLASS', 'e-class': 'E-CLASS',
      's-class': 'S-CLASS', 'a-class': 'A-CLASS', 'b-class': 'B-CLASS',
      'glc': 'GLC', 'gle': 'GLE', 'gla': 'GLA',
      'golf vi': 'GOLF VI', 'golf v': 'GOLF V', 'golf iv': 'GOLF IV',
      'golf 6': 'GOLF VI', 'golf 7': 'GOLF VII', 'golf 5': 'GOLF V', 'golf 4': 'GOLF IV',
      'fit': 'JAZZ I (AA)', 'honda fit': 'JAZZ I (AA)',
  'pajeri': 'pajero', 'pajeri io': 'pajero io',
    };
    // vehicle family resolver
    const familyResolved = resolveVehicleFamily(model, year);
    const modelNorm = MODEL_ALIASES[model.toLowerCase()] || familyResolved || model;
    const allModels = modelData?.models || [];
    // scoring-based model match
    let mod = null;
    let bestScore = 0;
    const y = year ? parseInt(year) : null;
    for (const m of allModels) {
      let sc = 0;
      const mn = m.modelName.toLowerCase();
      const norm = modelNorm.toLowerCase();
      if (mn === norm) sc += 100;
      else if (mn.startsWith(norm)) sc += 60;
      else if (mn.includes(norm)) sc += 20;
      if (sc === 0) continue;
      if (y) {
        const from = m.modelYearFrom ? new Date(m.modelYearFrom).getFullYear() : 0;
        const to = m.modelYearTo ? new Date(m.modelYearTo).getFullYear() : 9999;
        if (y >= from && y <= to) sc += 50;
      }
      if (sc > bestScore) { bestScore = sc; mod = m; }
    }
    if (!mod) return null;

    const _vehicleKey = `autodoc:vehicles:${mod.modelId}`;
    let vehicleData = await cache.get(_vehicleKey);
    if (!vehicleData) {
      vehicleData = await autodoc.getVehicleListByModel(mod.modelId);
      if (vehicleData) await cache.set(_vehicleKey, vehicleData, 86400 * 30);
    }
    const variants = vehicleData?.modelTypes || [];

    // წელის მიხედვით ფილტრი
    let vehicle = variants[0];
    if (year) {
      const y = parseInt(year);
      // პირველი: ზუსტი match
      let match = variants.find(v => {
        const from = new Date(v.modelYearFrom).getFullYear();
        const to = v.modelYearTo ? new Date(v.modelYearTo).getFullYear() : 9999;
        return y >= from && y <= to;
      });
      // თუ ზუსტი არ იპოვა: +/-1 წლის buffer (Golf 6 type fix)
      if (!match) {
        match = variants.find(v => {
          const from = new Date(v.modelYearFrom).getFullYear() - 1;
          const to = (v.modelYearTo ? new Date(v.modelYearTo).getFullYear() : 9999) + 1;
          return y >= from && y <= to;
        });
      }
      if (match) vehicle = match;
    }
    if (!vehicle) return null;

    // vehicle_cache-ში შევინახოთ
    try {
      await prisma.$executeRaw`
        INSERT INTO vehicle_cache (vehicle_id, manufacturer, model, year, engine, fuel)
        VALUES (${String(vehicle.vehicleId)}, ${manu.manufacturerName}, ${mod.modelName}, ${year||''}, ${vehicle.typeEngineName||''}, '')
        ON CONFLICT (vehicle_id) DO NOTHING
      `;
    } catch(e) { console.error('cache insert:', e.message); }

    return { vehicleId: vehicle.vehicleId, carName: `${manu.manufacturerName} ${mod.modelName}`, fromCache: false };
  }

  return null;
}

// POST /api/autodoc-search/search
router.post('/search', async (req, res) => {
  try {
    const { vin, partQuery, make, model, year } = req.body;
    if (!partQuery) return res.status(400).json({ error: 'partQuery საჭიროა' });
    if (!vin && !make) return res.status(400).json({ error: 'vin ან make/model საჭიროა' });

    // Search cache key
    const searchKey = `search:${(vin||'').toUpperCase()}:${(make||'').toUpperCase()}:${(model||'').toUpperCase()}:${(year||'')}:${normalizeQuery(partQuery)}`;
    const cachedSearch = await cache.get(searchKey);
    if (cachedSearch) return res.json({ ...cachedSearch, fromCache: true });

    const categoryId = getCategoryId(partQuery);

    // Vehicle resolve
    const vehicle = await resolveVehicleId(vin, make, model, year, partQuery);
    if (!vehicle) return res.json({ error: 'მანქანა ვერ მოიძებნა', oemCodes: [], products: [] });

    // Cache შემოწმება
    const cached = await prisma.$queryRaw`
      SELECT oem_code FROM vehicle_oem
      WHERE vehicle_id = ${String(vehicle.vehicleId)} AND category = ${String(categoryId)}
      LIMIT 100
    `;
    let oemCodes = cached.map(r => r.oem_code);

    if (!oemCodes.length) {
      // Autodoc-დან მოვიღოთ
      const _artKey = `autodoc:articles:${vehicle.vehicleId}:${categoryId}`;
      let artData = await cache.get(_artKey);
      if (!artData) {
        artData = await autodoc.getArticlesByVehicle(vehicle.vehicleId, categoryId);
        if (artData) await cache.set(_artKey, artData, 43200);
      }
      const articleIds = (artData?.articles || []).map(a => a.articleId);

      if (articleIds.length) {
        const _oemKey = `autodoc:oems:${[...articleIds].slice(0,20).sort((a,b)=>Number(a)-Number(b)).join(',')}`;
        let oems = await cache.get(_oemKey);
        if (!oems) {
          oems = await autodoc.getOemsByArticleIds(articleIds.slice(0, 20));
          if (oems) await cache.set(_oemKey, oems, 86400 * 30);
        }
        oemCodes = (oems?.articles || [])
          .flatMap(a => a.oemNo?.map(o => o.oemDisplayNo.replace(/[\s\-\._\/\(\)\[\]]/g, '').toUpperCase()) || [])
          .filter((v, i, arr) => arr.indexOf(v) === i);

        for (const code of oemCodes) {
          await prisma.$executeRaw`
            INSERT INTO vehicle_oem (vehicle_id, oem_code, category)
            VALUES (${String(vehicle.vehicleId)}, ${code}, ${String(categoryId)})
            ON CONFLICT (vehicle_id, oem_code) DO NOTHING
          `;
        }
      }
    }

    // OEM კოდებიდან aftermarket კოდები Autodoc-ით
    const allSearchCodes = new Set(oemCodes);
    const KEY = process.env.RAPIDAPI_KEY;
    const HOST = 'autodoc-parts-catalog.p.rapidapi.com';
    const hdrs = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };
    const _sleep = ms => new Promise(r => setTimeout(r, ms));

    for (const oem of oemCodes.slice(0, 3)) {
      try {
        const url = 'https://' + HOST + '/api/artlookup/search-articles-by-article-no?langId=4&articleNo=' 
          + encodeURIComponent(oem) + '&articleType=OENumber';
        const r = await fetch(url, { headers: hdrs });
        if (r.status === 429) { console.log('[artlookup] 429 rate limit'); break; }
        const d = await r.json();
        for (const a of (d?.articles || [])) {
          if (a.articleNo) allSearchCodes.add(a.articleNo.replace(/[\s\-\._\/\(\)\[\]]/g,'').toUpperCase());
        }
        await _sleep(350);
      } catch(e) {}
    }

    const searchCodesArr = [...allSearchCodes];

    // DB ძებნა — კატეგორიის mapping Autodoc → kibilov
    const CAT_TO_KIBILOV = {
      100030: 'brake-pads', 100032: 'brake-discs', 100033: 'brake-drums',
      100027: 'brake-calipers', 100121: 'shock-absorbers', 100581: 'ball-joints',
      100579: 'wheel-bearings', 100197: 'tie-rods', 100575: 'stabilizers',
      100583: 'control-arms', 100126: 'springs', 100576: 'silent-blocks',
      100259: 'oil-filters', 100260: 'air-filters', 100261: 'fuel-filters', 100267: 'cabin-filters',
      100452: 'timing-belts', 100454: 'timing-chains', 100091: 'water-pumps',
      100150: 'ignition-coils', 100155: 'spark-plugs', 100135: 'alternators',
      100136: 'starters', 100229: 'drive-shafts', 100226: 'cv-joints',
      100231: 'oil-seals', 100051: 'clutch', 100055: 'clutch-bearings',
      100190: 'steering-racks', 100192: 'steering-pumps',
      100092: 'radiators', 100096: 'thermostats', 100047: 'catalysts',
    };

    const products = await prisma.product.findMany({
      where: { alternativeSearchKeys: { hasSome: searchCodesArr } },
      take: 50,
      select: {
        id: true, nameKa: true, nameEn: true, price: true, stock: true,
        sku: true, images: true, oemCodes: true, categoryId: true, brand: true
      }
    });

    // nameKa-ში კატეგორიის სიტყვების შემოწმება
    const CAT_KEYWORDS = {
      100030: ['ხუნდი','კალოტკა','ნაკანეჩნიკი','brake pad','კალოდი','სამუხრუჭე ხუნდი'],
      100032: ['სამუხრუჭე დისკი','brake disc','ტორმუზის დისკი'],
      100033: ['ბარაბანი','brake drum','სამუხრუჭე დოლი'],
      100027: ['სუპორტი','სტრემიანკა','caliper','სამუხრუჭე სუპ'],
      100121: ['ამორტიზატორი','სტოიკა','shock absorber','ბულდოგი'],
      100581: ['შარავო','შარავოი','ball joint'],
      100579: ['საკისარი','პაჩებნიკი','სტუპიცა','bearing'],
      100197: ['ტიაგა','სტერჟინი','tie rod','ტიაგ'],
      100259: ['ზეთის ფილტ','oil filter'],
      100260: ['ჰაერის ფილტ','air filter'],
      100261: ['საწვავის ფილტ','fuel filter'],
      100267: ['სალონის ფილტ','cabin filter'],
      100452: ['მატოს','timing belt','ღვედი','ремень'],
      100454: ['ჯაჭვი','timing chain','цепь'],
      100150: ['ბაბინა','ignition coil','катушка'],
      100155: ['სანთელი','spark plug','свеча'],
      100041: ['გენერატ','alternator','დინამო'],
      100135: ['გენერატ','alternator','დინამო'],
      100136: ['სტარტერ','starter','стартер','ბენდექს'],
      100047: ['კატალიზატ','catalytic','катализ'],
      100048: ['ლამბდა','oxygen sensor','лямбда'],
      100051: ['კლაჩი','clutch','მუფტა','ფერადო'],
      100055: ['ვიჟიმნოი','release bearing','კლაჩის საკ'],
      100226: ['შრუსი','cv joint','ყუმბარა'],
      100229: ['კარდანი','drive shaft'],
      100231: ['სალნიკი','oil seal','ჩობალი'],
      100190: ['საჭის რეიკა','steering rack','რეიკა'],
      100192: ['საჭის ნასოს','power steering'],
      100092: ['რადიატორი','radiator'],
      100096: ['თერმოსტატი','thermostat'],
    };

    const keywords = CAT_KEYWORDS[categoryId] || [];
    let filtered = products;
    if (keywords.length > 0) {
      const keyFiltered = products.filter(p => {
        const name = (p.nameKa || '').toLowerCase();
        return keywords.some(k => name.includes(k.toLowerCase()));
      });
      // keyword ფილტრი — თუ 0 მოიძებნა, ცარიელი დავაბრუნოთ (არასწორი პროდუქტები არ გამოვიტანოთ)
      filtered = keyFiltered;
    }

    let finalProducts = rankProducts(filtered.slice(0, 50)).slice(0, 20);
    // Self-Healing — თუ 0 შედეგია
    if (!finalProducts.length && partQuery) {
      console.log('[search] 0 results, triggering self-heal');
      const healed = await selfHeal(partQuery, vehicle?.vehicleId, categoryId, prisma);
      if (healed.length > 0) {
        finalProducts = healed;
        console.log(`[search] self-heal found ${healed.length} products`);
      }
    }

    // Search result cache
    const searchResult = {
      vehicle: vehicle.carName, categoryId,
      oemCodes: oemCodes.slice(0, 10),
      products: finalProducts,
      fromCache: cached.length > 0
    };
    await cache.set(searchKey, searchResult, cache.TTL.SEARCH);

    // Knowledge Base logging
    try {
      const normalized = normalizeQuery(partQuery);
      await prisma.$executeRaw`
        INSERT INTO search_knowledge (query, normalized, category_id, result_count, success)
        VALUES (${partQuery}, ${normalized}, ${categoryId}, ${finalProducts.length}, ${finalProducts.length > 0})
      `;
    } catch(e) {}

    // Search Analytics INSERT
    try {
      const _brand = make || vehicle?.make || null;
      const _model = model || vehicle?.model || null;
      const _year  = String(year || vehicle?.year || '');
      await prisma.$executeRaw`
        INSERT INTO search_analytics (query, brand, model, year, part_ka, results_count, clicked, cart_added, purchased)
        VALUES (${partQuery}, ${_brand}, ${_model}, ${_year}, ${partQuery}, ${finalProducts.length}, false, false, false)
      `;
    } catch(e) {}

    res.json(searchResult);

  } catch (e) {
    console.error('[autodoc-search]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
