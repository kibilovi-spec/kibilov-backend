const http = require('http');
const TOKEN = process.env.TOKEN;

function req(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {'Content-Type':'application/json','Authorization':'Bearer '+TOKEN};
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
  console.log('\n=== Authenticated Endpoints ===\n');
  const tests = [
    ['GET',  '/api/cart',                    null, 'Cart'],
    ['GET',  '/api/orders',                  null, 'Orders'],
    ['GET',  '/api/wishlist',                null, 'Wishlist'],
    ['GET',  '/api/garage',                  null, 'Garage'],
    ['GET',  '/api/auth/me',                 null, 'Profile (me)'],
    ['GET',  '/api/admin/users',             null, 'Admin Users'],
    ['GET',  '/api/admin/orders',            null, 'Admin Orders'],
    ['POST', '/api/garage', {brand:'BMW',model:'3 Series',year:'2011'}, 'Garage Save'],
    ['GET',  '/api/garage',                  null, 'Garage List'],
  ];

  for (const [method, path, body, name] of tests) {
    const r = await req(method, path, body);
    const ok = r.s >= 200 && r.s < 400;
    const detail = r.b.message || r.b.total || r.b.count || 
      (Array.isArray(r.b) ? r.b.length+'items' : 
      (r.b.vehicles ? r.b.vehicles.length+'cars' : 
      (r.b.user ? r.b.user.email : 'ok')));
    console.log(`${ok?'✅':'❌'} ${name.padEnd(20)} [${r.s}] ${String(detail).slice(0,40)}`);
    await new Promise(res=>setTimeout(res,200));
  }
}
main();
