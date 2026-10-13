export const OFFER={priceCents:930,plannedYearlyCents:3099,displayPrice:'$9.30',displayPlanned:'$30.99',months:12,currency:'USD'};
export function validPaymentLink(value:unknown):string|null {
  if(typeof value!=='string'||!value)return null;
  try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='buy.stripe.com'&&!u.username&&!u.password&&u.pathname.length>1?u.toString():null;}catch{return null;}
}
