const http = require('http');
function get(path) {
  return new Promise((resolve) => {
    const r = http.request({hostname:'localhost',port:3002,path,method:'GET'}, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>resolve({status:res.statusCode,len:d.length}));
    });
    r.on('error',e=>resolve({status:0,len:0}));
    r.end();
  });
}
async function main() {
  const pages = [
    ['/products',        'Products/Shop'],
    ['/products/1',      'Product Detail'],
    ['/b2b-apply',       'B2B Apply'],
    ['/checkout',        'Checkout'],
    ['/parts',           'Parts Finder'],
    ['/categories',      'Categories'],
    ['/brands',          'Brands'],
    ['/my-car',          'My Car'],
    ['/orders',          'Orders'],
    ['/profile',         'Profile'],
    ['/blog',            'Blog'],
    ['/about',           'About'],
    ['/admin/analytics', 'AI Analytics'],
    ['/admin/orders',    'Admin Orders'],
    ['/admin/products',  'Admin Products'],
    ['/admin/users',     'Admin Users'],
    ['/admin/b2b',       'Admin B2B'],
    ['/admin/delivery',  'Admin Delivery'],
    ['/supplier/dashboard','Supplier Dashboard'],
  ];
  console.log('\n=== სრული Page Tests ===\n');
  for (const [path, name] of pages) {
    const r = await get(path);
    const ok = r.status === 200;
    console.log(`${ok?'✅':'❌'} ${name.padEnd(20)} [${r.status}]`);
    await new Promise(res=>setTimeout(res,100));
  }
}
main();
