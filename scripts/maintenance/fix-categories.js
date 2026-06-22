'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getCategorySlug(name) {
  const n = (name || '').toLowerCase();

  // Oils & Fluids
  if (/ძრავის ზეთი|engine oil|моторное масло/i.test(n)) return 'engine-oils';
  if (/ტრანსმ\.|transmission|трансм|atf|gear oil|კბილან/i.test(n)) return 'transmission-oils';
  if (/ანტიფრიზი|antifreeze|антифриз|coolant/i.test(n)) return 'coolants';
  if (/სამუხ\. სითხე|brake fluid|тормозная жидк|hydrolube brake/i.test(n)) return 'brake-fluids';
  if (/hydraulic|гидравл/i.test(n)) return 'hydraulic-oils';
  if (/ქიმ|chemical|химия/i.test(n)) return 'fluids-chemicals';
  if (/ზეთი|oil|масло/i.test(n)) return 'fluids-lubricants';

  // Filters
  if (/საწვავის ფილტრი|fuel filter|топливный фильтр/i.test(n)) return 'fuel-filters';
  if (/ზეთის ფილტრი|oil filter|масляный фильтр/i.test(n)) return 'oil-filters';
  if (/ჰაერის ფილტრი|air filter|воздушный фильтр/i.test(n)) return 'air-filters';
  if (/სალონის ფილტრი|cabin filter|салонный фильтр/i.test(n)) return 'cabin-filters';
  if (/ფილტრი|filter|фильтр/i.test(n)) return 'filters';

  // Brakes
  if (/წინა სამუხრუჭე ხუნდი|front brake pad/i.test(n)) return 'brake-pads-front';
  if (/უკანა სამუხრუჭე ხუნდი|rear brake pad/i.test(n)) return 'brake-pads-rear';
  if (/სამუხრუჭე ხუნდი|brake pad|тормозные колодки/i.test(n)) return 'brake-pads-front';
  if (/სამუხრუჭე დისკი|brake disc|тормозной диск/i.test(n)) return 'braking-system';
  if (/კალიპერი|caliper/i.test(n)) return 'calipers';

  // Wipers
  if (/მაწმუნდა|wiper|дворник/i.test(n)) return 'wipers';

  return 'fluids-lubricants'; // default
}

async function main() {
  console.log('Loading categories...');
  const categories = await prisma.category.findMany();
  const catMap = {};
  for (const c of categories) catMap[c.slug] = c.id;
  console.log('Available slugs:', Object.keys(catMap).join(', '));

  console.log('Loading products...');
  const products = await prisma.product.findMany({
    select: { id: true, nameKa: true, nameEn: true, nameRu: true }
  });
  console.log(`Total products: ${products.length}`);

  let updated = 0;
  const stats = {};
  const notFound = new Set();

  for (const p of products) {
    const name = p.nameKa || p.nameEn || p.nameRu || '';
    const slug = getCategorySlug(name);
    const categoryId = catMap[slug];

    if (!categoryId) {
      notFound.add(slug);
      continue;
    }

    await prisma.product.update({ where: { id: p.id }, data: { categoryId } });
    stats[slug] = (stats[slug] || 0) + 1;
    updated++;

    if (updated % 100 === 0) console.log(`Updated ${updated}/${products.length}...`);
  }

  console.log('\nDone! Category distribution:');
  for (const [slug, count] of Object.entries(stats)) {
    console.log(`  ${slug}: ${count}`);
  }
  if (notFound.size > 0) {
    console.log('\nNot found slugs:', [...notFound].join(', '));
  }
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
