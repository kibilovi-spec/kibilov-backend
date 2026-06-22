require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Category keywords mapping
const CATEGORY_MAP = [
  { id: '67fb26a0-07e7-4507-a453-6a356e5c80c7', keywords: ['ამორტიზატორ','amort','შოკ','სტოიკა','strut','მაყუჩ'] },
  { id: 'f00edd83-c801-4c19-8cc2-2804692cff87', keywords: ['სამუხრუჭ','brake','ხუნდ','დისკ','კოლოდკ','disk','ბარაბან'] },
  { id: '3b06805d-f351-43ef-9d38-020317c11f49', keywords: ['ძრავ','engine','მძრავ','გოლოვკ','პორშენ','piston','კლაპან','valve','ბაქან'] },
  { id: '886e1c7e-39af-4018-a331-fda97f17ccb8', keywords: ['გაგრილ','cooling','ტერმოსტატ','ვენტილ','radiat','pompa','პომპ','coolant'] },
  { id: '42f03c16-0da3-4818-a99e-5ea5f9b28fb7', keywords: ['ფილტრ','filter','საჰაერ','ზეთის','საწვავ','სალონ','cabin','air','oil','fuel'] },
  { id: '2a89969a-e368-4144-80b0-aab22f758fa6', keywords: ['საჭ','steering','ბულინგ','ტიაგ','tie rod','რულ','рул'] },
  { id: 'be12f97b-f61b-45f1-89c9-50ea850d18bd', keywords: ['ელექტრ','electr','ბაბინ','სანთელ','spark','alternator','გენ','სტარტ','starter','sensor','სენსორ','ლამბ','датч'] },
  { id: '9c6c1c2d-8e89-4057-aebc-ab4c59bdf671', keywords: ['გადაბმულ','clutch','კლაჩ','კორზინ','диск сцеп'] },
  { id: 'b0fbdc66-7c87-401e-8460-9f70ef79f92d', keywords: ['დაკიდ','სუსპ','suspension','ბოდ','ბერკეტ','სახსარ','ball joint','ზამბარ','spring','სტერჟინ','შტანგ','стабил'] },
  { id: 'b1720086-8637-4e9b-a465-019888ddaf6a', keywords: ['სავალ','ბუქს','hub','bearing','კარდან','cardan','шрус','სრუს','granata','ნახევარღერძ'] },
  { id: '12b810ed-9e95-4682-8e40-ec3bccf70681', keywords: ['ზეთ','oil','სითხ','fluid','антифриз','тормозная жидк','brake fluid'] },
  { id: '820b15b4-0f8e-47e9-9442-17c80db67c2f', keywords: ['მინ','glass','windscreen','ფანჯარ'] },
  { id: 'ae9bf803-0bf8-4e4d-a932-4741a07114bc', keywords: ['საბურავ','tyre','tire','disk','დისკ','rim'] },
  { id: 'c26daf68-ebef-473b-96fd-6df827375b8a', keywords: ['ძარ','body','bamper','ბამპერ','კაფot','კრыло','крыло','дверь','კარ'] },
  { id: '528bc05f-f7e8-46a8-a5b4-500f8c9979bd', keywords: ['აქსესუარ','accessory','სარკ','mirror'] },
];

function detectCategory(nameKa) {
  const lower = nameKa.toLowerCase();
  for (const cat of CATEGORY_MAP) {
    for (const kw of cat.keywords) {
      if (lower.includes(kw.toLowerCase())) return cat.id;
    }
  }
  return null;
}

async function run() {
  // Get products without category
  const products = await prisma.product.findMany({
    where: { categoryId: null },
    select: { id: true, nameKa: true }
  });
  
  console.log(`კატეგორიის გარეშე: ${products.length} პროდუქტი`);
  
  let matched = 0, skipped = 0;
  for (const p of products) {
    const catId = detectCategory(p.nameKa || '');
    if (catId) {
      await prisma.product.update({ where: { id: p.id }, data: { categoryId: catId } });
      matched++;
    } else {
      skipped++;
    }
  }
  
  console.log(`✅ კატეგორია მიენიჭა: ${matched}`);
  console.log(`⏭️ ვერ განისაზღვრა: ${skipped}`);
  await prisma.$disconnect();
}

run().catch(console.error);
