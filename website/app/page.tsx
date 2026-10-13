import Landing from './landing';
import { validPaymentLink } from '../lib/offer';
export const dynamic = 'force-dynamic';
export default function Home() { return <Landing checkoutReady={process.env.FOUNDER_OFFER_OPEN !== 'false' && !!validPaymentLink(process.env.STRIPE_PAYMENT_LINK)} />; }
