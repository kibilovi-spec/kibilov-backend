const http = require('http');

function get(path) {
  return new Promise((resolve) => {
    const r = http.request({hostname:'localhost',port:3002,path,method:'GET'}, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>resolve({status:res.statusCode,len:d.length}));
    });
    r.on('error',e=>resolve({status:0,len:0,err:e.message}));
    r.end();
  });
}

async function main() {
  const pages = [
    ['/',                'მთავარი'],
    ['/shop',            'Shop'],
    ['/b2b',             'B2B'],
    ['/cart',            'Cart'],
    ['/wishlist',        'Wishlist'],
    ['/vin',             'VIN'],
    ['/admin',           'Admin'],
    ['/admin/analytics', 'AI Analytics'],
    ['/auth',            'Auth'],
    ['/parts-finder',    'Parts Finder'],
    ['/contact',         'Contact'],
    ['/supplier/register','Supplier'],
  ];

  console.log('\n=== Frontend Pages (port 3002) ===\n');
  for (const [path, name] of pages) {
    const r = await get(path);
    const ok = r.status === 200;
    console.log(`${ok?'✅':'❌'} ${name.padEnd(15)} [${r.status}] ${r.len>0?r.len+' bytes':r.err||'empty'}`);
    await new Promise(resolve=>setTimeout(resolve,150));
  }
}
main();
