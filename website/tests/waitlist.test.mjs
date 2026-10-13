import test from 'node:test';
import assert from 'node:assert/strict';

// Run against a local `npm start -- --port 3217` process, never production.
const origin = 'http://127.0.0.1:3217';
const email = `codex-api-${Date.now()}@example.com`;
const ip = `192.0.2.${Math.floor(Math.random() * 250) + 1}`;
const valid = {email, platform: 'both', consent: true, source: 'automated-qa'};
const signup = (body, headers = {}) => fetch(`${origin}/api/waitlist`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json', Origin: origin, 'x-vercel-forwarded-for': ip, ...headers},
  body: JSON.stringify(body),
});

test('waitlist validates consent, rejects cross-origin requests, deduplicates and limits attempts', async () => {
  assert.equal((await signup({...valid, consent: false})).status, 400);
  assert.equal((await signup({...valid, email: 'invalid'})).status, 400);
  assert.equal((await signup(valid, {Origin: 'https://unrelated.example'})).status, 403);
  assert.equal((await signup({...valid, source: 'x'.repeat(5000)})).status, 413);
  assert.deepEqual(await (await signup({...valid, website: 'spam'})).json(), {ok: true});
  for (let i = 0; i < 10; i++) {
    const response = await signup({...valid, email: i % 2 ? ` ${email.toUpperCase()} ` : email});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {ok: true});
  }
  assert.equal((await signup(valid)).status, 429);
});

test('checkout redirects to the approved Stripe payment link', async () => {
  const response = await fetch(`${origin}/checkout`, {redirect: 'manual'});
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), 'https://buy.stripe.com/dRmeVe0pAcjW6EC4GPgbm00');
});
