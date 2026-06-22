const http = require('http');
function post(msg) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({message: msg});
    const req = http.request({
      hostname:'localhost',port:3001,path:'/api/ai/chat',
      method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d))}catch(e){resolve({raw:d})} }); });
    req.on('error',reject); req.write(body); req.end();
  });
}
(async()=>{
  const d = await post('brake pad');
  console.log('count:', d.count);
  console.log('products[0]:', d.products?.[0]?.nameKa?.slice(0,40));
  console.log('parsed:', JSON.stringify(d.parsed));
  console.log('raw keys:', Object.keys(d));
  if (d.raw) console.log('raw:', d.raw.slice(0,200));
})();
