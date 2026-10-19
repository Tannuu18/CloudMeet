import { randomUUID, createHmac, createHash } from 'node:crypto';
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export function ensure(ok, status, message) { if (!ok) throw new HttpError(status, message); }
export const hash = value => createHash('sha256').update(value).digest('hex');
export const tokenFor = (eventId, registrationId, secret) => `${registrationId}.${createHmac('sha256', secret).update(`${eventId}:${registrationId}`).digest('base64url')}`;
export function validateEvent(input) {
  ensure(input && typeof input === 'object',400,'Event details are required.');
  const text = (key, min, max) => { ensure(typeof input[key] === 'string' && input[key].trim().length >= min && input[key].trim().length <= max,400,`${key} must be ${min}–${max} characters.`); return input[key].trim(); };
  const title = text('title',3,100), description = text('description',10,2000);
  ensure(Number.isInteger(input.capacity) && input.capacity >= 1 && input.capacity <= 100,400,'Capacity must be a whole number between 1 and 100.');
  ensure(typeof input.startTime==='string' && typeof input.endTime==='string' && /^\d{4}-\d{2}-\d{2}T/.test(input.startTime) && /^\d{4}-\d{2}-\d{2}T/.test(input.endTime),400,'Start and end times must be ISO date-time strings.');
  const start = Date.parse(input.startTime), end = Date.parse(input.endTime);
  ensure(Number.isFinite(start) && Number.isFinite(end) && end > start,400,'Choose valid start and end times; end must follow start.');
  const meetingRoomRef = text('meetingRoomRef',8,150);
  ensure(/^[a-zA-Z0-9_-]+$/.test(meetingRoomRef),400,'Room reference may contain letters, numbers, hyphens and underscores.');
  const category = input.category || 'Community';
  ensure(['Technology','Design','Career','Community'].includes(category),400,'Choose a supported category.');
  return {title, description, capacity:input.capacity, startTime:new Date(start).toISOString(), endTime:new Date(end).toISOString(), meetingRoomRef, category};
}
export const isOwner = (event, user) => user?.role === 'organizer' && event.organizerId === user.id;
export function authorizeOwner(event,user) { ensure(isOwner(event,user),403,'Only this event’s organizer can perform this action.'); }
export function statistics(event) {
  const active = event.registrations.filter(r => r.status !== 'CANCELLED');
  return {confirmed:active.filter(r=>r.status==='CONFIRMED').length, waitlisted:active.filter(r=>r.status==='WAITLISTED').length, checkedIn:active.filter(r=>r.checkedInAt).length};
}
export function view(event,user,secret) {
  const stats=statistics(event), mine=event.registrations.find(r=>r.attendeeId===user?.id && r.status!=='CANCELLED');
  const {registrations, meetingRoomRef, ...publicEvent}=event;
  const owner=isOwner(event,user);
  return {...publicEvent, ...stats, seatsLeft:event.capacity-stats.confirmed, isOwner:owner,
    ...(owner || mine?.status==='CONFIRMED' ? {meetingRoomRef} : {}),
    registration: mine ? {...mine, checkInTokenHash:undefined, token:mine.status==='CONFIRMED' && !mine.checkedInAt ? tokenFor(event.eventId,mine.registrationId,secret) : undefined,
      waitlistPosition:mine.status==='WAITLISTED' ? registrations.filter(r=>r.status==='WAITLISTED').findIndex(r=>r.registrationId===mine.registrationId)+1 : undefined} : null,
    ...(owner ? {attendees:registrations.filter(r=>r.status!=='CANCELLED').map(({checkInTokenHash,...r})=>r)} : {})};
}
export function register(event,user,secret) {
  ensure(new Date(event.endTime).getTime()>Date.now(),409,'This event has ended.');
  ensure(!event.registrations.some(r=>r.attendeeId===user.id && r.status!=='CANCELLED'),409,'You already have a registration for this event.');
  ensure(event.registrations.length<200,409,'This demo event has reached its registration record limit.');
  const registrationId=randomUUID();
  event.registrations.push({attendeeId:user.id, name:user.name, registrationId, registeredAt:new Date().toISOString(), status:statistics(event).confirmed<event.capacity?'CONFIRMED':'WAITLISTED',checkInTokenHash:hash(tokenFor(event.eventId,registrationId,secret))});
}
export function cancel(event,user) {
  const mine=event.registrations.find(r=>r.attendeeId===user.id && r.status!=='CANCELLED');
  ensure(mine,404,'No active registration found.');
  ensure(!mine.checkedInAt,409,'A checked-in registration cannot be cancelled.');
  const hadSeat=mine.status==='CONFIRMED'; mine.status='CANCELLED';
  if(hadSeat){const next=event.registrations.find(r=>r.status==='WAITLISTED'); if(next)next.status='CONFIRMED';}
}
export function checkIn(event,user,token) {
  authorizeOwner(event,user);
  ensure(typeof token==='string' && token.length<=250,400,'Enter a valid check-in token.');
  const registration=event.registrations.find(r=>r.checkInTokenHash===hash(token.trim()) && r.status==='CONFIRMED');
  ensure(registration,400,'Invalid token or registration is not confirmed.');
  ensure(!registration.checkedInAt,409,'This ticket has already been checked in.');
  registration.checkedInAt=new Date().toISOString();
}
