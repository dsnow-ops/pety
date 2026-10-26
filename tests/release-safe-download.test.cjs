'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createDownloader,isPublicAddress,validateUrl}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/safe-download');
const base='https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com';
test('observed DashScope accelerated result bucket is allowed, without trusting other OSS tenants or lookalikes',async()=>{
 const host='dashscope-7c2c.oss-accelerate.aliyuncs.com';
 assert.equal(validateUrl(`https://${host}/result.png?signature=synthetic`).hostname,host);
 const h=harness([{}]);assert.equal((await h.download(`https://${host}/result.png`)).toString(),'synthetic-image');
 for(const url of [`https://${host}.attacker.invalid/a.png`,'https://other-bucket.oss-accelerate.aliyuncs.com/a.png',`http://${host}/a.png`,`https://${host}:8443/a.png`])assert.throws(()=>validateUrl(url));
 const privateDns=harness([],[{address:'127.0.0.1',family:4}]);
 await assert.rejects(privateDns.download(`https://${host}/a.png`),e=>e.code==='INVALID_RESULT_ADDRESS');
 assert.equal(privateDns.stats().calls,0);
});
test('official Alipay CDN hostname is accepted and lookalike suffixes stay rejected',()=>{
 assert.equal(validateUrl('https://env-test.normal.cloudstatic.cn/a.png').hostname,'env-test.normal.cloudstatic.cn');
 assert.throws(()=>validateUrl('https://env-test.normal.cloudstatic.cn.attacker.invalid/a.png'));
});
function harness(responses,addresses=[{address:'8.8.8.8',family:4}]){
 let calls=0,lookups=0;const pins=[];
 const download=createDownloader({lookup:async()=>{lookups++;return addresses;},get:(url,options,callback)=>{
  calls++;assert.equal(url.protocol,'https:');assert.equal(options.agent,false);assert.equal(options.rejectUnauthorized,undefined);
  options.lookup(url.hostname,{},(err,address,family)=>pins.push({address,family}));
  const request=new EventEmitter();request.destroy=error=>queueMicrotask(()=>request.emit('error',error));
  queueMicrotask(()=>{const row=responses.shift(),response=new EventEmitter();response.statusCode=row.status||200;response.headers={ 'content-type':'image/png',...row.headers};response.resume=()=>{};response.destroy=()=>{};callback(response);if(response.statusCode===200){for(const bytes of row.chunks||[Buffer.from('synthetic-image')])response.emit('data',bytes);response.emit('end');}});return request;
 }});return{download,pins,stats:()=>({calls,lookups})};
}
test('downloader rejects HTTP, credentials, arbitrary domains, ports, numeric loopback and metadata before I/O',async()=>{
 const h=harness([]);for(const url of ['http://127.0.0.1/private','https://169.254.169.254/latest','https://[::1]/','https://user:pass@dashscope-result-bj.oss-cn-beijing.aliyuncs.com/img',base+':8443/x','https://example.com/x','https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com.attacker.test/x'])await assert.rejects(h.download(url),e=>e.code==='INVALID_RESULT_URL');assert.deepEqual(h.stats(),{calls:0,lookups:0});
});
test('every DNS answer must be public and requests pin the checked address to resist rebinding',async()=>{
 for(const address of ['127.0.0.1','10.2.3.4','169.254.169.254','192.168.1.1','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1']){const h=harness([], [{address:'8.8.8.8',family:4},{address,family:address.includes(':')?6:4}]);await assert.rejects(h.download(base+'/x'),e=>e.code==='INVALID_RESULT_ADDRESS');assert.equal(h.stats().calls,0);}
 const h=harness([{}]);assert.equal((await h.download(base+'/x')).toString(),'synthetic-image');assert.deepEqual(h.pins,[{address:'8.8.8.8',family:4}]);assert.equal(isPublicAddress('2606:4700::1111'),true);
});
test('redirects recheck allowlist and DNS, support same-host relative URLs, and never carry authorization',async()=>{
 const bad=harness([{status:302,headers:{location:'http://169.254.169.254/secret'}}]);await assert.rejects(bad.download(base+'/x'),e=>e.code==='INVALID_RESULT_URL');assert.equal(bad.stats().calls,1);
 const good=harness([{status:302,headers:{location:'/next'}},{}]);assert.equal((await good.download(base+'/x')).toString(),'synthetic-image');assert.equal(good.stats().lookups,2);
});
test('response type and streaming/header byte limits stop oversized or nonimage outputs',async()=>{
 for(const response of [{headers:{'content-type':'text/html'}},{headers:{'content-length':'99'}},{chunks:[Buffer.alloc(7),Buffer.alloc(7)]}]){const h=harness([response]);await assert.rejects(h.download(base+'/x',2,10),e=>['RESULT_RESPONSE_TYPE_REJECTED','RESULT_TOO_LARGE'].includes(e.code));}
});
test('image pixel bombs are rejected before PNG allocation while real 2K bytes retain dimensions',()=>{
 const {decodeImage}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/image-quality-gate');
 const {PNG}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/node_modules/pngjs');
 const bomb=Buffer.alloc(32);Buffer.from([137,80,78,71,13,10,26,10]).copy(bomb);bomb.writeUInt32BE(100000,16);bomb.writeUInt32BE(100000,20);assert.throws(()=>decodeImage(bomb));
 const image=new PNG({width:2048,height:2048});image.data.fill(255);const bytes=PNG.sync.write(image),decoded=decodeImage(bytes);assert.equal(decoded.width,2048);assert.equal(decoded.height,2048);
});
