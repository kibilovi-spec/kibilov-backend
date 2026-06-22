const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.product.findMany({ select: { nameKa: true } })
.then(prods => {
  const POSITION_MAP = [
    /წინა სამუხრუჭე ხუნდი/, /უკანა სამუხრუჭე ხუნდი/, /სამუხრუჭე ხუნდი/,
    /ჰაერის\s+ფილტრი/, /სალონის\s+ფილტრი/, /ზეთის\s+ფილტრი/,
    /საწვავის\s+ფილტრი/, /ძრავის ზეთი/, /სამუხრუჭე დისკი/, /ამორტიზატორი/,
  ];
  const skipped = prods.filter(pr => POSITION_MAP.every(r => !r.test(pr.nameKa)));
  skipped.slice(0, 50).forEach(s => console.log(s.nameKa.replace(/[\r\n]/g,' ').slice(0,80)));
  console.log('\nსულ skipped:', skipped.length);
  p.$disconnect();
});
