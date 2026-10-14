# EscapeCouch launch website

The public founder-pass preorder page, built with Next.js and deployed on Vercel. This directory is independent of the React Native app and video-rendering tools elsewhere in this repository.

## Development

Use Node 24, run `npm ci`, copy `.env.example` to `.env.local`, and run `npm run dev`. Production validation: `npm run build`, then `npm start -- --port 3217` and `npm test`. The integration checks confirm that free signup is closed and checkout still redirects correctly. They do not create signup records.

## Deployment

- Vercel team: `ali-furqans-projects` (`team_S6qksgchTJODjFcnoacdkdI1`).
- Project: `escapecouch` (`prj_jXceU3KYWia2ygx2pUPIxqIC4KFH`).
- Git source: `furqan4545/EscapeCouch`, production branch `main`.
- Root directory: `website`; framework: Next.js; Node: 24.x.
- New pushes to `main` deploy through the Git integration.

Configure `STRIPE_PAYMENT_LINK`, `FOUNDER_OFFER_OPEN`, `WAITLIST_DATABASE_URL`, and `WAITLIST_HASH_SECRET` in Vercel. The database URL and hash secret are server-only secrets. No credentials belong in Git. `SITE_URL` is optional; otherwise metadata uses Vercel’s production hostname.

## Retired free waitlist

The free waitlist UI has been removed. `/api/waitlist` returns HTTP 410 and no longer writes records. Previously collected records remain private in `escapecouch_launch.waitlist`; no signup data was deleted. The original migration and restricted database helper are retained for maintenance. The public preorder flow uses Stripe only.

## Founder offer and checkout

- Pay **US$9.30 now** for the first full 12 months of paid challenge hosting.
- The paid year starts at activation when paid hosting launches, not on purchase.
- Founder renewal price remains **US$9.30 each year, with no increase to that buyer’s annual price**. This is not lifetime access or a first-year-only discount.
- Planned standard annual price: **US$30.99**. The approximately 70% comparison is with a planned price, not a previously charged price.
- New buyers can claim the offer **before launch only**. No launch date is promised.
- Checkout takes a one-time payment. Future automatic renewal needs the buyer’s agreement at activation. A 100% refund is available before activation and within 7 days of paid access starting after launch. Requests go to support@escapecouch.com from the checkout email; a refund cancels access and the founder-price entitlement.

Stripe Payment Link: `https://buy.stripe.com/dRmeVe0pAcjW6EC4GPgbm00`.
Product: `prod_VR2iYsbgZFTwLH`; price: `price_1UQAd7Kwk5Y1UZoviG2kWqqA`; link: `plink_1UQAfTKwk5Y1UZovR7mRI3ZH`.

Before launch, reconcile paid Stripe orders with app accounts, activate each buyer’s full prepaid year, and arrange renewal consent. At launch, **deactivate the founder Payment Link in Stripe**, set `FOUNDER_OFFER_OPEN=false` and redeploy, and replace preorder copy with launch copy. Deactivating the Stripe link also prevents checkout through previously shared direct links. Existing founders keep their locked renewal price. The website deployment does not enable mobile-app billing or change store subscriptions.

Support: support@escapecouch.com.
