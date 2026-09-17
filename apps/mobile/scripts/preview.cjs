// Local static web preview only, not a production deployment server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.ico':'image/x-icon'};
http.createServer((req,res)=>{
 let pathname;
 try { pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400);res.end();return; }
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(err,data)=>{
  if(err){res.writeHead(404);res.end('Not found. Run npm run export:web first.');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Cache-Control':'no-store'});res.end(data);
 });
}).listen(8085,'127.0.0.1',()=>console.log('QuizWorld Expo WEB preview: http://127.0.0.1:8085 (not a native build)'));
