const {PrismaClient} = require('@prisma/client');
const XLSX = require('xlsx');
const p = new PrismaClient();

async function generate(res) {
  const rows = await p.$queryRaw`SELECT autodoc_id::text as id, name_ka, name_en, name_slang, parent_id::text as pid FROM autodoc_categories ORDER BY autodoc_id`;
  
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: Import
  const headers = [['A — კოდი (SKU)', 'B — დასახელება + OEM კოდები', 'C — რაოდ.', 'D — ფასი (₾)', 'E — ბრენდი']];
  const samples = [
    ['OIL-001', 'Castrol 5W-30 1L | 0198730 |', 10, 45.00, 'Castrol'],
    ['SP431', 'წინა კალოდკა MB W210 | GDB1205, TRW1015 |', 7, 45.00, 'TRW'],
    ['SH4044P', 'ზეთის ფილტრი VW Golf IV | SH4044P |', 25, 12.00, 'Mann'],
    ['KYB3348', 'ამორტიზატორი Toyota Camry | KYB334368 |', 5, 120.00, 'KYB'],
    ['122810', 'ძრავის ბლოკის შუასადები', 2, 100.00, ''],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet([...headers, ...samples]);
  ws1['!cols'] = [{wch:14},{wch:50},{wch:10},{wch:12},{wch:16}];
  XLSX.utils.book_append_sheet(wb, ws1, 'Import');

  // Sheet 2: წესები
  const rules = [
    ['სვეტი', 'წესი'],
    ['A — კოდი (SKU)', 'აუცილებელი. უნიკალური კოდი. მაგ: SP431, OIL-001, GDB1183'],
    ['B — დასახელება + OEM', 'აუცილებელი. ფორმატი: სახელი | OEM1, OEM2 | მაგ: წინა კალოდკა MB W210 | GDB1205, TRW1015 |'],
    ['C — რაოდენობა', 'აუცილებელი. მხოლოდ რიცხვი. მაგ: 7'],
    ['D — ფასი (₾)', 'აუცილებელი. მხოლოდ რიცხვი. მაგ: 45.00'],
    ['E — ბრენდი', 'სურვილისამებრ. თუ ცარიელია, სახელიდან ავტომატურად გამოიყოფა. მაგ: Castrol, TRW, Mann, Bosch, NGK, KYB'],
    ['', ''],
    ['კატეგორია', 'ავტომატურად განისაზღვრება სახელიდან. F სვეტი საჭირო არ არის.'],
    ['', ''],
    ['SKU', 'უნდა იყოს უნიკალური — დუბლიკატი SKU ახალ ჩანაწერს შექმნის'],
    ['OEM კოდები', 'სურვილისამებრ — | | ჩარჩოში ჩაწერე'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(rules);
  ws2['!cols'] = [{wch:22},{wch:60}];
  XLSX.utils.book_append_sheet(wb, ws2, 'წესები');

  // Sheet 3: კატეგ. სია
  const catHeaders = [['ID', 'ქართული სახელი', 'English Name', 'ხალხური სლენგი', 'მშობელი კატეგ.']];
  const idToName = {};
  rows.forEach(r => { idToName[r.id] = r.name_ka; });
  const catRows = [];
  rows.forEach(r => {
    if (!r.pid) {
      catRows.push([parseInt(r.id), r.name_ka||'', r.name_en||'', r.name_slang||'', '— მთავარი კატეგორია —']);
    } else {
      const parentName = idToName[r.pid] || '';
      catRows.push([parseInt(r.id), r.name_ka||'', r.name_en||'', r.name_slang||'', parentName]);
    }
  });
  const ws3 = XLSX.utils.aoa_to_sheet([...catHeaders, ...catRows]);
  ws3['!cols'] = [{wch:14},{wch:42},{wch:42},{wch:28},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws3, 'კატეგ. სია');

  const buf = XLSX.write(wb, {type:'buffer', bookType:'xlsx'});
  await p.$disconnect();
  return buf;
}

module.exports = { generate };
