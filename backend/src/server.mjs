import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { FileStore } from './store.mjs';
import { createApi } from './api.mjs';
import { seedEvents } from './seed.mjs';
import { ensure } from './domain.mjs';
// Deliberately bound to loopback. This demo identity mechanism is never in Lambda.
const data=new URL('../../.local/',import.meta.url);await mkdir(data,{recursive:true});
let secret;try{secret=await readFile(new URL('token-secret',data),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;secret=randomBytes(48).toString('hex');await writeFile(new URL('token-secret',data),secret);}
const api=createApi(new FileStore(fileURLToPath(new URL('events.json',data)),seedEvents()),secret);
const users={'organizer-demo':{id:'organizer-demo',name:'Alex Morgan',role:'organizer'},'student-1':{id:'student-1',name:'Jamie Chen',role:'attendee'},'student-2':{id:'student-2',name:'Priya Shah',role:'attendee'},'student-3':{id:'student-3',name:'Sam Rivera',role:'attendee'}};
const origin=process.env.ALLOWED_ORIGIN||'http://127.0.0.1:5173';
createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.headers.origin===origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Headers','content-type,x-demo-user');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS');
  try{
    ensure(!req.headers.origin || req.headers.origin===origin,403,'Origin not allowed.');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    let raw='';for await(const chunk of req){raw+=chunk;ensure(Buffer.byteLength(raw)<=16384,413,'Request is too large.');}
    let body;try{body=JSON.parse(raw||'{}');}catch{ensure(false,400,'Invalid JSON.');}
    const result=await api({method:req.method,path:new URL(req.url,'http://localhost').pathname,user:users[req.headers['x-demo-user']]||null,body});res.end(JSON.stringify(result));
  }catch(e){res.writeHead(e.status||500);res.end(JSON.stringify({error:e.status?e.message:'Unexpected server error.'}));if(!e.status)console.error(e);}
}).listen(Number(process.env.PORT)||3001,'127.0.0.1',()=>console.log('CloudMeet local demo API: http://127.0.0.1:3001 (synthetic identities, file persistence)'));
