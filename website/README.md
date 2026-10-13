# EscapeCouch launch website

The public founder-pass landing page, built with Next.js and deployed on Vercel. This directory is independent of the React Native app and video-rendering tools elsewhere in this repository.

## Development

Use Node 24, run `npm ci`, copy `.env.example` to `.env.local`, and run `npm run dev`. Production validation: `npm run build`, then `npm start -- --port 3217` and `npm test`. The integration tests use disposable `codex-api-…@example.com` records in the configured database; remove those records after verification.

## Deployment

- Vercel team: `ali-furqans-projects` (`team_S6qksgchTJODjFcnoacdkdI1`).
- Project: `escapecouch` (`prj_jXceU3KYWia2ygx2pUPIxqIC4KFH`).
- Git source: `furqan4545/EscapeCouch`, production branch `main`.
- Root directory: `website`; framework: Next.js; Node: 24.x.
- New pushes to `main` deploy through the Git integration.

Configure `STRIPE_PAYMENT_LINK`, `FOUNDER_OFFER_OPEN`, `WAITLIST_DATABASE_URL`, and `WAITLIST_HASH_SECRET` in Vercel. The database URL and hash secret are server-only secrets. No credentials belong in Git. `SITE_URL` is optional; otherwise metadata uses Vercel’s production hostname.

## Waitlist

Records live in the existing EscapeCouch Supabase database, under the isolated `escapecouch_launch` schema. `db/001_waitlist.sql` creates the tables and signup function. It does not alter the mobile app’s schema. The runtime database login receives only schema usage and execution of `register_waitlist(text,text,text,text,text)`; it cannot list waitlist emails. Provision this login separately and use the Supabase transaction pooler with TLS and the bundled public CA certificate.

The API validates email/platform/consent, rejects cross-origin requests, caps request size, ignores honeypot submissions, normalizes duplicate emails, and limits an IP-derived hash to 10 attempts per 15-minute bucket. Raw IP addresses are not stored. Expired hashes are removed during subsequent requests. Waitlist messages are not sent automatically.

Owners can export or delete signups using their admin database access. Example read query:

```sql
select email, platform, source, campaign, consent_version, created_at
from escapecouch_launch.waitlist
order by created_at;
```

The original Sites database was empty when this Vercel copy was prepared on October 14, 2026. The older Sites URL remains a separate deployment; promote the Vercel URL in new marketing links.

## Founder offer and checkout

- Pay **US$9.30 now** for the first full 12 months of paid challenge hosting.
- The paid year starts at activation when paid hosting launches, not on purchase.
- Founder renewal price remains **US$9.30/year for life**. This is not lifetime access or a first-year-only discount.
- Planned standard annual price: **US$30.99**. The approximately 70% comparison is with a planned price, not a previously charged price.
- New buyers can claim the offer **before launch only**. No launch date is promised.
- Checkout takes a one-time payment. Future automatic renewal needs the buyer’s agreement at activation. Full refunds are available before activation.

Stripe Payment Link: `https://buy.stripe.com/dRmeVe0pAcjW6EC4GPgbm00`.
Product: `prod_VR2iYsbgZFTwLH`; price: `price_1UQAd7Kwk5Y1UZoviG2kWqqA`; link: `plink_1UQAfTKwk5Y1UZovR7mRI3ZH`.

Before launch, reconcile paid Stripe orders with app accounts, activate each buyer’s full prepaid year, and arrange renewal consent. At launch, **deactivate the founder Payment Link in Stripe**, set `FOUNDER_OFFER_OPEN=false` and redeploy, and replace preorder copy with launch copy. Deactivating the Stripe link also prevents checkout through previously shared direct links. Existing founders keep their locked renewal price. The website deployment does not enable mobile-app billing or change store subscriptions.

Support: support@escapecouch.com.
