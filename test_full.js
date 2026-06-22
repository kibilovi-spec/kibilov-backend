const http = require('http');

function req(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3001, path, method,
      headers: { 'Content-Type': 'application/json', ...(data ? {'Content-Length': Buffer.byteLength(data)} : {}) }
    };
    const r = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({status: res.statusCode, body: JSON.parse(d)}); } catch(e) { resolve({status: res.statusCode, body: d}); } });
    });
    r.on('error', e => resolve({status: 0, body: e.message}));
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  const tests = [
    ['GET',  'Categories',     '/api/categories'],
    ['GET',  'Products',       '/api/products?limit=3'],
    ['GET',  'Vehicles',       '/api/vehicles/makes'],
    ['GET',  'Analytics',      '/api/analytics/search'],
    ['GET',  'Garage(noauth)', '/api/garage'],
    ['POST', 'AI Chat',        '/api/ai/chat', {message:'კალოტკა'}],
    ['POST', 'AI VIN',         '/api/ai/chat', {message:'WBAPH7C51BE678254'}],
    ['POST', 'AI scan',        '/api/ai/scan', {image:'test'}],
    ['GET',  'Admin analytics','/api/analytics/search'],
    ['GET',  'Wishlist',       '/api/wishlist'],
    ['GET',  'Cart',           '/api/cart'],
    ['GET',  'Orders',         '/api/orders'],
  ];

  console.log('\n=== kibilov.ge API სრული ტესტი ===\n');
  for (const [method, name, path, body] of tests) {
    const r = await req(method, path, body);
    const ok = r.status >= 200 && r.status < 500;
    const detail = typeof r.body === 'object' 
      ? (r.body.error || r.body.message || r.body.total || r.body.count || (Array.isArray(r.body) ? r.body.length + ' items' : 'ok'))
      : String(r.body).slice(0,40);
    console.log(`${ok ? '✅' : '❌'} ${name.padEnd(20)} [${r.status}] ${detail}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
main();
