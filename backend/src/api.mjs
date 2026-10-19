import { randomUUID } from 'node:crypto';
import { ensure, validateEvent, authorizeOwner, register, cancel, checkIn, view, statistics } from './domain.mjs';
export function createApi(store,secret) {
  return async ({method,path,user,body={}}) => {
    ensure(body && typeof body==='object' && !Array.isArray(body),400,'Request body must be a JSON object.');
    const parts=path.replace(/\/$/,'').split('/').filter(Boolean);
    if(method==='GET' && path==='/health')return {ok:true};
    ensure(parts[0]==='events',404,'Endpoint not found.');
    if(parts.length===1 && method==='GET')return (await store.list()).map(e=>view(e,user,secret)).sort((a,b)=>a.startTime.localeCompare(b.startTime));
    if(parts.length===1 && method==='POST') {
      ensure(user,401,'Please sign in.');ensure(user.role==='organizer',403,'Organizer access required.');
      const event={...validateEvent(body),eventId:randomUUID(),organizerId:user.id,organizerName:user.name,createdAt:new Date().toISOString(),status:'PUBLISHED',registrations:[]};
      return view(await store.create(event),user,secret);
    }
    const id=parts[1];ensure(id && /^[a-zA-Z0-9_-]{1,100}$/.test(id),400,'Invalid event ID.');
    if(parts.length===2 && method==='GET')return view(await store.get(id),user,secret);
    ensure(user,401,'Please sign in.');
    if(parts.length===3 && parts[2]==='stats' && method==='GET'){const event=await store.get(id);authorizeOwner(event,user);return statistics(event);}
    if(parts.length===2 && method==='PATCH')return view(await store.mutate(id,event=>{authorizeOwner(event,user);const next=validateEvent({...event,...body});ensure(next.capacity>=statistics(event).confirmed,409,'Capacity cannot be less than confirmed registrations.');ensure(!(next.capacity>event.capacity && statistics(event).waitlisted),409,'Resolve the waitlist before increasing capacity.');Object.assign(event,next);}),user,secret);
    if(parts.length===3 && method==='POST') {
      const action=parts[2];ensure(['register','cancel','check-in'].includes(action),404,'Endpoint not found.');
      return view(await store.mutate(id,event=>{if(action==='register')register(event,user,secret);if(action==='cancel')cancel(event,user);if(action==='check-in')checkIn(event,user,body.token);}),user,secret);
    }
    ensure(false,404,'Endpoint not found.');
  };
}
