const express = require('express');
const router = express.Router();

// Autodoc VIN Decoder

async function decodeVINWithAutodoc(vin) {
  try {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    if (!RAPIDAPI_KEY) return null;
    const headers = { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com' };
    // Step 1: tecdoc-vin-check — vehicleId-ი თუ მოვიდა
    const r1 = await fetch(`https://autodoc-parts-catalog.p.rapidapi.com/api/vin/tecdoc-vin-check/${vin}`, { headers });
    const d1 = await r1.json().catch(() => null);
    let vehicleId = null;
    let make = null, model = null, year = null, engine = null;
    if (d1 && d1.data && Array.isArray(d1.data.matchingVehicles) && d1.data.matchingVehicles.length > 0) {
      const v = d1.data.matchingVehicles[0];
      vehicleId = v.vehicleId || v.id || null;
      make = v.manufacturerName || null;
      model = v.modelName || v.vehicleName || null;
      year = v.yearOfConstrFrom || null;
      engine = v.engineCode || v.engineName || null;
    }
    // Step 2: თუ tecdoc-მ ვერ მისცა — decoder-v3 fallback
    if (!make) {
      await new Promise(r => setTimeout(r, 150));
      const r2 = await fetch(`https://autodoc-parts-catalog.p.rapidapi.com/api/vin/decoder-v3/${vin}`, { headers });
      const d2 = await r2.json().catch(() => null);
      if (Array.isArray(d2)) {
        for (const block of d2) {
          if (block && block.information) {
            if (block.information.Manufacturer) make = (block.information.Manufacturer.split(/\s+/)[0] || '').toUpperCase();
            if (block.information.Model) model = block.information.Model;
            if (block.information.Year) year = parseInt(block.information.Year);
          }
        }
      }
    }
    if (!make) return null;
    return { make, model, year, engine, fuel: null, vin: vin.toUpperCase(), vehicleId };
  } catch(e) { return null; }
}


async function autodocSearchByPart(brand, partEn) {
  try {
    if (!brand || !partEn) return [];
    const key = process.env.RAPIDAPI_KEY;
    if (!key) return [];
    const url = `https://autodoc-parts-catalog.p.rapidapi.com/api/searchcat/lang-id/4/term/${encodeURIComponent(partEn)}`;
    const r = await fetch(url, { headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'autodoc-parts-catalog.p.rapidapi.com' } });
    if (!r.ok) return [];
    const d = await r.json();
    if (!Array.isArray(d)) return [];
    return d.slice(0, 5).map(c => ({ categoryId: c.categoryId || c.id, name: c.categoryName || c.name, brand }));
  } catch(e) { return []; }
}

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const GENERATIONS = {
  'Golf 3': ['1991','1992','1993','1994','1995','1996','1997','1998','Golf III','Golf3'],
  'Golf 4': ['1997','1998','1999','2000','2001','2002','2003','2004','Golf IV','Golf4'],
  'Golf 5': ['2003','2004','2005','2006','2007','2008','Golf V','Golf5'],
  'Golf 6': ['2008','2009','2010','2011','2012','2013','Golf VI','Golf6','Golf V-VI','Golf V- VI','Golf 6','MK6'],
  'Golf 7': ['2012','2013','2014','2015','2016','2017','2018','2019','Golf VII','Golf7'],
  'Astra F': ['1991','1992','1993','1994','1995','1996','1997','1998'],
  'Astra G': ['1998','1999','2000','2001','2002','2003','2004','2005'],
  'Astra H': ['2004','2005','2006','2007','2008','2009','2010'],
  'E90': ['2005','2006','2007','2008','2009','2010','2011','2012','BMW 3'],
  'W204': ['2007','2008','2009','2010','2011','2012','2013','2014','C-Class'],
};

const YEAR_MISMATCH = {
  'Golf 6': { maxYear: 2013, redirect: 'Golf 7' },
  'Golf 5': { maxYear: 2009, redirect: 'Golf 6' },
  'Golf 4': { maxYear: 2005, redirect: 'Golf 5' },
  'W204':   { maxYear: 2014, redirect: 'W205' },
  'E90':    { maxYear: 2012, redirect: 'F30' },
};

