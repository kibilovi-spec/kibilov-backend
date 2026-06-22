require('dotenv').config();
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const wb = XLSX.readFile('/tmp/fina.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const all = XLSX.utils.sheet_to_json(ws, { header: 1 });
const hi = all.findIndex(r => r && r.includes('კოდი'));
const h = all[hi];
const si = h.indexOf('კოდი');
const ni = h.indexOf('დასახელება');
const sti = h.indexOf('საბოლოო ნაშთი');
const pi = h.findIndex(x => x && String(x) === 'ერთეულის ფასი');

(async () => {
  let added = 0, updated = 0, deactivated = 0;
  const excelSkus = new Set();

  // ყველა Excel-ის SKU დავაგროვოთ
  for (let i = hi + 1; i < all.length; i++) {
    const r = all[i];
    if (!r || !r[si]) continue;
    const sku = String(r[si]).trim();
    if (sku) excelSkus.add(sku);
  }

  // UPDATE ან CREATE
  for (let i = hi + 1; i < all.length; i++) {
    const r = all[i];
    if (!r || !r[si]) continue;
    const sku = String(r[si]).trim();
    const nameKa = String(r[ni]).trim();
    const price = parseFloat(r[pi] || 0);
    const stock = parseInt(r[sti] || 0);
    if (!sku || !nameKa) continue;
    const b2bPrice = price >= 500 ? parseFloat((price * 0.85).toFixed(2)) : parseFloat((price * 0.90).toFixed(2));

    const ex = await prisma.product.findFirst({ where: { sku } });
    if (ex) {
      // UPDATE — nameKa, price, stock, b2bPrice, isActive=true
      // autodoc_category_id, oemCodes, images — ხელი არ ეხება!
      await prisma.product.update({
        where: { id: ex.id },
        data: { nameKa, nameEn: nameKa, price, stock, b2bPrice, isActive: true }
      });
      updated++;
    } else {
      await prisma.product.create({
        data: { sku, nameKa, nameEn: nameKa, nameRu: nameKa, price, stock, b2bPrice, brand: 'Generic', isActive: true }
      });
      added++;
    }
  }

  // Excel-ში აღარ მყოფი პროდუქტები — გათიშე (ნუ წაშალე!)
  const allActive = await prisma.product.findMany({ where: { isActive: true }, select: { id: true, sku: true } });
  for (const p of allActive) {
    if (!excelSkus.has(p.sku)) {
      await prisma.product.update({ where: { id: p.id }, data: { isActive: false, stock: 0 } });
      deactivated++;
    }
  }

  console.log(`✅ added: ${added} | updated: ${updated} | deactivated: ${deactivated}`);
  await prisma.$disconnect();
})();
