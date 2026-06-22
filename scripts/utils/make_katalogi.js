const XLSX = require('xlsx');
const wb_src = XLSX.readFile('/mnt/user-data/uploads/კატალოგი_-_03_04_2026.xlsx');
const wb_out = XLSX.utils.book_new();
const data = [['A — კოდი', 'B — დასახელება (OEM კოდებით)', 'C — რაოდენობა', 'D — ფასი (₾)', 'E — ბრენდი']];
const seen = new Set();
for (const sheet of wb_src.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb_src.Sheets[sheet], {header:1});
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const sku = String(r[0]||'').trim();
    const price = parseFloat(r[9]||0);
    if (!sku || seen.has(sku) || price <= 0) continue;
    seen.add(sku);
    const nameB = String(r[1]||'').trim();
    const nameC = String(r[2]||'').trim();
    const cross = String(r[4]||'').trim();
    const brand = String(r[5]||'').trim();
    const name = nameB + (nameC?' '+nameC:'') + (cross?' | '+cross+' |':'');
    data.push([sku, name.trim(), 2, price, brand]);
  }
}
const ws = XLSX.utils.aoa_to_sheet(data);
XLSX.utils.book_append_sheet(wb_out, ws, 'FINA Import');
XLSX.writeFile(wb_out, '/tmp/katalogi_v4.xlsx');
console.log('rows:', data.length-1);
