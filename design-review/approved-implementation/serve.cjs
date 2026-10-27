const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,reference=path.resolve(root,'../jade-typing');
http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 let file;if(url==='/'||url==='/index.html')file=path.join(root,'index.html');
 else if(/^\/[a-z0-9-]+\.png$/.test(url))file=path.join(root,url.slice(1));
 else if(/^\/jade-typing\/[a-z0-9-]+\.png$/.test(url))file=path.join(reference,path.basename(url));
 if(!file){res.writeHead(404);res.end();return;}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':file.endsWith('.png')?'image/png':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);});
}).listen(8102,'127.0.0.1',()=>console.log('Approved design comparison: http://127.0.0.1:8102/'));