const SYSTEM_PROMPT = `შენ ხარ kibilov.ge-ის AI ასისტენტი — ქართული ავტონაწილების ექსპერტი.
შენ იცი ყველა ავტომობილის მარკა, მოდელი, თაობა, ძრავი და ნაწილი.
შენი ამოცანაა მომხმარებლის ტექსტიდან ზუსტად ამოიღო მანქანის და ნაწილის ინფორმაცია.

=== ენების მხარდაჭერა ===
ქართული: კალოტკა, გიტარა, ამორტი, ბუქსა...
რუსული სლენგი: нексия=Nexia, приора=Priora, семерка=Lada 2107, девятка=Lada 2109
ინგლისური: brake pad, shock absorber, CV joint...
შერეული: "w210 ამორტი", "e90 კალოტკა", "pajero io გრანატა"

=== ქართული სლენგის სრული ლექსიკონი ===
სამუხრუჭე:
კალოტკა/კალოდკა/კოლოდკა/ხუნდი = სამუხრუჭე ხუნდი = brake pad
აპორნი/დისკო = სამუხრუჭე დისკი = brake disc
სუპორტი = სამუხრუჭე სუპორტი = brake caliper
ხადავოი = ხელის მუხრუჭის ტროსი = handbrake cable
ბარაბანი = სამუხრუჭე დოლი = brake drum

დაკიდება:
გიტარა/რაგატკა/მხარი/ბერკეტი/ბოდა = control arm = wishbone
ქვედა გიტარა = lower control arm
ზედა გიტარა = upper control arm
ბუქსა/საბუქსე/ვტულკა/ტულკა/ნაკანეჩნიკი = bushing
სტოიკა/სტოიჩკა = strut mount / stabilizer link
ამორტი/დუშკა = ამორტიზატორი = shock absorber
სტერჟინი/სტაბი/ჩხირი = stabilizer link = стабилизатор
ყუმბარა/შრუსი/გრანატა/ახლო = CV joint = ШРУС
სტუპიცა/ბოიოკი_ბრეგელი = wheel hub = ступица
ბუქსა_სარკინო/სარკინე = wheel bearing
ტიაგა/ნარულინა = tie rod = рулевая тяга
ნაკანეჩნიკი/კანეჩნიკი = tie rod end = наконечник рулевой тяги
რალე/ჩხირი_სარულე = steering rack = рулевая рейка
შარავო/შარავოი/ბოლთი = ball joint = шаровая опора
რაზვალი = camber adjustment = развал
სვინგარმი = trailing arm = рычаг задней подвески

ძრავი:
ბაბინა/კათუშკა = ignition coil = катушка зажигания
სანთელი/სვეჩი = spark plug = свеча зажигания
სალნიკი/ჩოხმბალი = oil seal = сальник
ველანი/კოლინვალი = crankshaft = коленвал
ველანის სალნიკი = crankshaft seal = сальник коленвала
ვიჟიმნოი/ვიჟიმნაია/ჩაშკა/კორზინა = clutch disc/pressure plate
კოჩანი = clutch pressure plate = корзина сцепления
ვადილო/პოლუოსი = drive shaft = полуось
პომპა/ტუმბო = water pump = помпа
ბელტი/ღვედი/რემენი/მატოს_რემენი = timing belt = ремень ГРМ
ზეთის ტუმბო/მასლინაჩოსი = oil pump = масляный насос
ინჟექტორი/ფორსუნკა = fuel injector = форсунка
გენერატორი/დინამო/ალტერნატორი = alternator = генератор
სტარტერი/ამრთველი = starter motor = стартер
ტიუნერი = alternator = генератор
თვითონ_კოლოფი/კოლოფი = gearbox = коробка передач
ტუმბო_ჰგ/გიდრაჩი = power steering pump = насос ГУР
ვენტილატორი/ვეველა = cooling fan = вентилятор
ტერმოსტატი/ტერმოზი = thermostat = термостат
ბოიოკი/რადიატორი = radiator = радиатор
ანტიფრიზი/ტოსოლი = coolant = антифриз

ფილტრები:
ჰაერის ფილტრი/საჰაერო ფილტრი = air filter
ზეთის ფილტრი = oil filter
სალონის ფილტრი = cabin filter = салонный фильтр
საწვავის ფილტრი = fuel filter = топливный фильтр

სხვა:
ბამპერი/პლასმასი = bumper
ფარი/ფანარი = headlight = фара
სარკე = mirror = зеркало
მინა = glass/window = стекло
კაპოტი = hood = капот
ბაგაჟი = trunk = багажник
კარი = door = дверь
ტროსი = cable = трос

=== პოზიციის ზუსტი პარსინგი ===
ᲛᲜᲘᲨᲕᲜᲔᲚᲝᲕᲐᲜᲘ: პოზიცია part_ka-ში უნდა შევიდეს, არა ცალკე!
წინა = front → "წინა სამუხრუჭე ხუნდი" (არა "სამუხრუჭე ხუნდი" + position=front)
უკანა = rear → "უკანა ამორტიზატორი"
მარცხენა = left, მარჯვენა = right
ზედა = upper, ქვედა = lower
შიგნითა/შიდა = inner, გარეთა/გარე = outer
ველანზე = on crankshaft → "ველანის სალნიკი" (crankshaft oil seal)
ძრავზე = engine side, კოლოფზე = gearbox side

=== მანქანის თაობების ცოდნა ===
BMW: E21(75-83 3ser), E30(82-91 3ser), E36(90-99 3ser), E46(97-06 3ser), E90(05-12 3ser), F30(11-19 3ser), G20(18- 3ser)
E28(81-88 5ser), E34(88-96 5ser), E39(95-03 5ser), E60(03-10 5ser), F10(09-17 5ser), G30(17- 5ser)
E32(86-94 7ser), E38(94-01 7ser), E65(01-08 7ser), F01(08-15 7ser)
E53(99-06 X5), E70(06-13 X5), F15(13-18 X5), G05(18- X5)
E83(03-10 X3), F25(10-17 X3), G01(17- X3)
Mercedes: W123(76-85 E), W124(84-95 E), W210(95-03 E), W211(02-09 E), W212(09-16 E), W213(16- E)
W201(82-93 C/190), W202(93-00 C), W203(00-07 C), W204(07-14 C), W205(14- C)
W140(91-98 S), W220(98-05 S), W221(05-13 S)
W163(97-05 ML), W164(05-11 ML), W166(11-19 ML)
W638(96-03 Vito), W639(03-14 Vito/Viano), W447(14- Vito)
W903(95-06 Sprinter), W906(06-18 Sprinter), W907(18- Sprinter)
VW: Golf1(74-83), Golf2(83-92), Golf3(91-98), Golf4(97-04), Golf5(03-08), Golf6(08-13), Golf7(12-20), Golf8(19-)
Passat B1(73-80), B2(80-88), B3(88-93), B4(93-97), B5(96-05), B6(05-10), B7(10-15), B8(14-)
Polo 6N(94-01), 9N(01-09), 6R(09-17), AW(17-)
Transporter T3(79-92), T4(90-03), T5(03-15), T6(15-)
Caddy Mk1(79-95), Mk2(95-04), Mk3(03-15), Mk4(15-)
Toyota: Camry SV20(86-91), V30(91-96), XV20(96-01), XV30(01-06), XV40(06-11), XV50(11-17), XV70(17-)
Corolla E80(83-87), E90(87-92), E100(92-97), E110(97-02), E120(00-07), E150(06-13), E160(13-19), E210(18-)
RAV4 XA10(94-00), XA20(00-05), XA30(05-12), XA40(12-18), XA50(18-)
Prius NHW10(97-03), NHW20(03-09), XW30(09-15), XW50(15-)
Land Cruiser FJ40(60-84), FJ60(80-87), FJ80(90-98), 100(98-07), 200(07-21), 300(21-)
Prado 90(96-02), 120(02-09), 150(09-)
Hilux N10(68-72)...N80(15-)
Honda: Accord CB(89-93), CD(93-97), CF/CG(97-02), CL/CM(02-07), CP(07-12), CR(12-17), CV(17-)
CR-V RD1(95-01), RD4/5(01-06), RE(06-11), RM(11-16), RW(16-)
Civic EF(87-91), EG(91-95), EK(95-00), EP/ES(00-05), FD(05-11), FB(11-15), FC(15-21)
Fit/Jazz GD(01-08), GE(07-14), GK(13-20), GR(20-)
Nissan: X-Trail T30(00-07), T31(07-13), T32(13-22), T33(21-)
Qashqai J10(06-13), J11(13-21), J12(21-)
Tiida C11(04-12), C13(11-)
Teana J31(03-08), J32(08-13)
Navara D21(85-97), D22(97-05), D40(05-15), D23(14-)
Patrol Y60(87-97), Y61(97-10), Y62(10-)
Hyundai: Elantra J1(90-95), J2(95-00), XD(00-06), HD(06-10), MD(10-16), AD(16-20), CN7(20-)
Tucson JM(04-10), LM(09-15), TL(15-21), NX4(20-)
Santa Fe SM(01-06), CM(06-12), DM(12-18), TM(18-)
Sonata Y2(88-93), Y3(93-98), EF(98-04), NF(04-09), YF(09-14), LF(14-19), DN8(19-)
i30 FD(07-11), GD(11-17), PD(17-)
KIA: Sportage JA(93-04), KM(04-10), SL(10-16), QL(16-21), NQ5(21-)
Sorento BL(02-09), XM(09-14), UM(14-20), MQ4(20-)
Cerato/Forte LD(03-08), TD(08-13), YD(13-18), BD(18-)
Opel/Vauxhall: Kadett C(73-79), D(79-84), E(84-91)
Astra F(91-98), G(98-05), H(04-10), J(09-15), K(15-)
Vectra A(88-95), B(95-02), C(02-08)
Zafira A(99-05), B(05-14), C(11-)
Insignia A(08-17), B(17-)
Corsa B(93-00), C(00-06), D(06-14), E(14-)
Omega A(86-93), B(94-03)
Frontera A(91-98), B(98-04)
Ford: Transit Mk1(65-78), Mk2(78-86), Mk3(86-00), Mk4(00-06), Mk5(06-14), Mk6(13-)
Focus MK1(98-04), MK2(04-11), MK3(11-18), MK4(18-)
Mondeo MK1(92-96), MK2(96-00), MK3(00-07), MK4(07-14), MK5(14-)
Fiesta MK1(76-83)...MK8(17-)
Escort MK1(68-75)...MK7(90-04)
Subaru: Impreza GC/GF(92-00), GD/GG(00-07), GH/GR(07-11), GP(11-16), GT(16-)
Forester SF(97-02), SG(02-08), SH(08-13), SJ(12-18), SK(18-)
Outback BG(94-99), BE/BH(98-03), BP(03-09), BR(09-14), BS(14-)
Legacy BD/BG(93-98), BE/BH(98-03), BL/BP(03-09), BR(09-14), BN(14-)
Mitsubishi: Pajero V10(82-91), V20(90-99), V60/V70(99-06), V80(06-)
Pajero iO/Pinin H60(98-07)
Outlander CU(01-06), CW(06-12), GF(12-21), GN(21-)
Lancer CA(88-92), CB(92-96), CE(96-03), CS(03-06), CY(07-17)
Galant E30(87-92), E50(92-96), E55(96-03)
Lada: 2101-2107 Classic(70-12)
2108/2109/21099 Samara(84-13)
2110/2111/2112(95-14)
Kalina 1117/1118/1119(04-13)
Priora 2170/2171/2172(07-18)
Granta 2190(11-)
Vesta(15-)
XRAY(15-)
Niva 2121/21213/21214(77-)
4x4 Urban(19-)
Daewoo: Nexia N100(94-16)
Matiz M100(98-08), M200(05-15)
Lanos T100(97-09)
Lacetti J200(02-09)
Nubira J100(96-99), J150(99-03)
Gentra(12-)
Mazda: 323 BF(85-89), BG(89-94), BA(94-98)
Familia BJ(98-04)
3/Axela BK(03-09), BL(09-13), BM(13-19), BP(19-)
6/Atenza GG(02-08), GH(07-12), GJ(12-18), GL(18-)
CX-5 KE(11-17), KF(17-)
CX-7 ER(06-12)
Tribute EP(00-07)
Suzuki: Vitara ET(88-98), GV(98-05), LY(15-)
Grand Vitara GT(97-05), JT(05-15)
Swift SF(83-89), AH(89-03), RS(03-10), FZ(10-17), AZ(17-)
Jimny SJ(81-18), GJ(18-)
SX4 GY(06-13), JY(13-)

=== DB საძიებო ტერმინები ===
სამუხრუჭე ხუნდი, წინა სამუხრუჭე ხუნდი, უკანა სამუხრუჭე ხუნდი
სამუხრუჭე დისკი, წინა სამუხრუჭე დისკი, უკანა სამუხრუჭე დისკი
ამორტიზატორი, წინა ამორტიზატორი, უკანა ამორტიზატორი
ჰაერის ფილტრი, ზეთის ფილტრი, სალონის ფილტრი, საწვავის ფილტრი
წყლის ტუმბო, ძრავის ზეთი, ღვედი, სტერჟინი
CV joint, control arm, bushing, wheel hub, tie rod, oil seal
სამუხრუჭე სუპორტი, ball joint, stabilizer link, crankshaft seal

=== წესები ===
1. search_terms-ში ჩააყოლე: ბრენდი, მოდელი, chassis code, ნაწილი ქართ/ინგ, სინონიმები
2. წლის/chassis კოდის მიხედვით ავტომატურად დაადგინე თაობა
3. პოზიცია (წინა/უკანა/მარცხ/მარჯვ) part_ka-ში ჩართე
4. "ველანზე" → "ველანის სალნიკი", "კოლოფზე" → "გადაცემათა კოლოფის სალნიკი"
5. კირილიცა მანქანები: нексия=Nexia, приора=Priora, семерка=2107, девятка=2109
6. VIN (17 სიმბოლო) → brand/model/year ამოიღე
7. თუ მხოლოდ მანქანა → part_ka და part_en null

უპასუხე მხოლოდ JSON-ით:
{
  "brand": "მარკა ან null",
  "model": "მოდელი ან null",
  "year": "წელი ან null",
  "engine": "ძრავი ან null",
  "part_ka": "ნაწილი პოზიციით ქართულად ან null",
  "part_en": "ნაწილი ინგლისურად ან null",
  "km_mileage": "გარბენი კმ-ში ან null",
  "search_terms": ["საძიებო სიტყვები"]
}`;

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  try {
    let { message, context } = req.body;
    // Vehicle search expansions — only for vehicle_cache lookup, NOT for product matching
    const VEHICLE_SEARCH_EXPANSIONS = {
      'fit': ['fit', 'jazz'],
      'jazz': ['jazz', 'fit'],
      'auris': ['auris', 'corolla'],
    };
    // Input sanitization & prompt injection protection
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message required' });
    if (message.length > 500) return res.status(400).json({ error: 'message too long' });
    const injectionPatterns = [
      /ignore previous/i, /forget your instructions/i, /you are now/i,
      /disregard all/i, /new instructions/i, /system prompt/i,
      /მოძებნე ყველა/i, /გამოაჩინე ყველა/i, /admin/i
    ];
    const cleanMessage = message.replace(/<[^>]*>/g, '').replace(/[<>"'`]/g, '').trim();
    if (injectionPatterns.some(p => p.test(cleanMessage))) {
      return res.status(400).json({ error: 'invalid request' });
    }
    const vinMatch = message && message.trim().match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
    if (vinMatch) {
      try {
        const { resolveVIN, resolveVehicleId, prefetchOEMCategories } = require('../services/vinResolver');
        const { PrismaClient: PrismaVIN } = require('@prisma/client');
        const prismaVin = new PrismaVIN();
        const vinData = await resolveVIN(vinMatch[1], prismaVin);
        if (vinData && vinData.make) {
          const vehicleId = await resolveVehicleId(vinData, prismaVin).catch(() => null);
          const oemCategories = vehicleId ? await prefetchOEMCategories(vehicleId, prismaVin).catch(() => []) : [];
          await prismaVin.$disconnect().catch(() => {});
          const carInfo = [vinData.year, vinData.make, vinData.model, vinData.engine].filter(Boolean).join(' ');
          const restMsg = message.replace(vinMatch[0], '').trim();
          if (restMsg.length < 3) {
            return res.json({
              type: 'vin_decoded',
              parsed: { brand: vinData.make, model: vinData.model, year: String(vinData.year||''), engine: vinData.engine, search_terms: [] },
              vin: { ...vinData, vehicleId },
              oemCategories,
              products: [],
              count: 0,
              message: 'VIN: ' + carInfo + ' — ახლა მიუთითეთ საჭირო ნაწილი.'
            });
          }
          message = (vinData.make + ' ' + (vinData.model||'') + ' ' + (vinData.year||'') + ' ' + restMsg).trim();
          req._vinContext = { ...vinData, vehicleId, oemCategories };
        } else {
          await prismaVin.$disconnect().catch(() => {});
          return res.json({
            type: 'vin_not_found',
            vin: vinMatch[1],
            products: [],
            count: 0,
            message: 'VIN ' + vinMatch[1] + ' — ვერ დავიდენტიფიცირე. გთხოვთ მარკა/მოდელი/წელი ხელით მიუთითეთ.'
          });
        }
      } catch(vinErr) {
        console.error('VIN resolve error:', vinErr.message);
        return res.json({
          type: 'vin_not_found',
          vin: vinMatch[1],
          products: [],
          count: 0,
          message: 'VIN ' + vinMatch[1] + ' — დამუშავება ვერ მოხდა. გთხოვთ ხელით მიუთითეთ მანქანა.'
        });
      }
    }
    if (!message) return res.status(400).json({ error: 'message required' });

    // OEM/SKU კოდის პირდაპირი ამოცნობა (Claude-ს გარეშე)
    // OEM კოდი: ციფრი+ასო, ლათინური, 6-20 სიმბოლო, ერთი სიტყვა
    const hasDigit = /[0-9]/.test(message);
    const hasLetter = /[A-Za-z]/.test(message);
    const hasGeorgian = /[ა-ჰ]/.test(message);
    const hasCyrillic = /[а-яА-Я]/.test(message);
    const wordCount = message.trim().split(/\s+/).length;
    const isOemCode = hasDigit && hasLetter && !hasGeorgian && !hasCyrillic && wordCount <= 2 && message.trim().length >= 5 && message.trim().length <= 20;
    if (isOemCode) {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const code = message.trim();
      const codeNoSpaces = code.replace(/\s/g, '');
      // brand/model სიტყვები ამოვიღოთ ranking-ისთვის
      const brandTerms = [];

    let products = await prisma.product.findMany({
        where: {
          OR: [
            { nameKa: { contains: code, mode: 'insensitive' } },
            { nameKa: { contains: codeNoSpaces, mode: 'insensitive' } },
            { sku: { contains: code, mode: 'insensitive' } },
            { articleNumber: { contains: code, mode: 'insensitive' } },
            { oemCodes: { hasSome: [code, code.toUpperCase(), codeNoSpaces.toUpperCase()] } },
            { alternativeSearchKeys: { hasSome: [code, code.toUpperCase(), codeNoSpaces.toUpperCase()] } },
          ],
        },
        take: 20,
      orderBy: { nameKa: 'asc' },
        select: { id: true, nameKa: true, nameEn: true, sku: true, price: true, stock: true, images: true, oemCodes: true, category: { select: { nameKa: true } } }
      });
      await prisma.$disconnect();
      // Autodoc crossRef for OEM/article search
      let oemCrossRef = null;
      if (process.env.RAPIDAPI_KEY) {
        try {
          // 1. ArticleNumber-ით ვეძებთ (ბრენდის კოდი)
          const r1 = await fetch(`https://autodoc-parts-catalog.p.rapidapi.com/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(code)}&articleType=ArticleNumber`, { headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY, "x-rapidapi-host": "autodoc-parts-catalog.p.rapidapi.com" } });
          const d1 = await r1.json();
          const arr1 = Array.isArray(d1) ? d1 : (d1.articles || []);
          if (arr1.length > 0) {
            const firstArticle = arr1[0];
            // 2. პირველი პროდუქტის OEM კოდებით ანალოგები ვეძებთ
            const prodOemCodes = products[0]?.oemCodes || [];
            const oemCode = prodOemCodes.find(c => c.length > 8 && /[0-9]/.test(c));
            let analogues = arr1.slice(0, 6);
            // Try OEM code from DB first, then from Autodoc article criteria
            let finalOemCode = oemCode;
            if (!finalOemCode && arr1[0]?.criteriaDescription) {
              // try to get OEM from Autodoc article's OE references
              finalOemCode = null;
            }
            if (finalOemCode) {
              try {
                const r2 = await fetch(`https://autodoc-parts-catalog.p.rapidapi.com/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(finalOemCode)}&articleType=OENumber`, { headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY, "x-rapidapi-host": "autodoc-parts-catalog.p.rapidapi.com" } });
                const d2 = await r2.json();
                const arr2 = Array.isArray(d2) ? d2 : (d2.articles || []);
                if (arr2.length > 0) analogues = arr2.slice(0, 8);
              } catch(e) {}
            } else {
              // No OEM code — get OE references from Autodoc for this article
              try {
                const r3 = await fetch(`https://autodoc-parts-catalog.p.rapidapi.com/api/articles/oe-references/type-id/1/article-id/${arr1[0].articleId || arr1[0].id || ''}`, { headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY, "x-rapidapi-host": "autodoc-parts-catalog.p.rapidapi.com" } });
                const d3 = await r3.json();
                const oeArr = Array.isArray(d3) ? d3 : [];
                if (oeArr.length > 0) {
                  const oe = oeArr[0].oeNumber || oeArr[0].articleNo;
                  if (oe) {
                    const r4 = await fetch(`https://autodoc-parts-catalog.p.rapidapi.com/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(oe)}&articleType=OENumber`, { headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY, "x-rapidapi-host": "autodoc-parts-catalog.p.rapidapi.com" } });
                    const d4 = await r4.json();
                    const arr4 = Array.isArray(d4) ? d4 : (d4.articles || []);
                    if (arr4.length > 0) { analogues = arr4.slice(0, 8); finalOemCode = oe; }
                  }
                }
              } catch(e) {}
            }
            oemCrossRef = {
              oemCode: oemCode || null,
              crossRef: analogues.map(a => ({ brand: a.supplierName||"", code: a.articleNo||"", desc: a.articleProductName||"", image: a.s3image||null, nameEn: a.articleProductName||"" })).filter(a => a.code)
            };
            // Enrich products with Autodoc info
            products = products.map(p => ({
              ...p,
              nameEn: p.nameEn && !p.nameEn.match(/[ა-ჿ]/) ? p.nameEn : (firstArticle.articleProductName||p.nameEn),
              images: p.images?.length ? p.images : (firstArticle.s3image ? [firstArticle.s3image] : [])
            }));
          }
        } catch(e) {}
      }
      return res.json({ parsed: { part_ka: code, part_en: code, search_terms: [code] }, products, count: products.length, referenceData: oemCrossRef });
    }

    // context message შევქმნათ
    const contextInfo = context ? `კონტექსტი: მომხმარებელს უკვე განსაზღვრული აქვს: ${JSON.stringify(context)}. ამ ინფორმაციის გამოყენება სავალდებულოა.` : '';

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contextInfo ? contextInfo + '\n\n' + cleanMessage : cleanMessage }]
    });

    const rawResp = response.content[0].text.trim();
    // JSON-ი ამოვიღოთ — markdown code blocks, extra text
    const jsonMatch2 = rawResp.match(/\{[\s\S]*\}/);
    const text = jsonMatch2 ? jsonMatch2[0] : rawResp.replace(/```json\n?/g,'').replace(/```/g,'').trim();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch(jsonErr) {
      console.log('JSON parse error, raw:', rawResp.slice(0,100));
      parsed = { brand: null, model: null, year: null, engine: null, part_ka: null, part_en: null, search_terms: [] };
    }
    // VIN context override — VIN-ით განსაზღვრული მანქანა მკაცრად აიღოს parsed-ში
    if (req._vinContext && req._vinContext.make) {
      const vinMake = req._vinContext.make;
      const vinModel = req._vinContext.model || null;
      parsed.brand = vinMake;
      if (vinModel) parsed.model = vinModel;
      if (req._vinContext.year) parsed.year = String(req._vinContext.year);
      if (req._vinContext.engine) parsed.engine = req._vinContext.engine;
      // strip hallucinated brand/model terms (Toyota, Camry etc when VIN says Skoda Fabia)
      const allowedMakes = new Set([vinMake.toLowerCase()]);
      const knownMakes = ['toyota','honda','vw','volkswagen','bmw','mercedes','mercedes-benz','audi','ford','nissan','mazda','skoda','škoda','seat','opel','peugeot','renault','hyundai','kia','mitsubishi','subaru','lexus','acura','infiniti','volvo','porsche','jaguar','land rover','dodge','chevrolet','jeep','fiat','lancia','alfa romeo'];
      const cleanTerms = (parsed.search_terms||[]).filter(t => {
        if (!t) return false;
        const low = String(t).toLowerCase();
        // ცადო: terms-ი ცადო ცადო different brand name
        for (const m of knownMakes) {
          if (m !== vinMake.toLowerCase() && !allowedMakes.has(m) && low === m) return false;
        }
        return true;
      });
      const vinTerms = [vinMake, vinModel, String(req._vinContext.year||'')].filter(Boolean);
      parsed.search_terms = [...new Set([...vinTerms, ...cleanTerms])];
    }

    // DB ძებნა
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const searchTerms = parsed.search_terms || [];
    
    // generation matching — წელი + მოდელი → generation aliases
    // OEM code detection — 6-15 char alphanumeric
    const oemMatch = message && !vinMatch && message.trim().match(/^([A-Z0-9][A-Z0-9\s\-\.]{4,20})$/i);
    if (oemMatch) {
      const oemCode = oemMatch[1].replace(/\s+/g,'').trim();
      const prismaOem = new PrismaClient();
      const oemProducts = await prismaOem.product.findMany({
        where: {
          OR: [
            { nameKa: { contains: oemCode, mode: 'insensitive' } },
            { oemCodes: { hasSome: [oemCode, oemCode.toUpperCase()] } },
            { alternativeSearchKeys: { hasSome: [oemCode, oemCode.toUpperCase()] } },
          ],
          stock: { gt: 0 }
        },
        take: 10,
        select: { id: true, nameKa: true, nameEn: true, sku: true, price: true, stock: true, images: true, oemCodes: true, category: { select: { nameKa: true } } }
      });
      await prismaOem.$disconnect();
      if (oemProducts.length > 0) {
        return res.json({ type: 'oem_search', parsed: { brand: null, model: null, part_ka: oemCode, part_en: oemCode, search_terms: [oemCode] }, products: oemProducts, count: oemProducts.length, _explanation: oemCode });
      }
    }
    if (parsed.year && parsed.model) {
      const yearStr = String(parsed.year);
      for (const [gen, data] of Object.entries(GENERATIONS)) {
        if (gen.toLowerCase().includes(parsed.model.toLowerCase()) || (parsed.model && gen.toLowerCase().includes(parsed.model.toLowerCase().split(" ")[0]))) {
          if (data.includes(yearStr)) {
            data.forEach(alias => { if (!searchTerms.includes(alias) && isNaN(Number(alias))) searchTerms.push(alias); });
            break;
          }
        }
      }
    }
    let yearMismatchNote = null;
    if (parsed.model && parsed.year) {
      const userYear = parseInt(parsed.year);
      for (const [mdl, info] of Object.entries(YEAR_MISMATCH)) {
        if (parsed.model.toLowerCase().includes(mdl.toLowerCase()) || mdl.toLowerCase().includes(parsed.model.toLowerCase())) {
          if (userYear > info.maxYear) {
            yearMismatchNote = parsed.model + " " + userYear + " წ. არ არსებობს — სავარაუდოდ " + info.redirect + " გულისხმობთ. ძებნა გაგრძელდება " + info.redirect + "-ზე.";
            parsed.model = info.redirect;
            break;
          }
        }
      }
    }
    // Vehicle Master alias resolution
    if (parsed.brand || parsed.model) {
      try {
        const { PrismaClient: PrismaVM } = require('@prisma/client');
        const prismaVM = new PrismaVM();
        const searchStr = `${parsed.brand||''} ${parsed.model||''}`.trim();
        const vmRows = await prismaVM.vehicleMaster.findMany({
          where: { aliases: { has: searchStr } }
        });
        if (!vmRows.length && parsed.model) {
          const vmRows2 = await prismaVM.vehicleMaster.findMany({
            where: { aliases: { has: parsed.model } }
          });
          if (vmRows2.length) {
            parsed.brand = vmRows2[0].make.charAt(0).toUpperCase() + vmRows2[0].make.slice(1);
            parsed.model = vmRows2[0].model;
            if (!parsed.year) parsed.year = String(vmRows2[0].yearFrom);
          }
        } else if (vmRows.length) {
          parsed.brand = vmRows[0].make.charAt(0).toUpperCase() + vmRows[0].make.slice(1);
          parsed.model = vmRows[0].model;
          if (!parsed.year) parsed.year = String(vmRows[0].yearFrom);
        }
        await prismaVM.$disconnect();
      } catch(vmErr) {}
    }

    // Engine code detection (CAYC → Golf 6 1.6 TDI)
    // Check raw message for engine codes (4-letter VW codes like CAYC, CBFA etc)
    const engineCodeMatch = message.match(/\b([A-Z]{2,6}[0-9]{0,2})\b/g);
    if (engineCodeMatch) {
      for (const ec of engineCodeMatch) {
        if (ec.length >= 3 && ec.length <= 8) {
          try {
            const { PrismaClient: PrismaE2 } = require('@prisma/client');
            const prismaE2 = new PrismaE2();
            const engRows2 = await prismaE2.engineMapping.findMany({
              where: { engineCode: { equals: ec, mode: 'insensitive' } }
            });
            await prismaE2.$disconnect();
            if (engRows2.length) {
              const e2 = engRows2[0];
              parsed.brand = e2.make.charAt(0).toUpperCase() + e2.make.slice(1);
              parsed.model = e2.model.charAt(0).toUpperCase() + e2.model.slice(1);
              parsed.year = parsed.year || String(e2.yearFrom);
              parsed.engine = ec;
              if (!searchTerms.includes(parsed.brand)) searchTerms.push(parsed.brand);
              if (!searchTerms.includes(parsed.model)) searchTerms.push(parsed.model);
              break;
            }
          } catch(e) {}
        }
      }
    }
    if (parsed.engine && !parsed.brand && !parsed.model) {
      try {
        const { PrismaClient: PrismaE } = require('@prisma/client');
        const prismaE = new PrismaE();
        const engRows = await prismaE.engineMapping.findMany({
          where: { engineCode: { equals: parsed.engine.toUpperCase(), mode: 'insensitive' } }
        });
        await prismaE.$disconnect();
        if (engRows.length) {
          const e = engRows[0];
          parsed.brand = e.make.charAt(0).toUpperCase() + e.make.slice(1);
          parsed.model = e.model.charAt(0).toUpperCase() + e.model.slice(1);
          parsed.year = parsed.year || String(e.yearFrom);
          const engineNote = `ძრავის კოდი ${parsed.engine} → ${parsed.brand} ${parsed.model} ${e.generation.toUpperCase()} (${e.yearFrom}-${e.yearTo||'დღემდე'}, ${e.displacement}L ${e.fuelType}, ${e.powerKw}kW)`;
          if (!searchTerms.includes(parsed.brand)) searchTerms.push(parsed.brand);
          if (!searchTerms.includes(parsed.model)) searchTerms.push(parsed.model);
        }
      } catch(engErr) { console.log('engine lookup error:', engErr.message); }
    }

    // Parts Intelligence — show common issues when only vehicle mentioned
    if (parsed.brand && parsed.model && !parsed.part_ka && !parsed.part_en && !parsed.km_mileage) {
      try {
        const { PrismaClient: PrismaI } = require('@prisma/client');
        const prismaI = new PrismaI();
        const { resolveGeneration: resolveGen } = require('../services/referenceDb');
        const gen = resolveGen(parsed.brand.toLowerCase(), parsed.model.toLowerCase(), parseInt(parsed.year)||0);
        const intMake = parsed.brand.toLowerCase().replace('-benz','').trim();
        const intModel = parsed.model.toLowerCase().trim();
        const intRows = await prismaI.partsIntelligence.findMany({
          where: {
            make: { contains: intMake, mode: 'insensitive' },
            model: { contains: intModel, mode: 'insensitive' },
            ...(gen ? { generation: { contains: gen, mode: 'insensitive' } } : {}),
            ...(parsed.engine ? { OR: [{ engineCode: { contains: parsed.engine.split('(')[0].trim(), mode: 'insensitive' } }, { engineCode: null }] } : {})
          },
          orderBy: { frequency: 'desc' },
          take: 6
        });
        await prismaI.$disconnect();
        if (intRows.length) {
          const urgent = intRows.filter(r => r.priority === 'urgent');
          const common = intRows.filter(r => r.priority === 'common');
          let msg = `${parsed.brand} ${parsed.model}${gen ? ' ' + gen.toUpperCase() : ''}${parsed.engine ? ' ' + parsed.engine : ''} — ხშირი მოთხოვნები:\n\n`;
          if (urgent.length) msg += `🔴 ცნობილი პრობლემები:\n${urgent.map(r => `• ${r.partType}${r.reason ? ' — ' + r.reason : ''}`).join('\n')}\n\n`;
          if (common.length) msg += `🔵 ხშირი შეკვეთები:\n${common.map(r => `• ${r.partType}`).join('\n')}`;
          return res.json({ type: 'intelligence', parsed, products: [], count: 0, serviceMessage: msg });
        }
      } catch(intErr) { console.log('intelligence error:', intErr.message); }
    }

    // Smart Bundle detection
    const { SERVICE_KITS } = require('../services/referenceDb');
    const msgLow = message.toLowerCase();
    const matchedKit = Object.keys(SERVICE_KITS).find(k => msgLow.includes(k.toLowerCase()));
    if (matchedKit && parsed.brand && parsed.model) {
      const kitParts = SERVICE_KITS[matchedKit];
      const { resolveGeneration } = require('../services/referenceDb');
      const gen = resolveGeneration((parsed.brand||'').toLowerCase(), (parsed.model||'').toLowerCase(), parseInt(parsed.year)||0);
      const bundleProducts = [];
      for (const partType of kitParts) {
        const { PrismaClient } = require('@prisma/client');
        const prismaB = new PrismaClient();
        // search by part type name in products
        const { normalizePartType } = require('../services/referenceDb');
        const partNorm = normalizePartType(partType);
        const kaMap = { 'engine oil': 'ძრავის ზეთი', 'oil filter': 'ზეთის ფილტრი', 'air filter': 'ჰაერის ფილტრი', 'cabin filter': 'სალონის ფილტრი', 'spark plug': 'ანთების სანთელი', 'fuel filter': 'საწვავის ფილტრი', 'brake fluid': 'სამუხრუჭე სითხე', 'front brake pad': 'წინა სამუხრუჭე ხუნდი', 'rear brake pad': 'უკანა სამუხრუჭე ხუნდი' };
        const kaName = kaMap[partType] || partType;
        const brandLow = (parsed.brand||'').toLowerCase();
        const modelLow2 = (parsed.model||'').toLowerCase();
        const prods = await prismaB.product.findMany({
          where: {
            AND: [
              { OR: [{ nameKa: { contains: kaName, mode: 'insensitive' } }, { alternativeSearchKeys: { has: kaName } }] },
              { OR: [{ alternativeSearchKeys: { has: parsed.brand } }, { alternativeSearchKeys: { has: parsed.model } }, { nameKa: { contains: modelLow2, mode: 'insensitive' } }] }
            ]
          },
          select: { id: true, nameKa: true, sku: true, price: true, stock: true, images: true },
          take: 1
        });
        if (prods.length) bundleProducts.push({ partType, product: prods[0] });
        // fallback — just by part name
        else {
          const prods2 = await prismaB.product.findMany({
            where: { OR: [{ nameKa: { contains: kaName, mode: 'insensitive' } }, { alternativeSearchKeys: { has: kaName } }] },
            select: { id: true, nameKa: true, sku: true, price: true, stock: true, images: true },
            take: 1
          });
          if (prods2.length) bundleProducts.push({ partType, product: prods2[0] });
        }
        await prismaB.$disconnect();
      }
      return res.json({ type: 'smart_bundle', kit: matchedKit, parts: kitParts, bundleProducts, bundleData: { kit: matchedKit, parts: kitParts, bundleProducts }, parsed, count: bundleProducts.length });
    }

    // km/service history detection
    if (parsed.km_mileage && !parsed.part_ka && !parsed.part_en) {
      const km = parseInt(parsed.km_mileage);
      if (!isNaN(km)) {
        try {
          const svcRes = await fetch(`http://localhost:3001/api/reference/service?make=${encodeURIComponent((parsed.brand||'all').toLowerCase())}&model=${encodeURIComponent((parsed.model||'all').toLowerCase())}&km=${km}`);
          const svcData = await svcRes.json();
          if (svcData.intervals?.length) {
            const urgentParts = svcData.intervals.filter(i => i.priority === 'urgent').map(i => i.partType);
            const recParts = svcData.intervals.filter(i => i.priority === 'recommended').map(i => i.partType);
            const checkParts = svcData.intervals.filter(i => i.priority === 'check').map(i => i.partType);
            let svcMsg = `${parsed.brand||''} ${parsed.model||''} — ${km.toLocaleString()} კმ სერვისი:\n\n`;
            if (urgentParts.length) svcMsg += `🔴 სავალდებულო:\n${urgentParts.map(p=>`• ${p}`).join('\n')}\n\n`;
            if (recParts.length) svcMsg += `🟡 რეკომენდებული:\n${recParts.map(p=>`• ${p}`).join('\n')}\n\n`;
            if (checkParts.length) svcMsg += `🔵 შესამოწმებელი:\n${checkParts.map(p=>`• ${p}`).join('\n')}`;
            return res.json({ type: 'service_history', parsed, products: [], count: 0, serviceMessage: svcMsg, _explanation: `service check at ${km}km` });
          }
        } catch(svcErr) { console.log('service lookup error:', svcErr.message); }
      }
    }
    if (parsed.part_ka) {
      searchTerms.push(parsed.part_ka);
      // position prefix მოვაშოროთ — "წინა/უკანა სამუხრუჭე ხუნდი" → "სამუხრუჭე ხუნდი"
      const stripped = parsed.part_ka.replace(/^(წინა|უკანა|მარჯვენა|მარცხენა)\s+/i, '').trim();
      if (stripped !== parsed.part_ka && stripped.length > 2) searchTerms.push(stripped);
    }
    if (parsed.part_en) searchTerms.push(parsed.part_en);
    if (parsed.brand) searchTerms.push(parsed.brand);
    if (parsed.model) searchTerms.push(parsed.model);
    if (parsed.brand && parsed.model) searchTerms.push(parsed.brand + ' ' + parsed.model);

    // synonyms გამოვიყენოთ
    const { enrichWithSynonyms } = require('../services/synonyms');
    const enriched = enrichWithSynonyms(searchTerms.join(' '));
    enriched.forEach(t => { if (!searchTerms.includes(t)) searchTerms.push(t); });
    // brake pad, колодка → ქართული
    const engToKa = {
      'brake pad': ['სამუხრუჭე ხუნდი','კალოტკა','კალოდკა'],
      'brake disc': ['სამუხრუჭე დისკი','დისკო'],
      'shock absorber': ['ამორტიზატორი','ამორტი'],
      'control arm': ['control arm','გიტარა','ბერკეტი'],
      'cv joint': ['CV joint','შრუსი','გრანატა','ყუმბარა'],
      'bushing': ['bushing','ბუქსა','ვტულკა'],
      'tie rod': ['tie rod','ტიაგა','ნაკანეჩნიკი'],
      'ball joint': ['ball joint','შარავო','სახსარი'],
      'water pump': ['წყლის ტუმბო','პომპა'],
      'timing belt': ['ღვედი','მატოს რემენი'],
      'oil filter': ['ზეთის ფილტრი'],
      'air filter': ['ჰაერის ფილტრი'],
      'колодка': ['სამუხრუჭე ხუნდი','კალოტკა','brake pad'],
      'კალოტკა': ['სამუხრუჭე ხუნდი','brake pad','კალოდკა'],
      'კალოდკა': ['სამუხრუჭე ხუნდი','brake pad','კალოტკა'],
      'тормозная': ['სამუხრუჭე ხუნდი','brake pad'],
      'тормозные колодки': ['სამუხრუჭე ხუნდი','brake pad','კალოტკა'],
      'тормозной': ['სამუხრუჭე','brake'],
      'колодки': ['სამუხრუჭე ხუნდი','brake pad','კალოტკა'],
      'фильтр': ['ფილტრი','filter'],
      'масляный фильтр': ['ზეთის ფილტრი','oil filter'],
      'воздушный фильтр': ['ჰაერის ფილტრი','air filter'],
      'амортизаторы': ['ამორტიზატორი','shock absorber'],
      'подшипник': ['საკისარი','bearing'],
      'ремень': ['ღვედი','belt'],
      'свеча': ['სვეჩი','spark plug'],
      'радиатор': ['რადიატორი','radiator'],
      'помпа': ['პომპა','water pump'],
      'рулевая тяга': ['ტიაგა','tie rod'],
      'стойка': ['სტოიკა','strut'],
      'пружина': ['საგაზამბარო','spring'],
      'амортизатор': ['ამორტიზატორი','shock absorber'],
      'шаровая': ['ball joint','შარავო'],
      'сальник': ['სალნიკი','oil seal'],
    };
    // msgLow already declared above
    for (const [eng, ka] of Object.entries(engToKa)) {
      if (msgLow.includes(eng)) ka.forEach(t => { if (!searchTerms.includes(t)) searchTerms.push(t); });
    }

    // OEM კოდებიდან სივრცეები მოვაშოროთ
    const normalizedTerms = [...new Set([
      ...searchTerms,
      ...searchTerms.map(t => t.replace(/\s/g, '')).filter(t => t.length > 4)
    ])];

    const whereConditions = normalizedTerms.map(term => ({
      OR: [
        { nameKa: { contains: term, mode: 'insensitive' } },
        { nameEn: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { alternativeSearchKeys: { hasSome: [term, term.toUpperCase(), term.toLowerCase()] } },
        { oemCodes: { hasSome: [term, term.toUpperCase(), term.toLowerCase()] } }
      ]
    }));

    const selectFields = {
      id: true, nameKa: true, nameEn: true,
      sku: true, price: true, stock: true,
      images: true, compatibility: true,
      alternativeSearchKeys: true, oemCodes: true,
      category: { select: { nameKa: true } }
    };

    // 1. Vehicle Graph Engine — join-based, variant-aware
    let priorityProducts = [];
    if (parsed.brand && parsed.model) {
      try {
        const { resolveVehicleProducts } = require('../services/vehicleGraph');
        const graphProds = await resolveVehicleProducts(parsed.brand, parsed.model, parsed.year, parsed.part_ka);
        if (graphProds.length > 0) priorityProducts = graphProds.slice(0, 30);
      } catch(ge) { console.error('graph engine error:', ge.message); }
      if (priorityProducts.length === 0) {
        if (parsed.model && parsed.part_ka) {
          const partCore = parsed.part_ka.replace(/^(წინა|უკანა|მარჯვენა|მარცხენა)\s+/i, '').trim();
          const partWords = partCore.split(' ').filter(w => w.length > 2);
          priorityProducts = await prisma.product.findMany({
            where: {
              AND: [
                { OR: [
                  { nameKa: { contains: parsed.model, mode: 'insensitive' } },
                  { alternativeSearchKeys: { hasSome: [parsed.model, parsed.model.toUpperCase()] } }
                ]},
                { OR: [
                  { nameKa: { contains: partCore, mode: 'insensitive' } },
                  { nameKa: { contains: parsed.part_ka, mode: 'insensitive' } },
                  ...partWords.map(w => ({ nameKa: { contains: w, mode: 'insensitive' } }))
                ]}
              ],
              stock: { gt: 0 }
            },
            take: 30,
            select: selectFields
          });
        }
        // part+model combined fallback
        if (priorityProducts.length === 0 && parsed.part_ka && parsed.model) {
          const partCore = parsed.part_ka.replace(/^(წინა|უკანა|მარჯვენა|მარცხენა)\s+/i, '').trim();
          priorityProducts = await prisma.product.findMany({
            where: {
              AND: [
                { nameKa: { contains: parsed.model, mode: 'insensitive' } },
                { OR: [
                  { nameKa: { contains: partCore, mode: 'insensitive' } },
                  { nameKa: { contains: parsed.part_ka, mode: 'insensitive' } },
                ]}
              ],
              stock: { gt: 0 }
            },
            take: 30,
            select: selectFields
          });
        }
      // last fallback — nameKa match
        if (priorityProducts.length === 0) {
          priorityProducts = await prisma.product.findMany({
            where: {
              OR: [
                { nameKa: { contains: parsed.brand + ' ' + parsed.model, mode: 'insensitive' } },
                { alternativeSearchKeys: { has: parsed.brand + ' ' + parsed.model } },
              ],
              stock: { gt: 0 }
            },
            take: 20,
            select: selectFields
          });
        }
      }
    }

    // 1b. Vehicle Graph Engine — join-based
    if (priorityProducts.length === 0 && parsed.brand) {
      try {
        const { resolveVehicleProducts } = require('../services/vehicleGraph');
        const graphProducts = await resolveVehicleProducts(
          parsed.brand, parsed.model, parsed.year, parsed.part_ka
        );
        if (graphProducts.length > 0) {
          priorityProducts = graphProducts;
        }
      } catch(e) { console.error('graph engine:', e.message); }
    }
    // 2. ზოგადი query
    const generalProducts = await prisma.product.findMany({
      where: { OR: whereConditions, stock: { gt: 0 } },
      take: 200,
      select: selectFields
    });
    // 3. გაერთიანება — priority პირველი, duplicates გარეშე
    const seenIds = new Set(priorityProducts.map(p => p.id));
    const products = [
      ...priorityProducts,
      ...generalProducts.filter(p => !seenIds.has(p.id))
    ];

    await prisma.$disconnect();

    // brand/model-ის მიხედვით დავალაგოთ
    const allScored = products.map(prod => {
      let score = 0;
      const name = prod.nameKa.toLowerCase();
      const altKeys = (prod.alternativeSearchKeys || []).map(k => k.toLowerCase());
      const brandLow = parsed.brand ? parsed.brand.toLowerCase() : null;
      const modelLow = parsed.model ? parsed.model.toLowerCase() : null;

      // nameKa-ში პირდაპირ match — word boundary შემოწმება
      const nameNorm = name.replace(/[()\-_,|]/g, ' ').replace(/\s+/g,' ');
      const nameWords = nameNorm.split(' ');
      if (brandLow && (nameWords.includes(brandLow) || nameNorm.includes(brandLow))) score += 10;
      // model soft match — "Pajero iO" matches "Pajero"
      const modelBase = modelLow ? modelLow.split(' ')[0] : null;
      if (modelLow && (nameWords.includes(modelLow) || nameNorm.includes(modelLow))) score += 15;
      else if (modelBase && modelBase.length > 3 && nameNorm.includes(modelBase)) score += 10;

      // alternativeSearchKeys-ში exact match
      if (brandLow && altKeys.some(k => k === brandLow)) score += 8;
      if (modelLow && altKeys.some(k => k === modelLow)) score += 8;
      if (brandLow && modelLow && altKeys.some(k => k === brandLow + ' ' + modelLow)) score += 15;

      // ორივე ერთად nameKa-ში
      if (brandLow && modelLow && nameWords.includes(brandLow) && nameWords.includes(modelLow)) score += 10;

      if (prod.compatibility) {
        const comp = prod.compatibility.toLowerCase();
        if (brandLow && comp.includes(brandLow)) score += 5;
        if (modelLow && comp.includes(modelLow)) score += 5;
      }
      // part/position match — სამუხრუჭე ხუნდი უნდა იყოს პრიორიტეტი
      const partKaLow = parsed.part_ka ? parsed.part_ka.toLowerCase() : null;
      if (partKaLow && name.includes(partKaLow)) score += 40;
      if (partKaLow && altKeys.some(k => k === partKaLow)) score += 35;
      // brand + model boost — მხოლოდ თუ part match გვაქვს
      // loose part match — "სამუხრუჭე ხუნდი" matches "წინა/უკანა სამუხრუჭე ხუნდი"
      const partWords = partKaLow ? partKaLow.split(' ').filter(w => w.length > 2) : [];
      const partEnLow = parsed.part_en ? parsed.part_en.toLowerCase() : null;
      // position prefix გავაშოროთ hasPartMatch-ისთვის
      const partKaCore = partKaLow ? partKaLow
        .replace(/^(წინა|უკანა|მარჯვენა|მარცხენა)\s+/i, '')
        .replace(/^(რულის|რულევი|საჭის|ძრავის|გადაცემათა|წინა\s+მარცხენა|წინა\s+მარჯვენა|უკანა\s+მარცხენა|უკანა\s+მარჯვენა)\s+/i, '')
        .trim() : null;
      // position detection
      const positionMatch2 = parsed.part_ka?.match(/^(წინა|უკანა|მარჯვენა|მარცხენა)/);
      const position = positionMatch2 ? positionMatch2[1] : null;
      const positionOk = !position || (
        (position === 'წინა' && name.includes('წინა')) ||
        (position === 'უკანა' && name.includes('უკანა')) ||
        (position === 'მარჯვენა' && name.includes('მარჯვენა')) ||
        (position === 'მარცხენა' && name.includes('მარცხენა'))
      );
      const hasPartMatch = !partKaLow || (
        positionOk && (
          name.includes(partKaLow) ||
          (partKaCore && name.includes(partKaCore)) ||
          (partEnLow && name.includes(partEnLow)) ||
          altKeys.some(k => k.toLowerCase().includes(partKaLow)) ||
          (partEnLow && altKeys.some(k => k.toLowerCase().includes(partEnLow))) ||
          (partWords.length > 1 && partWords.every(w => name.includes(w))) ||
          (partWords.length > 1 && altKeys.some(k => partWords.every(w => k.toLowerCase().includes(w))))
        )
      );
      // თუ part_ka მოცემულია და match არ არის — score = 0
      if (partKaLow && !hasPartMatch) {
        if (prod.nameKa && prod.nameKa.toLowerCase().includes('transit')) {
        }
        return { ...prod, _score: 0, _explanation: null };
      }
      // Vehicle match — model სავალდებულოა (brand მარტო არ კმარა)
      if (brandLow && modelLow) {
        const compLow = (prod.compatibility||'').toLowerCase();
        const hasModelMatch =
          nameNorm.includes(modelLow) ||
          (modelBase && modelBase.length > 3 && nameNorm.includes(modelBase)) ||
          altKeys.some(k => k.toLowerCase().includes(modelLow)) ||
          (modelBase && altKeys.some(k => k.toLowerCase().includes(modelBase))) ||
          compLow.includes(modelLow) ||
          (modelBase && compLow.includes(modelBase));
        if (!hasModelMatch) { return { ...prod, _score: 0, _explanation: null }; }
      }
      if (parsed.brand) {
        const brandLow = parsed.brand.toLowerCase();
        if (name.includes(brandLow)) score += hasPartMatch ? 20 : 5;
        if (altKeys.some(k => k.includes(brandLow))) score += hasPartMatch ? 15 : 3;
      }
      if (parsed.model) {
        const modelLow = parsed.model.toLowerCase();
        if (name.includes(modelLow)) score += hasPartMatch ? 15 : 3;
        if (altKeys.some(k => k.includes(modelLow))) score += hasPartMatch ? 12 : 2;
      }

      // year match — compatibility ველში წელი ემთხვევა
      if (parsed.year) {
        const yearStr = String(parsed.year);
        const comp = (prod.compatibility || '').toLowerCase();
        const altStr = altKeys.join(' ');
        if (comp.includes(yearStr) || altStr.includes(yearStr)) score += 8;
        // year range check: "2006->" ნიშნავს 2006-დან, შევამოწმოთ
        const rangeMatch = comp.match(/(\d{4})\s*[-–>]+\s*(\d{4})?/g);
        if (rangeMatch) {
          for (const range of rangeMatch) {
            const nums = range.match(/\d{4}/g);
            if (nums) {
              const from = parseInt(nums[0]);
              const to = nums[1] ? parseInt(nums[1]) : 2030;
              const userYear = parseInt(yearStr);
              if (userYear >= from && userYear <= to) { score += 12; break; }
            }
          }
        }
      }
      // explanation — რატომ შეირჩა ეს პროდუქტი
      const reasons = [];
      if (brandLow && (nameWords.includes(brandLow) || altKeys.some(k => k === brandLow))) reasons.push(parsed.brand);
      if (modelLow && (nameWords.includes(modelLow) || altKeys.some(k => k === modelLow) || altKeys.some(k => k === brandLow + ' ' + modelLow))) reasons.push(parsed.model);
      if (partKaLow && (name.includes(partKaLow) || altKeys.some(k => k === partKaLow))) reasons.push(parsed.part_ka);
      if (parsed.year) {
        const yearStr = String(parsed.year);
        const comp = (prod.compatibility || '').toLowerCase();
        if (comp.includes(yearStr) || (prod.alternativeSearchKeys||[]).join(' ').includes(yearStr)) reasons.push(yearStr + ' წ.');
      }
      if (prod.stock > 0) reasons.push('მარაგშია (' + prod.stock + ')');
      const _explanation = reasons.length > 0 ? '✓ ' + reasons.join('  ✓ ') : null;

      return { ...prod, _score: score, _explanation };
    });
    const scored = allScored.filter(p => p._score > 0).sort((a, b) => b._score - a._score);

    // Analytics logging
    try {
      await prisma.searchAnalytics.create({
        data: {
          query: message.slice(0, 500),
          brand: parsed.brand || null,
          model: parsed.model || null,
          year: parsed.year ? String(parsed.year) : null,
          part_ka: parsed.part_ka || null,
          results_count: scored.length,
        }
      });
    } catch(e) { console.log('analytics error:', e.message); }

    // "ვერ ვიპოვე" — წინადადებები
    let suggestions = [];
    // cross reference fallback — Autodoc API
    if (scored.length === 0) {
      try {
        const { getCrossRefs, normalizeCode } = require('../services/crossRefLookup');
        const searchTerms = [_q, parsed.part_ka, parsed.part_en].filter(Boolean);
        for (const term of searchTerms) {
          if (term && term.length >= 4 && /[A-Z0-9]/i.test(term)) {
            const crossCodes = await getCrossRefs(term);
            if (crossCodes.length > 0) {
              const crossProducts = await prisma.product.findMany({
                where: {
                  isActive: true,
                  OR: crossCodes.slice(0, 20).map(c => ({ 
                    OR: [
                      { oemCodes: { hasSome: [c, c.replace(/[\s\-\.]/g,'').toUpperCase()] } },
                      { alternativeSearchKeys: { hasSome: [c, c.replace(/[\s\-\.]/g,'').toUpperCase()] } },
                      { sku: { equals: c, mode: 'insensitive' } }
                    ]
                  }))
                },
                take: 20,
                include: { category: { select: { nameKa: true } } }
              });
              if (crossProducts.length > 0) {
                scored = crossProducts.map(p => ({ ...p, _crossRef: true, _originalQuery: term }));
                console.log('crossRef hit:', term, '->', crossCodes.length, 'codes ->', scored.length, 'products');
                break;
              }
            }
          }
        }
      } catch(e) { console.log('crossRef fallback error:', e.message); }
    }
    if (scored.length === 0 && parsed.part_ka) {
      const suggTerms = ['წინა ' + parsed.part_ka, 'უკანა ' + parsed.part_ka, parsed.part_ka + ' კომპლექტი'];
      for (const term of suggTerms) {
        const found = await prisma.product.findFirst({
          where: { nameKa: { contains: term.split(' ').pop(), mode: 'insensitive' }, stock: { gt: 0 } },
          select: { nameKa: true }
        });
        if (found) suggestions.push(term);
      }
    }

    // Reference DB lookup
    let referenceData = null;
    try {
      const { lookupRef, getCapacityFromItems, resolveGeneration } = require("../services/referenceDb");
      if (parsed.brand && parsed.model && (parsed.part_en || parsed.part_ka)) {
        // part_en → referenceDb key mapping
        const partEnRaw = parsed.part_en || parsed.part_ka;
        const partMapping = {
          'brake pad': 'front brake pad',
          'front brake pad': 'front brake pad',
          'rear brake pad': 'rear brake pad',
          'oil filter': 'oil filter',
          'engine oil': 'engine oil',
          'air filter': 'air filter',
          'timing belt': 'timing belt',
          'timing chain': 'timing chain',
          'shock absorber': 'shock absorber',
          'spark plug': 'spark plug',
          'antifreeze': 'antifreeze coolant',
          'coolant': 'antifreeze coolant',
        };
        const partQuery = partMapping[partEnRaw?.toLowerCase()] || partEnRaw;
        const refResult = lookupRef(parsed.brand, parsed.model, partQuery, parsed.year);
        if (refResult) {
          const items = Array.isArray(refResult.items) ? refResult.items : [];
          referenceData = {
            generation: refResult.gen || resolveGeneration(parsed.brand, parsed.model, parsed.year),
            capacity: getCapacityFromItems(items),
            codes: items.map(([brand, code, desc]) => ({ brand, code, desc: (desc||"").split(" | ")[0].trim() })),
            note: !parsed.year ? "წელი არ არის — კოდები გადაამოწმე თაობასთან" : null
          };
        }
      }
    } catch(e) { console.log("referenceDb error:", e.message); }
    // Autodoc cross-reference — პირველი OEM კოდით
    if (process.env.RAPIDAPI_KEY) {
      try {
        // პირველ რიგში OEM კოდით ვეძებთ
        console.log('CROSSREF DEBUG: part_en=', parsed.part_en, 'message=', message, 'referenceData=', referenceData);
        let searchCode = referenceData?.codes?.[0]?.code || null;
        let searchType = 'OENumber';
        // თუ OEM კოდი არ გვაქვს, მომხმარებლის ძებნის ტექსტიდან ავიღებთ
        if (!searchCode && parsed.part_en) {
          searchCode = parsed.part_en.replace(/\s/g,'').toUpperCase();
          searchType = 'ArticleNumber';
        }
        if (!searchCode && message) {
          const clean = message.replace(/\s/g,'').toUpperCase();
          if (/^[A-Z0-9]{4,15}$/.test(clean)) { searchCode = clean; searchType = 'ArticleNumber'; }
        }
        if (searchCode) {
          const adResp = await fetch(`https://autodoc-parts-catalog.p.rapidapi.com/api/artlookup/search-articles-by-article-no?langId=4&articleNo=${encodeURIComponent(searchCode)}&articleType=${searchType}`, { headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY, "x-rapidapi-host": "autodoc-parts-catalog.p.rapidapi.com" } });
          const adData = await adResp.json();
          const adArr = Array.isArray(adData) ? adData : (adData.articles || []);
          if (adArr.length > 0) {
            if (!referenceData) referenceData = {};
            referenceData.crossRef = adArr.slice(0, 6).map(a => ({ brand: a.supplierName||"", code: a.articleNo||"", desc: a.articleProductName||"", image: a.s3image||null, nameEn: a.articleProductName||"" })).filter(a => a.code);
          }
        }
      } catch(e) { console.error("Autodoc crossRef ERROR:", e.message); }
    }
        // cross-reference კოდებით DB-ში ვეძებოთ
        if (referenceData && referenceData.crossRef && referenceData.crossRef.length > 0) {
          const crossCodes = referenceData.crossRef.map(a => a.code.replace(/\s/g,"")).filter(Boolean);
          const { PrismaClient } = require("@prisma/client");
          const prismaX = new PrismaClient();
          const crossProducts = await prismaX.product.findMany({
            where: {
              OR: crossCodes.flatMap(c => [
                { oemCodes: { hasSome: [c, c.replace(/[-\s]/g,"")] } },
                { alternativeSearchKeys: { hasSome: [c] } },
                { nameKa: { contains: c, mode: "insensitive" } }
              ]),
              stock: { gt: 0 }
            },
            take: 10,
            select: { id: true, nameKa: true, sku: true, price: true, stock: true, images: true, oemCodes: true, category: { select: { nameKa: true } } }
          });
          await prismaX.$disconnect();
          if (crossProducts.length > 0) {
            referenceData.crossRefProducts = crossProducts;
          }
        }
    // Knowledge Graph — related parts
    let relatedParts = [];
    if (parsed.part_en || parsed.part_ka) {
      try {
        const { PrismaClient: PrismaR } = require('@prisma/client');
        const prismaR = new PrismaR();
        const partKey = (parsed.part_en || parsed.part_ka || '').toLowerCase().split(' ').slice(-2).join(' ');
        const relations = await prismaR.partsRelation.findMany({
          where: { partType: { contains: partKey, mode: 'insensitive' } },
          orderBy: [{ relation: 'asc' }, { id: 'asc' }],
          take: 5
        });
        relatedParts = relations.map(r => ({ part: r.relatedPart, relation: r.relation, reason: r.reason }));
        await prismaR.$disconnect();
      } catch(relErr) {}
    }
    const _explanation = [
      parsed.brand, parsed.model, parsed.year,
      typeof generation !== "undefined" && generation ? generation.toUpperCase() : (typeof gen !== "undefined" && gen ? gen.toUpperCase() : null),
      parsed.part_ka
    ].filter(Boolean).join(' · ');
    // Log search for behavior learning
    try {
      const { PrismaClient: PrismaL } = require('@prisma/client');
      const prismaL = new PrismaL();
      await prismaL.searchLog.create({ data: {
        make: parsed.brand || null,
        model: parsed.model || null,
        generation: (typeof gen !== 'undefined' && gen) ? gen : null,
        partEn: parsed.part_en || null,
        partKa: parsed.part_ka || null,
        found: scored.length > 0,
        resultCount: scored.length
      }});
      await prismaL.$disconnect();
    } catch(logErr) {}
    // Confidence calculation
    let confidence = 0;
    let fitmentRisk = 'low';
    if (scored.length > 0) {
      const topScore = scored[0]._score || 0;
      if (topScore >= 60) { confidence = 95; fitmentRisk = 'low'; }
      else if (topScore >= 40) { confidence = 80; fitmentRisk = 'medium'; }
      else if (topScore >= 20) { confidence = 60; fitmentRisk = 'high'; }
      else { confidence = 40; fitmentRisk = 'high'; }
      if (!parsed.year) { confidence -= 10; fitmentRisk = 'medium'; }
      if (!parsed.brand || !parsed.model) { confidence -= 20; fitmentRisk = 'high'; }
      confidence = Math.max(30, Math.min(99, confidence));
    }
    // Insert into search_analytics and get analyticsId
    let analyticsId = null;
    try {
      const _q = message || '';
      const rows = await prisma.$queryRaw`
        INSERT INTO search_analytics (query, brand, model, year, part_ka, results_count, clicked, cart_added, purchased)
        VALUES (${_q}, ${parsed.brand||null}, ${parsed.model||null}, ${parsed.year?String(parsed.year):null}, ${parsed.part_ka||_q}, ${scored.length}, false, false, false)
        RETURNING id
      `;
      analyticsId = rows?.[0]?.id ?? null;
    } catch(e) { console.error('analytics INSERT error:', e.message); }
    res.json({ parsed, products: scored, count: scored.length, suggestions, yearMismatchNote, referenceData, _explanation: _explanation || null, relatedParts, confidence, fitmentRisk, analyticsId });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// POST /api/ai/scan - სურათიდან VIN ამოკითხვა
