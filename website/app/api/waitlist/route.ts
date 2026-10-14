export const dynamic = 'force-dynamic';

// Retired signup endpoint. Existing signup records are retained privately.
export async function POST() {
  return Response.json({error:'The free waitlist is closed. Visit the website for the founder offer.'}, {status:410, headers:{'Cache-Control':'no-store'}});
}
