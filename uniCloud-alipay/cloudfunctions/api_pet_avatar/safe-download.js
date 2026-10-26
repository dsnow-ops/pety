'use strict';
const https=require('https'),dns=require('dns'),net=require('net');
const DEFAULT_HOSTS=['dashscope-result-bj.oss-cn-beijing.aliyuncs.com','dashscope-result-sz.oss-cn-shenzhen.aliyuncs.com','dashscope-result-wlcb.oss-cn-wulanchabu.aliyuncs.com','dashscope-7c2c.oss-accelerate.aliyuncs.com'];
const fail=code=>{const e=new Error(code);e.code=code;return e;};
function isPublicAddress(address){
 if(net.isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19));}
 // Reject mapped/NAT64/tunnel and non-global IPv6 instead of interpreting aliases.
 if(net.isIP(address)===6)return /^[23][0-9a-f]{3}:/i.test(address)&&!/^2001:(?:db8|0|2|10):/i.test(address)&&!/^2002:/i.test(address);
 return false;
}
function validateUrl(value,extraHosts=[]){
 let url;try{url=new URL(String(value));}catch(_){throw fail('INVALID_RESULT_URL');}
 const hosts=[...DEFAULT_HOSTS,...extraHosts];
 const host=url.hostname.toLowerCase();
 const allowed=hosts.includes(host)||/^[a-z0-9-]+(?:\.normal)?\.cloudstatic\.cn$/.test(host);
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port&&url.port!=='443'||net.isIP(host.replace(/^\[|\]$/g,''))||!allowed)throw fail('INVALID_RESULT_URL');
 return url;
}
function createDownloader({lookup=(host)=>dns.promises.lookup(host,{all:true,verbatim:true}),get=(...args)=>https.get(...args),hosts=[],timeoutMs=20000}={}){
 async function download(value,redirectsLeft=2,maxBytes=25*1024*1024){
  const initialUrl=validateUrl(value,hosts);
  return new Promise((resolve,reject)=>{
   let settled=false;
   const requests=new Set(),responses=new Set();
   // One deadline covers DNS and every redirect. A rejected promise must also
   // stop its sockets; otherwise an abandoned child can keep spending traffic.
   const timer=setTimeout(()=>finish(fail('RESULT_DOWNLOAD_TIMEOUT')),timeoutMs);
   function finish(error,data){
    if(settled)return;
    settled=true;clearTimeout(timer);
    if(error){
     for(const response of responses)response.destroy();
     for(const request of requests)request.destroy();
    }
    error?reject(error):resolve(data);
   }
   async function hop(url,remaining){
    try{
     // Resolve once per hop, validate all answers and pin TLS to the checked
     // address. Late DNS completion cannot start I/O after the root timed out.
     const addresses=await lookup(url.hostname);
     if(settled)return;
     if(!addresses.length||addresses.some(r=>!isPublicAddress(r.address)))throw fail('INVALID_RESULT_ADDRESS');
     const chosen=addresses[0];let redirected=false;
     const request=get(url,{agent:false,lookup:(hostname,options,callback)=>{if(options?.all)callback(null,[chosen]);else callback(null,chosen.address,chosen.family);}},response=>{
      if(settled){response.destroy();return;}
      responses.add(response);
      let ended=false;
      response.on('error',error=>{if(!redirected)finish(error);});
      response.on('aborted',()=>{if(!redirected)finish(fail('RESULT_DOWNLOAD_INCOMPLETE'));});
      response.on('close',()=>{if(!redirected&&!ended&&!settled)finish(fail('RESULT_DOWNLOAD_INCOMPLETE'));});
      if([301,302,303,307,308].includes(response.statusCode)){
       if(!response.headers.location||remaining<=0)return finish(fail('RESULT_REDIRECT_REJECTED'));
       let target;try{target=validateUrl(new URL(response.headers.location,url).toString(),hosts);}catch(error){return finish(error);}
       redirected=true;
       // This connection has no reusable agent. Close the unwanted body rather
       // than draining it; only the approved final image should be consumed.
       response.destroy();
       hop(target,remaining-1);return;
      }
      if(response.statusCode!==200)return finish(fail('RESULT_DOWNLOAD_FAILED'));
      const contentType=String(response.headers['content-type']||'').split(';')[0].trim().toLowerCase();
      if(!['image/png','image/jpeg','application/octet-stream'].includes(contentType))return finish(fail('RESULT_RESPONSE_TYPE_REJECTED'));
      if(Number(response.headers['content-length'])>maxBytes)return finish(fail('RESULT_TOO_LARGE'));
      const chunks=[];let size=0;
      response.on('data',chunk=>{
       if(settled)return;
       size+=chunk.length;
       if(size>maxBytes)finish(fail('RESULT_TOO_LARGE'));else chunks.push(chunk);
      });
      response.on('end',()=>{
       ended=true;responses.delete(response);
       if(settled)return;
       if(response.complete===false)return finish(fail('RESULT_DOWNLOAD_INCOMPLETE'));
       finish(null,Buffer.concat(chunks));
      });
     });
     request.on('error',error=>{if(!redirected)finish(error);});
     if(settled)request.destroy();else requests.add(request);
    }catch(error){finish(error);}
   }
   hop(initialUrl,redirectsLeft);
  });
 }
 return download;
}
function downloadHttps(...args){const hosts=String(process.env.PETY_ASSET_DOWNLOAD_HOSTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(x=>/^[a-z0-9.-]+$/.test(x));return createDownloader({hosts})(...args);}
module.exports={downloadHttps,createDownloader,isPublicAddress,validateUrl};