router.post('/scan', async (req, res) => {
  try {
    const { image, mimeType = 'image/jpeg', context } = req.body;
    if (!image) return res.status(400).json({ error: 'image required (base64)' });

    // context message შევქმნათ
    const contextInfo = context ? `კონტექსტი: მომხმარებელს უკვე განსაზღვრული აქვს: ${JSON.stringify(context)}. ამ ინფორმაციის გამოყენება სავალდებულოა.` : '';

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: image }
          },
          {
            type: 'text',
            text: `Analyze this image carefully.

CASE 1 - Vehicle registration/technical passport document:
Extract ALL visible text and return JSON:
{"type":"vin","vin":"17CHARVIN","brand":"Make","model":"Model","year":"2010","engine":"2.4 TDCi","fuel":"Diesel","power":"kW","capacity":"cm3","color":"color if visible"}

CASE 2 - Auto part / spare part photo:
Identify the part type precisely. Return JSON:
{"type":"part","part_ka":"ქართული სახელი","part_en":"English technical name","part_en_alt":"alternative English name","brand":"brand if visible on part","category":"brake/suspension/engine/filter/electrical/body","position":"front/rear/left/right/upper/lower if applicable","search_terms":["term1","term2","term3"]}

Examples:
- Brake pad photo → {"type":"part","part_ka":"სამუხრუჭე ხუნდი","part_en":"brake pad","brand":"TRW","category":"brake","position":"front","search_terms":["brake pad","სამუხრუჭე ხუნდი","კალოტკა"]}
- Shock absorber → {"type":"part","part_ka":"ამორტიზატორი","part_en":"shock absorber","brand":"KYB","category":"suspension","search_terms":["ამორტიზატორი","shock absorber","amort"]}
- Oil filter → {"type":"part","part_ka":"ზეთის ფილტრი","part_en":"oil filter","brand":"Mann","category":"filter","search_terms":["ზეთის ფილტრი","oil filter"]}
- CV joint/ШРУС → {"type":"part","part_ka":"CV joint","part_en":"CV joint","category":"suspension","search_terms":["CV joint","შრუსი","გრანატა","ყუმბარა"]}

CASE 3 - Cannot identify:
{"type":"unknown","message":"Cannot identify the part or document"}

Return ONLY valid JSON, nothing else.`
          }
        ]
      }]
    });

    const rawRespText = response.content[0].text.trim();
    // JSON extraction — markdown code blocks გამოვიღოთ
    const jsonMatch = rawRespText.match(/\{[\s\S]*\}/);
    const rawText = jsonMatch ? jsonMatch[0] : rawRespText;
    
    // JSON თუ დაბრუნდა structured data
    let vin = rawText.toUpperCase();
    let vehicle = null;
    try {
      const parsedScan = JSON.parse(rawText.replace(/```json|```/g,'').trim());
      if (parsedScan.vin) { vin = parsedScan.vin.toUpperCase(); vehicle = { brand: parsedScan.brand, model: parsedScan.model, year: parsedScan.year, engine: parsedScan.engine, fuel: parsedScan.fuel, capacity: parsedScan.capacity }; }
    } catch(e) {
      // plain text VIN
      vin = rawText.replace(/[^A-HJ-NPR-Z0-9]/g,'').substring(0,17).toUpperCase();
    }

    // part recognition
    try {
      const parsedPart = JSON.parse(rawText.replace(/```json|```/g,'').trim());
      if (parsedPart.type === 'part') {
        const { PrismaClient } = require('@prisma/client');
        const prisma2 = new PrismaClient();
        // search terms from AI + synonyms
        const { enrichWithSynonyms } = require('../services/synonyms');
        const allTerms = [parsedPart.part_ka, parsedPart.part_en, parsedPart.part_en_alt, parsedPart.brand, ...(parsedPart.search_terms||[])].filter(Boolean);
        const enriched = enrichWithSynonyms(allTerms.join(' '), allTerms);
        const uniqueTerms = [...new Set(enriched)].filter(t => t && t.length > 1);

        const whereConditions = uniqueTerms.map(term => ({
          OR: [
            { nameKa: { contains: term, mode: 'insensitive' } },
            { nameEn: { contains: term, mode: 'insensitive' } },
            { alternativeSearchKeys: { hasSome: [term, term.toLowerCase(), term.toUpperCase()] } },
            { oemCodes: { hasSome: [term] } },
          ]
        }));

        const products2 = await prisma2.product.findMany({
          where: { OR: whereConditions, stock: { gt: 0 } },
          take: 20,
          select: { id: true, nameKa: true, nameEn: true, sku: true, price: true, stock: true, images: true, alternativeSearchKeys: true, category: { select: { nameKa: true } } }
        });

        // score by relevance
        const scored2 = products2.map(prod => {
          let score = 0;
          const name = prod.nameKa.toLowerCase();
          const altKeys = (prod.alternativeSearchKeys||[]).map(k=>k.toLowerCase());
          if (parsedPart.part_ka && name.includes(parsedPart.part_ka.toLowerCase())) score += 20;
          if (parsedPart.part_en && name.includes(parsedPart.part_en.toLowerCase())) score += 15;
          if (parsedPart.brand && name.includes(parsedPart.brand.toLowerCase())) score += 10;
          if (parsedPart.part_ka && altKeys.some(k=>k===parsedPart.part_ka.toLowerCase())) score += 15;
          return { ...prod, _score: score };
        }).sort((a,b) => b._score - a._score).slice(0,10);

        await prisma2.$disconnect();
        if (scored2.length === 0 && parsedPart && parsedPart.brand && parsedPart.part_en) {
          const adCats = await autodocSearchByPart(parsedPart.brand, parsedPart.part_en);
          if (adCats.length) {
            return res.json({
              type: 'part',
              part: parsedPart,
              products: [],
              count: 0,
              autodocSuggestion: {
                message: `ჩვენს ბაზაში ${parsedPart.brand}-ისთვის "${parsedPart.part_ka || parsedPart.part_en}" ჯერ არ გვაქვს, მაგრამ Autodoc-ში არსებობს. შევუკვეთო?`,
                categories: adCats
              }
            });
          }
        }
        return res.json({ type: 'part', part: parsedPart, products: scored2, count: scored2.length });
      }
    } catch(e) {}

    if (vin === 'NOT_FOUND' || vin.length !== 17) {
      return res.json({ vin: null, error: 'VIN ვერ მოიძებნა სურათში' });
    }

    // Autodoc VIN decode
    try {
      const autodocData = await decodeVINWithAutodoc(vin);
      if (autodocData && autodocData.make) {
        vehicle = { make: autodocData.make, brand: autodocData.make, model: autodocData.model || (vehicle&&vehicle.model) || "", year: autodocData.year || (vehicle&&vehicle.year) || "", engine: autodocData.engine || (vehicle&&vehicle.engine) || "", fuel: autodocData.fuel, vehicleId: autodocData.vehicleId };
      }
    } catch(e) { console.log("Autodoc decode error:", e.message); }
    // vehicle brand/model-ით ვიძებნოთ
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    let products = [];
    if (vehicle?.brand || vehicle?.model) {
      const terms = [vehicle.brand, vehicle.model].filter(Boolean);
      products = await prisma.product.findMany({
        where: { OR: terms.map(t => ({ nameKa: { contains: t } })), stock: { gt: 0 } },
        take: 10,
        select: { id: true, nameKa: true, sku: true, price: true, stock: true, images: true, category: { select: { nameKa: true } } }
      });
    }
    await prisma.$disconnect();
    res.json({ vin, vehicle, products, count: products.length });
  } catch (err) {
    console.error('AI scan error:', err);
    res.status(500).json({ error: err.message });
  }
});
