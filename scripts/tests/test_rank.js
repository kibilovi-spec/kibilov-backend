const http = require('http');
function post(msg) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({message: msg});
    const req = http.request({
      hostname:'localhost',port:3001,path:'/api/ai/chat',
      method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d))); });
    req.on('error',reject); req.write(body); req.end();
  });
}
(async()=>{
  const d = await post('E90 კალოტკა');
  console.log('top 5:');
  d.products.slice(0,5).forEach(p => {
    const bmw = (p.alternativeSearchKeys||[]).filter(k=>k.toLowerCase().includes('bmw'));
    console.log(`score:${p._score} | ${p.nameKa.slice(0,50)} | bmw_keys:${bmw.length}`);
  });
})();
