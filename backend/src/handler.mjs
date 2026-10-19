import { DynamoStore } from './store.mjs';
import { createApi } from './api.mjs';
import { authenticate } from './auth.mjs';
let api;
export async function handler(event) {
  const method=event.requestContext?.http?.method || event.httpMethod;
  const headers={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'};
  try {
    if(method==='OPTIONS')return {statusCode:204,headers,body:''};
    if(!process.env.EVENTS_TABLE || !process.env.TOKEN_SECRET || process.env.TOKEN_SECRET.length<32)throw Object.assign(new Error('Backend configuration is incomplete.'),{status:503});
    api ||= createApi(new DynamoStore(process.env.EVENTS_TABLE),process.env.TOKEN_SECRET);
    const raw=event.body ? Buffer.from(event.body,event.isBase64Encoded?'base64':'utf8').toString() : '{}';
    if(Buffer.byteLength(raw)>16384)throw Object.assign(new Error('Request is too large.'),{status:413});
    let body;try{body=JSON.parse(raw);}catch{throw Object.assign(new Error('Invalid JSON.'),{status:400});}
    const user=await authenticate(event.headers||{});
    const result=await api({method,path:event.rawPath||event.path,user,body});
    return {statusCode:200,headers,body:JSON.stringify(result)};
  } catch(e){if(!e.status)console.error('Request failed', {name:e.name});return {statusCode:e.status||500,headers,body:JSON.stringify({error:e.status?e.message:'Something went wrong. Please try again.'})};}
}
