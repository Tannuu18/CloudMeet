import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { ensure } from './domain.mjs';
let verifier;
export async function authenticate(headers) {
  const authorization=headers.authorization || headers.Authorization;
  if(!authorization)return null;
  ensure(authorization.startsWith('Bearer '),401,'A Bearer access token is required.');
  ensure(process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID,503,'Authentication is not configured.');
  verifier ||= CognitoJwtVerifier.create({userPoolId:process.env.COGNITO_USER_POOL_ID,clientId:process.env.COGNITO_CLIENT_ID,tokenUse:'access'});
  try {const claims=await verifier.verify(authorization.slice(7));return {id:claims.sub,name:claims.username || 'Student',role:claims['cognito:groups']?.includes('organizer')?'organizer':'attendee'};}
  catch {ensure(false,401,'Your session expired or is invalid. Please sign in again.');}
}
