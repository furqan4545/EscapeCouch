import test from 'node:test';
import assert from 'node:assert/strict';

// Run against a local `npm start -- --port 3217` process, never production.
const origin = 'http://127.0.0.1:3217';

test('the removed free waitlist no longer accepts signups', async () => {
  const response = await fetch(`${origin}/api/waitlist`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:'retired-waitlist@example.com', platform:'ios', consent:true}),
  });
  assert.equal(response.status,410);
});

test('checkout redirects to the approved Stripe payment link', async () => {
  const response = await fetch(`${origin}/checkout`, {redirect: 'manual'});
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), 'https://buy.stripe.com/dRmeVe0pAcjW6EC4GPgbm00');
});
