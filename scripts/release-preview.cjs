'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||'unpackage/release-sprint-20261010/build/h5');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
if(!fs.existsSync(path.join(root,'index.html')))throw Error('Build H5 first.');
http.createServer((req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname)),relative=path.relative(root,file);if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403);return res.end();}const target=fs.existsSync(file)&&fs.statSync(file).isFile()?file:path.join(root,'index.html');res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(target).pipe(res);}catch(_){res.writeHead(400);res.end();}}).listen(5187,'127.0.0.1',()=>console.log('Local built H5: http://127.0.0.1:5187/'));
