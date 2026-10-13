import {validPaymentLink} from '../../lib/offer';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const checkout=validPaymentLink(process.env.STRIPE_PAYMENT_LINK);
 if(process.env.FOUNDER_OFFER_OPEN==='false'||!checkout)return Response.redirect(new URL('/#waitlist',request.url),303);
 return new Response(null,{status:303,headers:{Location:checkout,'Cache-Control':'no-store','Referrer-Policy':'strict-origin-when-cross-origin'}});
}
