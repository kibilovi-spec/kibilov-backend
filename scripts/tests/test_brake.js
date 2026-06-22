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
  const d = await post('brake pad');
  console.log('parsed:', JSON.stringify(d.parsed));
  console.log('search_terms:', d.parsed?.search_terms);
  console.log('count:', d.count);
})();
