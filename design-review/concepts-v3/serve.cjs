'use strict';
// Approval-only prototype: no application configuration, account storage or APIs.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.md':'text/markdown; charset=utf-8'};
http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
 let file;
 if(url==='/')file=path.join(__dirname,'review.html');
 else if(/^\/(?:index\.html|review\.html|concepts\.css|concepts\.js|gallery\.css|plans\.md|[a-z0-9-]+\.png)$/.test(url))file=path.join(__dirname,url.slice(1));
 else if(/^\/assets\/(?:logo-full\.png|mascot\/[a-z-]+\.webp)$/.test(url))file=path.join(root,url.slice(1));
 if(!file){res.writeHead(404);return res.end('Not found');}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);});
}).listen(8096,'127.0.0.1',()=>console.log('Design comparison: http://localhost:8096/ — isolated prototype.'));
