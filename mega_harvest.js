const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const mapping = require('./src/services/categoryMapping');

// საქართველოს ბაზრისთვის რელევანტური, გაფართოებული სია (აშშ/იაპონია/ევროპა/კორეის შემოტანილი მანქანები)
const VEHICLES = [
  // Toyota — ბევრი წლის ვარიანტი, ყველაზე პოპულარული ბრენდი საქართველოში
  ['Toyota','Camry',2010],['Toyota','Camry',2015],['Toyota','Camry',2018],['Toyota','Camry',2020],
  ['Toyota','Corolla',2010],['Toyota','Corolla',2015],['Toyota','Corolla',2018],
  ['Toyota','RAV4',2013],['Toyota','RAV4',2016],['Toyota','RAV4',2019],
  ['Toyota','Land Cruiser Prado',2010],['Toyota','Land Cruiser Prado',2015],['Toyota','Land Cruiser',2010],
  ['Toyota','Prius',2010],['Toyota','Prius',2015],['Toyota','Yaris',2012],['Toyota','Yaris',2015],
  ['Toyota','Hilux',2012],['Toyota','Hilux',2016],['Toyota','Highlander',2014],['Toyota','Highlander',2018],
  ['Toyota','4Runner',2012],['Toyota','Avensis',2010],['Toyota','Auris',2012],['Toyota','Venza',2013],
  ['Toyota','Sequoia',2010],['Toyota','Fortuner',2016],['Toyota','FJ Cruiser',2012],
  // Hyundai
  ['Hyundai','Tucson',2016],['Hyundai','Tucson',2019],['Hyundai','Santa Fe',2013],['Hyundai','Santa Fe',2018],
  ['Hyundai','Elantra',2014],['Hyundai','Elantra',2018],['Hyundai','Accent',2013],['Hyundai','Sonata',2015],
  ['Hyundai','Creta',2018],['Hyundai','ix35',2012],['Hyundai','i30',2015],['Hyundai','i10',2015],
  ['Hyundai','Getz',2010],['Hyundai','Terracan',2005],
  // Kia
  ['Kia','Sportage',2014],['Kia','Sportage',2018],['Kia','Sorento',2014],['Kia','Sorento',2018],
  ['Kia','Rio',2013],['Kia','Cerato',2015],['Kia','Optima',2015],['Kia','Picanto',2015],
  // BMW
  ['BMW','3-Series',2010],['BMW','3-Series',2015],['BMW','5-Series',2010],['BMW','5-Series',2015],
  ['BMW','X5',2010],['BMW','X5',2015],['BMW','X3',2013],['BMW','X1',2013],['BMW','7-Series',2012],
  // Mercedes-Benz
  ['Mercedes-Benz','C-Class',2010],['Mercedes-Benz','C-Class',2015],
  ['Mercedes-Benz','E-Class',2010],['Mercedes-Benz','E-Class',2015],
  ['Mercedes-Benz','ML-Class',2010],['Mercedes-Benz','GLE-Class',2016],['Mercedes-Benz','S-Class',2012],
  ['Mercedes-Benz','Sprinter',2010],['Mercedes-Benz','Vito',2012],['Mercedes-Benz','GLC-Class',2016],
  // Volkswagen
  ['Volkswagen','Golf',2010],['Volkswagen','Golf',2015],['Volkswagen','Passat',2012],['Volkswagen','Passat',2016],
  ['Volkswagen','Tiguan',2013],['Volkswagen','Polo',2014],['Volkswagen','Jetta',2013],['Volkswagen','Touareg',2012],
  // Honda
  ['Honda','CR-V',2012],['Honda','CR-V',2016],['Honda','Civic',2012],['Honda','Civic',2016],
  ['Honda','Accord',2013],['Honda','Pilot',2013],['Honda','Fit',2014],['Honda','Odyssey',2012],
  // Nissan
  ['Nissan','X-Trail',2013],['Nissan','X-Trail',2017],['Nissan','Qashqai',2013],['Nissan','Qashqai',2017],
  ['Nissan','Pathfinder',2013],['Nissan','Murano',2013],['Nissan','Altima',2013],['Nissan','Rogue',2014],
  ['Nissan','Patrol',2012],['Nissan','Juke',2014],
  // Mitsubishi
  ['Mitsubishi','Pajero',2010],['Mitsubishi','Pajero',2015],['Mitsubishi','Outlander',2013],
  ['Mitsubishi','Lancer',2012],['Mitsubishi','ASX',2013],['Mitsubishi','L200',2013],
  // Ford
  ['Ford','Focus',2012],['Ford','Focus',2016],['Ford','Fiesta',2013],['Ford','Explorer',2014],
  ['Ford','Escape',2014],['Ford','Fusion',2013],['Ford','F-150',2015],['Ford','Ranger',2015],
  ['Ford','Edge',2014],['Ford','Mustang',2015],
  // Chevrolet
  ['Chevrolet','Cruze',2013],['Chevrolet','Malibu',2014],['Chevrolet','Equinox',2014],
  ['Chevrolet','Captiva',2013],['Chevrolet','Camaro',2015],['Chevrolet','Tahoe',2013],
  // Jeep
  ['Jeep','Grand Cherokee',2013],['Jeep','Cherokee',2014],['Jeep','Wrangler',2013],['Jeep','Patriot',2013],
  // Mazda
  ['Mazda','3',2013],['Mazda','3',2016],['Mazda','CX-5',2014],['Mazda','CX-5',2018],['Mazda','6',2014],
  // Subaru
  ['Subaru','Forester',2013],['Subaru','Forester',2017],['Subaru','Outback',2013],['Subaru','Impreza',2013],
  ['Subaru','Legacy',2013],['Subaru','XV',2015],
  // Lexus
  ['Lexus','RX',2013],['Lexus','RX',2016],['Lexus','ES',2013],['Lexus','GX',2013],['Lexus','LX',2013],
  // Audi
  ['Audi','A4',2013],['Audi','A4',2016],['Audi','Q5',2013],['Audi','A6',2013],['Audi','Q7',2013],
  // Opel
  ['Opel','Astra',2012],['Opel','Insignia',2013],['Opel','Corsa',2013],['Opel','Zafira',2012],
  ['Opel','Vectra',2008],['Opel','Mokka',2014],
  // Dodge
  ['Dodge','Charger',2013],['Dodge','Journey',2013],['Dodge','Caravan',2013],
  // Volvo
  ['Volvo','XC90',2013],['Volvo','XC60',2013],['Volvo','S60',2013],
  // Renault
  ['Renault','Duster',2015],['Renault','Megane',2013],['Renault','Logan',2013],
  // Land Rover
  ['Land Rover','Range Rover Sport',2013],['Land Rover','Discovery',2013],['Land Rover','Range Rover Evoque',2013],
];

