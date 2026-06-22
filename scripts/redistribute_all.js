
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// nameKa-ში სიტყვების მიხედვით კატეგორიის განსაზღვრა
function detectSlug(nameKa) {
  const n = nameKa.toLowerCase();
  // სამუხრუჭე
  if (n.includes('სამუხრ') || n.includes('ხუნდ') || n.includes('კალოტკ') || n.includes('ნაკანეჩნ')) {
    if (n.includes('წინა')) return 'brake-pads-front';
    if (n.includes('უკანა')) return 'brake-pads-rear';
    return 'brake-pads-front';
  }
  if (n.includes('სამუხრუჭე დისკ') || n.includes('ტორმუზის დისკ')) return 'brake-diski';
  if (n.includes('სუპორტ') || n.includes('სტრემიანკ')) return 'brake-suporti';
  if (n.includes('მუხრუჭის ტროს')) return 'brake-torsi';
  if (n.includes('მუხრუჭის სენსორ') || n.includes('სამუხრ') && n.includes('სადენ')) return 'brake-sensori';
  // ფილტრები
  if (n.includes('ზეთის ფილტ') || n.includes('ზეთ') && n.includes('ფილტ')) return 'filt-zetis';
  if (n.includes('ჰაერის ფილტ') || n.includes('ჰაერ') && n.includes('ფილტ')) return 'filt-haeri';
  if (n.includes('სალონის ფილტ') || n.includes('სალონ') && n.includes('ფილტ')) return 'filt-saloni';
  if (n.includes('საწვავის ფილტ') || n.includes('საწვავ') && n.includes('ფილტ')) return 'filt-sawvavi';
  // ამორტიზაცია
  if (n.includes('ამორტიზატ') || n.includes('სტოიკ') || n.includes('ბულდოგ')) return 'amortizacia';
  if (n.includes('ზამბარ') || n.includes('რესორ')) return 'amort-resori';
  if (n.includes('ამორტიზ') && n.includes('საკისარ')) return 'amort-sakirsi';
  if (n.includes('სუხოის') || n.includes('საყრდენი რეზინ')) return 'savali-sukho';
  // სავალი
  if (n.includes('შარავო') || n.includes('შარავოი')) return 'savali-sharavoebi';
  if (n.includes('სტუპიც') || n.includes('საკისარ') || n.includes('პაჩებნ') || n.includes('ბუქს')) return 'savali-stupicebi';
  if (n.includes('სილენბლოკ') || n.includes('სუხოი')) return 'savali-sukho';
  if (n.includes('სტაბილიზატ')) return 'savali-other';
  if (n.includes('სტერჟინ') || n.includes('ტიაგ') || n.includes('რაზვალ') || n.includes('რიჩაგ') || n.includes('ბერკეტ')) return 'savali-sterjinebi';
  // ღვედები
  if (n.includes('ღვედ') && !n.includes('ღვედის ტუმბ')) return 'eng-ghvedi';
  if (n.includes('ღვედის დამჭიმ') || n.includes('დამჭიმის როლიკ')) return 'eng-tensioner';
  if (n.includes('ჯაჭვ') || n.includes('ცეპ')) return 'eng-cepi';
  // ძრავი
  if (n.includes('ბაბინ')) return 'eng-anteba';
  if (n.includes('სანთელ')) return 'eng-anteba';
  if (n.includes('ინჟექტ')) return 'engines';
  if (n.includes('ტურბო')) return 'eng-turbo';
  if (n.includes('ძრავის ბალიშ') || n.includes('ძრავის საყრდენ')) return 'eng-balishi';
  if (n.includes('ძრავის ზეთ') || n.includes('მოტორ') && n.includes('ზეთ')) return 'oil-engine';
  if (n.includes('კოლექტორ') || n.includes('შუასადებ') || n.includes('გასკეტ')) return 'eng-gasket';
  if (n.includes('წყლის ტუმბ') || n.includes('ტოსოლის პომპ') || n.includes('water pump')) return 'cool-tumbo';
  if (n.includes('თერმოსტატ')) return 'cool-termostati';
  if (n.includes('რადიატორ')) return 'cool-radiatori';
  if (n.includes('ანტიფრიზ')) return 'oil-antifreeze';
  if (n.includes('გაგრილ') && n.includes('შლანგ')) return 'cool-shlang';
  if (n.includes('ვენტილატ')) return 'cool-ventilatori';
  // ელექტრო
  if (n.includes('სტარტერ') || n.includes('ბენდექს')) return 'elec-starteri';
  if (n.includes('გენერატ') || n.includes('დინამო')) return 'elec-dinamo';
  if (n.includes('ნათურ') || n.includes('ლამბ') || n.includes('სტოპ') || n.includes('ფარ') && n.includes('ნათ')) return 'elec-nathura';
  if (n.includes('სენსორ') || n.includes('დაჩიკ')) return 'eng-sensor';
  // საჭე
  if (n.includes('საჭის რეიკ') || n.includes('საჭის ნასოს') || n.includes('ჰიდრავლ') && n.includes('ტუმბ')) return 'steering';
  if (n.includes('სარკ')) return 'body-sarke';
  // გადაბმულობა
  if (n.includes('ვიჟიმნო') || n.includes('კლაჩ') || n.includes('ფერადო') || n.includes('მუფტ')) return 'clutch';
  // კარდანი/შრუსი
  if (n.includes('შრუს') || n.includes('ყუმბარ') || n.includes('კვ სახსარ')) return 'savali-yumbarebi';
  if (n.includes('კარდან')) return 'drive-kardani';
  if (n.includes('სალნიკ') || n.includes('ჩობალ')) return 'savali-salnikebi';
  // ზეთები
  if (n.includes('ზეთი') || n.includes('oil') && !n.includes('ფილტ')) return 'oils-fluids';
  return null;
}

async function main() {
  const allCats = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catMap = {};
  allCats.forEach(c => catMap[c.slug] = c.id);

  // ყველა პროდუქტი რომელიც შეიძლება გადავანაწილოთ
  const REDISTRIB_SLUGS = ['driveshaft','engines','electrics','amortizacia','eng-ghvedi'];
  
  for (const fromSlug of REDISTRIB_SLUGS) {
    if (!catMap[fromSlug]) continue;
    const products = await prisma.product.findMany({
      where: { categoryId: catMap[fromSlug] },
      select: { id: true, nameKa: true }
    });
    
    let moved = 0, stayed = 0;
    for (const p of products) {
      const newSlug = detectSlug(p.nameKa || '');
      if (newSlug && newSlug !== fromSlug && catMap[newSlug]) {
        await prisma.product.update({ where: { id: p.id }, data: { categoryId: catMap[newSlug] } });
        moved++;
      } else {
        stayed++;
      }
    }
    console.log(fromSlug + ': გადავიდა=' + moved + ' დარჩა=' + stayed);
  }
  
  await prisma.$disconnect();
}
main().catch(console.error);
