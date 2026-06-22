const http = require('http');
function req(method, path, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {'Content-Type':'application/json'};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request({hostname:'localhost',port:3001,path,method,headers}, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{ try{resolve({s:res.statusCode,b:JSON.parse(d)})}catch(e){resolve({s:res.statusCode,b:{}})} });
    });
    r.on('error',e=>resolve({s:0,b:{}}));
    if(data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log('\n=== Backend Routes სრული ტესტი ===\n');
  const tests = [
    // Public
    ['GET',  '/api/categories',                    null, null, 'Categories'],
    ['GET',  '/api/products?limit=3',              null, null, 'Products'],
    ['GET',  '/api/vehicles/makes',                null, null, 'Vehicle Makes'],
    ['GET',  '/api/analytics/search',              null, null, 'Analytics'],
    ['POST', '/api/ai/chat', {message:'კალოტკა'},  null, 'AI Chat'],
    ['POST', '/api/auth/login', {email:'test@test.com',password:'wrong'}, null, 'Auth Login'],
    // Protected (should return 401)
    ['GET',  '/api/cart',    null, null, 'Cart (no auth)'],
    ['GET',  '/api/orders',  null, null, 'Orders (no auth)'],
    ['GET',  '/api/garage',  null, null, 'Garage (no auth)'],
    ['GET',  '/api/wishlist',null, null, 'Wishlist (no auth)'],
    ['GET',  '/api/profile', null, null, 'Profile (no auth)'],
    // Admin (should return 401/403)
    ['GET',  '/api/admin/users', null, null, 'Admin Users (no auth)'],
  ];

  for (const [method, path, body, token, name] of tests) {
    const r = await req(method, path, body, token);
    const ok = r.s >= 200 && r.s < 500;
    const detail = r.b.message || r.b.error || r.b.total || r.b.count || (Array.isArray(r.b) ? r.b.length+'items' : 'ok');
    console.log(`${ok?'✅':'❌'} ${name.padEnd(22)} [${r.s}] ${String(detail).slice(0,40)}`);
    await new Promise(res=>setTimeout(res,300));
  }
}
main();
