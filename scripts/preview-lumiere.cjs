// Serve the actual H5 build locally. No cloud proxy and no public interface.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve('unpackage/lumiere-ui-20260927/h5');
http.createServer((req,res)=>{
 const name=decodeURIComponent(req.url.split('?')[0]);
 const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');
 res.end(fs.readFileSync(file));
}).listen(4196,'127.0.0.1',()=>console.log('Lumière H5: http://127.0.0.1:4196'));
