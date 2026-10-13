import {createHmac} from 'node:crypto';
import {waitlistDatabase} from '../../../lib/waitlist-db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
 const origin=request.headers.get('origin');
 const host=request.headers.get('host')||new URL(request.url).host;
 try{if(origin&&new URL(origin).host!==host)return json({error:'Please join from the EscapeCouch website.'},403);}catch{return json({error:'Invalid origin.'},403);}
 if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Invalid request.'},415);
 if(Number(request.headers.get('content-length')||0)>4096)return json({error:'Request is too large.'},413);
 let body:Record<string,unknown>;
 try{
  const reader=request.body?.getReader();if(!reader)return json({error:'Invalid request.'},400);
  let size=0;const chunks:Uint8Array[]=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return json({error:'Request is too large.'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  body=JSON.parse(new TextDecoder().decode(bytes));if(!body||Array.isArray(body)||typeof body!=='object')throw new Error();
 }catch{return json({error:'Invalid request.'},400);}
 if(body.website)return json({ok:true});
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json({error:'Enter a valid email address.'},400);
 if(!['ios','android','both'].includes(String(body.platform))||body.consent!==true)return json({error:'Choose your phone and agree to launch updates.'},400);
 if(!process.env.WAITLIST_DATABASE_URL||!process.env.WAITLIST_HASH_SECRET)return json({error:'Signup is temporarily unavailable. Please try again shortly.'},503);
 const now=Date.now();
 try{
  const bucket=Math.floor(now/900000);
  const ip=(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'local').split(',')[0].trim();
  const key=createHmac('sha256',process.env.WAITLIST_HASH_SECRET!).update(`${bucket}:${ip}`).digest('hex');
  const sql=waitlistDatabase();
  const [result]=await sql`select escapecouch_launch.register_waitlist(
    ${email}, ${String(body.platform)},
    ${typeof body.source==='string'?body.source.slice(0,100):'direct'},
    ${typeof body.campaign==='string'?body.campaign.slice(0,100):''}, ${key}
  ) as accepted`;
  if(!result.accepted)return json({error:'Too many attempts. Please try again in 15 minutes.'},429);
  return json({ok:true});
 }catch{return json({error:'We couldn’t save your signup. Please try again.'},503);}
}
