import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApi} from '../src/api.mjs';
import {FileStore,DynamoStore} from '../src/store.mjs';
import {seedEvents} from '../src/seed.mjs';
const owner={id:'organizer-demo',name:'Alex',role:'organizer'};
const student=id=>({id,name:id,role:'attendee'});
const secret='a-test-secret-that-is-long-enough-for-hmac';
async function setup(t){const dir=await mkdtemp(join(tmpdir(),'cloudmeet-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=new FileStore(join(dir,'events.json'),seedEvents());return {api:createApi(store,secret),store};}
test('capacity, duplicate prevention, FIFO promotion, one-time check-in and durable reload',async t=>{
  const {api,store}=await setup(t);const path='/events/cloud-lab';
  await api({method:'PATCH',path,user:owner,body:{capacity:2}});
  const first=await api({method:'POST',path:path+'/register',user:student('a')});
  const second=await api({method:'POST',path:path+'/register',user:student('b')});
  const third=await api({method:'POST',path:path+'/register',user:student('c')});
  assert.equal(first.registration.status,'CONFIRMED');assert.equal(second.registration.status,'CONFIRMED');assert.equal(third.registration.status,'WAITLISTED');assert.equal(third.registration.waitlistPosition,1);
  await assert.rejects(api({method:'POST',path:path+'/register',user:student('a')}),{status:409});
  await api({method:'POST',path:path+'/cancel',user:student('a')});
  const promoted=await api({method:'GET',path,user:student('c')});assert.equal(promoted.registration.status,'CONFIRMED');assert.ok(promoted.registration.token);
  const token=promoted.registration.token;
  await assert.rejects(api({method:'POST',path:path+'/check-in',user:student('b'),body:{token}}),{status:403});
  await assert.rejects(api({method:'POST',path:path+'/check-in',user:owner,body:{token:'wrong'}}),{status:400});
  await api({method:'POST',path:path+'/check-in',user:owner,body:{token}});
  await assert.rejects(api({method:'POST',path:path+'/check-in',user:owner,body:{token}}),{status:409});
  const stats=await api({method:'GET',path:path+'/stats',user:owner});assert.deepEqual(stats,{confirmed:2,waitlisted:0,checkedIn:1});
  const reloaded=createApi(new FileStore(store.path),secret);assert.equal((await reloaded({method:'GET',path,user:student('c')})).registration.checkedInAt!==undefined,true);
  assert.equal((await store.get('cloud-lab')).registrations.some(r=>'token' in r),false);
});
test('simultaneous last-seat attempts never oversell and duplicates stay unique',async t=>{
  const {api,store}=await setup(t);const path='/events/cloud-lab';await api({method:'PATCH',path,user:owner,body:{capacity:1}});
  const result=await Promise.all(Array.from({length:20},(_,i)=>api({method:'POST',path:path+'/register',user:student('user-'+i)})));
  assert.equal(result.filter(e=>e.registration.status==='CONFIRMED').length,1);
  assert.equal((await store.get('cloud-lab')).registrations.filter(r=>r.status==='WAITLISTED').length,19);
  const duplicate=await Promise.allSettled(Array.from({length:6},()=>api({method:'POST',path:path+'/register',user:student('same')})));
  assert.equal(duplicate.filter(r=>r.status==='fulfilled').length,1);
});
test('authorization, field validation, capacity edits and data privacy',async t=>{
  const {api}=await setup(t);const path='/events/cloud-lab';
  await assert.rejects(api({method:'POST',path:'/events',body:{}}),{status:401});
  await assert.rejects(api({method:'POST',path:'/events',user:student('x'),body:{}}),{status:403});
  await assert.rejects(api({method:'PATCH',path,user:{...owner,id:'other'},body:{title:'Stolen'}}),{status:403});
  for(const body of [{capacity:1.2},{capacity:0},{endTime:'not a date'},{meetingRoomRef:'https://bad.example/a'},{category:'Bad'}])await assert.rejects(api({method:'PATCH',path,user:owner,body}),{status:400});
  await api({method:'PATCH',path,user:owner,body:{capacity:1}});
  await api({method:'POST',path:path+'/register',user:student('x')});await api({method:'POST',path:path+'/register',user:student('y')});
  await assert.rejects(api({method:'PATCH',path,user:owner,body:{capacity:2}}),{status:409});
  const publicEvent=await api({method:'GET',path});assert.equal(publicEvent.meetingRoomRef,undefined);assert.equal(publicEvent.attendees,undefined);assert.equal(publicEvent.registration,null);
  const mine=await api({method:'GET',path,user:student('x')});assert.equal(mine.registration.checkInTokenHash,undefined);assert.ok(mine.registration.token);assert.equal(mine.attendees,undefined);
});
test('DynamoDB compare-and-swap retries conflicting snapshots atomically',async()=>{
  let item={...seedEvents()[0],capacity:1};let conflicts=0;
  // Model DynamoDB's condition evaluation at commit; all first reads can see v1.
  const client={async send(command){const input=command.input;if(command.constructor.name==='GetCommand'){await new Promise(r=>setImmediate(r));return {Item:structuredClone(item)};}if(command.constructor.name==='PutCommand'){await new Promise(r=>setImmediate(r));if(input.ExpressionAttributeValues[':previous']!==item.version){conflicts++;throw Object.assign(new Error('Conflict'),{name:'ConditionalCheckFailedException'});}item=structuredClone(input.Item);return {};}throw new Error('Unexpected command');}};
  const api=createApi(new DynamoStore('events',client),secret);
  await Promise.all(Array.from({length:8},(_,i)=>api({method:'POST',path:'/events/cloud-lab/register',user:student(`d${i}`)})));
  assert.ok(conflicts>0);assert.equal(item.registrations.filter(r=>r.status==='CONFIRMED').length,1);assert.equal(item.registrations.filter(r=>r.status==='WAITLISTED').length,7);assert.equal(item.version,9);
  // Two competing cancellations must not promote the same seat twice.
  const winner=item.registrations.find(r=>r.status==='CONFIRMED').attendeeId;
  const result=await Promise.allSettled([1,2].map(()=>api({method:'POST',path:'/events/cloud-lab/cancel',user:student(winner)})));
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(item.registrations.filter(r=>r.status==='CONFIRMED').length,1);assert.equal(item.registrations.find(r=>r.status==='CONFIRMED').attendeeId,item.registrations[1].attendeeId);
});
test('Lambda rejects demo identities and malformed bodies',async()=>{
  const old={...process.env};process.env.EVENTS_TABLE='test';process.env.TOKEN_SECRET=secret;
  try{const {handler}=await import('../src/handler.mjs');
    const event={requestContext:{http:{method:'POST'}},rawPath:'/events',headers:{'x-demo-user':'organizer-demo'},body:'{}'};
    assert.equal((await handler(event)).statusCode,401);
    assert.equal((await handler({...event,body:'{'})).statusCode,400);
    assert.equal((await handler({...event,body:'x'.repeat(17000)})).statusCode,413);
  }finally{process.env=old;}
});