const CATEGORIES = Object.keys(mapping);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchByCategoryName(make, model, year, categoryEn) {
  try {
    const url = `http://localhost:3001/api/autodoc/byCategoryName?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}&categoryEn=${encodeURIComponent(categoryEn)}`;
    const r = await fetch(url);
    return await r.json();
  } catch (e) { return { found: false, error: e.message }; }
}

async function fetchCrossRef(articleId) {
  try {
    const url = `http://localhost:3001/api/autodoc/crossref/article/${articleId}`;
    const r = await fetch(url);
    const d = await r.json();
    const arr = Array.isArray(d) ? d : (d.crossReferences || d.articles || []);
    return arr.map(x => x.articleNo || x.crossNumber || '').filter(Boolean).slice(0, 10).join(',');
  } catch (e) { return ''; }
}

(async () => {
  let totalSaved = 0, totalCalls = 0, totalCrossRefCalls = 0, totalErrors = 0;
  const totalCombos = VEHICLES.length * CATEGORIES.length;
  console.log(`სულ: ${VEHICLES.length} მანქანა x ${CATEGORIES.length} კატეგორია = ${totalCombos} კომბინაცია`);
  const startTime = Date.now();

  for (const [make, model, year] of VEHICLES) {
    for (const categoryEn of CATEGORIES) {
      totalCalls++;
      const result = await fetchByCategoryName(make, model, year, categoryEn);
      if (result.found && result.articles?.length > 0) {
        for (const a of result.articles) {
          let crossCodes = '';
          if (a.articleId) {
            crossCodes = await fetchCrossRef(a.articleId);
            totalCrossRefCalls++;
            await sleep(120);
          }
          try {
            await prisma.$executeRaw`
              INSERT INTO autodoc_reference_data (make, model, category_en, brand, article_code, description, image_url, article_id, cross_codes)
              VALUES (${make}, ${model}, ${categoryEn}, ${a.brand||null}, ${a.code||null}, ${a.desc||null}, ${a.image||null}, ${a.articleId||null}, ${crossCodes||null})
              ON CONFLICT (article_code, category_en) DO UPDATE SET cross_codes = EXCLUDED.cross_codes, article_id = EXCLUDED.article_id
            `;
            totalSaved++;
          } catch (e) { totalErrors++; }
        }
      }
      if (totalCalls % 50 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`[${elapsed}s] ${totalCalls}/${totalCombos} category-calls, ${totalCrossRefCalls} crossref-calls, ${totalSaved} records, ${totalErrors} errors`);
      }
      await sleep(250);
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Category calls: ${totalCalls}, CrossRef calls: ${totalCrossRefCalls}, Records saved: ${totalSaved}, Errors: ${totalErrors}`);
  process.exit(0);
})();
