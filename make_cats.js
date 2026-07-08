const {PrismaClient} = require('@prisma/client');
const XLSX = require('xlsx');
const p = new PrismaClient();
p.$queryRaw`SELECT autodoc_id::text as id, name_ka, name_en, parent_id::text as pid FROM autodoc_categories ORDER BY autodoc_id`.then(rows => {
  const parentMap = {};
  rows.forEach(r => { if (!r.pid) parentMap[r.id] = {ka: r.name_ka, en: r.name_en}; });
  
  const wb = XLSX.utils.book_new();
  const data = [['კატეგ. ID', 'მთავარი კატეგ. (KA)', 'მთავარი კატეგ. (EN)', 'ქვეკატეგ. ID', 'ქვეკატეგ. (KA)', 'ქვეკატეგ. (EN)']];
  
  // მთავარი კატეგორიები
  const parents = rows.filter(r => !r.pid);
  parents.forEach(par => {
    const children = rows.filter(r => r.pid === par.id);
    if (children.length === 0) {
      data.push([parseInt(par.id), par.name_ka, par.name_en, '', '', '']);
    } else {
      children.forEach((child, i) => {
        data.push([
          i === 0 ? parseInt(par.id) : '',
          i === 0 ? par.name_ka : '',
          i === 0 ? par.name_en : '',
          parseInt(child.id),
          child.name_ka || '',
          child.name_en || ''
        ]);
      });
    }
  });
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:12},{wch:35},{wch:35},{wch:12},{wch:35},{wch:35}];
  XLSX.utils.book_append_sheet(wb, ws, 'კატეგორიები');
  XLSX.writeFile(wb, '/tmp/categories_full.xlsx');
  console.log('Done! rows:', data.length);
  p.$disconnect();
}).catch(e => console.error(e));
