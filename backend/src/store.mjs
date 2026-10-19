import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ensure, HttpError } from './domain.mjs';

// A bounded event aggregate makes registration, cancellation, promotion and check-in
// one atomic conditional write. See docs/architecture.md for sizing/tradeoffs.
export class DynamoStore {
  constructor(table, client=DynamoDBDocumentClient.from(new DynamoDBClient({}))) {this.table=table;this.client=client;}
  async list(){const all=[];let key;do{const r=await this.client.send(new ScanCommand({TableName:this.table,ExclusiveStartKey:key}));all.push(...(r.Items||[]));key=r.LastEvaluatedKey;}while(key);return all;}
  async get(eventId){const {Item}=await this.client.send(new GetCommand({TableName:this.table,Key:{eventId},ConsistentRead:true}));ensure(Item,404,'Event not found.');return Item;}
  async create(event){await this.client.send(new PutCommand({TableName:this.table,Item:{...event,version:1},ConditionExpression:'attribute_not_exists(eventId)'}));return event;}
  async mutate(id,fn){
    for(let i=0;i<12;i++){
      const event=await this.get(id), previous=event.version;
      fn(event);event.version=previous+1;
      try {await this.client.send(new PutCommand({TableName:this.table,Item:event,ConditionExpression:'#v = :previous',ExpressionAttributeNames:{'#v':'version'},ExpressionAttributeValues:{':previous':previous}}));return event;}
      catch(e){if(e.name!=='ConditionalCheckFailedException')throw e;await new Promise(r=>setTimeout(r,Math.random()*Math.min(15*2**i,250)));}
    }
    throw new HttpError(409,'This event is busy. Please try again.');
  }
}
export class FileStore {
  constructor(path, seed=[]) {this.path=path;this.seed=seed;this.queue=Promise.resolve();}
  async read(){try{return JSON.parse(await readFile(this.path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;return structuredClone(this.seed);}}
  async list(){await this.queue;return this.read();}
  async get(id){const events=await this.list();const event=events.find(e=>e.eventId===id);ensure(event,404,'Event not found.');return event;}
  write(fn){const work=this.queue.then(async()=>{const events=await this.read();const result=fn(events);await mkdir(dirname(this.path),{recursive:true});await writeFile(this.path+'.tmp',JSON.stringify(events));await rename(this.path+'.tmp',this.path);return structuredClone(result);});this.queue=work.catch(()=>{});return work;}
  async create(event){return this.write(events=>{ensure(!events.some(e=>e.eventId===event.eventId),409,'Event already exists.');events.push({...event,version:1});return event;});}
  async mutate(id,fn){return this.write(events=>{const event=events.find(e=>e.eventId===id);ensure(event,404,'Event not found.');fn(event);event.version++;return event;});}
}
