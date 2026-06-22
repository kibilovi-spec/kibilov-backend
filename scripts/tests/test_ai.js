const http = require('http');

const tests = [
  "კალოტკა", "ბუქსა", "გრანატა",
  "E90 კალოტკა", "W204 ბუქსა",
  "Golf 6 2010 წინა კალოტკა",
  "Golf 6 2014 წინა კალოტკა",
  "brake pad", "колодка", "03L121011P"
];

function post(msg) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({message: msg});
    const req = http.request({
      hostname: 'localhost', port: 3001, path: '/api/ai/chat',
      method: 'POST', headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  for (const msg of tests) {
    try {
      const d = await post(msg);
      const p = d.parsed || {};
      const top = d.products?.[0];
      const zero = d.products?.filter(x => x.stock === 0).length || 0;
      console.log(`\n"${msg}"`);
      console.log(`  brand:${p.brand||'?'} | part:${p.part_ka||'?'} | n:${d.count||0} | zero_stock:${zero}`);
      console.log(`  #1: ${top ? top.nameKa.slice(0,60) : 'ვერ იპოვა'}`);
      if (d.suggestions?.length) console.log(`  suggest: ${d.suggestions.slice(0,2).join(', ')}`);
    } catch(e) { console.log(`"${msg}" ERROR: ${e.message}`); }
    await new Promise(r => setTimeout(r, 1200));
  }
})();
