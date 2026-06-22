const http = require('http');
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
    req.write(body); req.end();
  });
}
(async () => {
  for (const msg of ['brake pad', '03L121011P']) {
    const d = await post(msg);
    console.log('\n"' + msg + '"');
    console.log('parsed:', JSON.stringify(d.parsed, null, 2));
    console.log('type:', d.type);
    console.log('count:', d.count);
    await new Promise(r => setTimeout(r, 1500));
  }
})();
