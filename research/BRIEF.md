# TikTok format research brief

> **Superseded in part on 23 September 2026.** The niche and format are now decided: a gamified push-up app (ranked 1v1 style HUD over the owner's own push-up footage), renderer first, app second. See `docs/CONTEXT.md` for the decision, the evidence and the build plan. The evidence rules and the Playwright method below still apply.

Updated 22 September 2026 (Asia/Seoul).

## User's objective

Find repeatable short-video structures across niches, then choose a narrow fitness/health mobile-app problem that fits a winning structure. The business target is USD 20,000 within two months of app launch; whether this means cumulative gross sales or monthly recurring revenue has not been specified.

## Operating constraints

- Five TikTok accounts total: one daily personal-brand account featuring the user's face, plus up to four supporting accounts.
- Optimize performance per post and repeatability, not account volume.
- Keep the user's production burden low: reusable scripts, edits, and shot setups. Research and planning should make filming easier.
- The user explicitly rejected the food direction. Exclude food preparation, recipes, grocery comparisons and buying or arranging products from the active recommendation.
- Reproducibility means existing source material or existing personal footage plus one simple new recording. New locations, special props, extra performers, elaborate acting and fresh transformations fail the workload filter.
- Research and editing must reduce the user's burden; do not transfer endless source hunting to the user.
- Investigate reactions, before/after, visual comparisons, funny hooks that transition into the user's footage, and other transferable structures. Slideshows are eligible but are not the primary assumption.
- The earlier food recommendation is withdrawn. Choose a narrow fitness/health app problem only after identifying a manageable, repeatable video structure.
- User explicitly prefers Microsoft Playwright for TikTok research. Use the local official `playwright` package and normal browser access.

## Evidence rules

- Keep exact post URLs, dates, public metrics, duration, search query, and collection time.
- Separate ranked search results from consecutive recent-post samples. Search results are selected by TikTok and cannot establish a probability of going viral.
- Do not count an account's entire output as one template. Classify individual videos and visually inspect shortlisted examples.
- Count recurring successful examples across dates and creators, including less successful examples where available.
- Public flags cannot prove whether a video received paid promotion. Mark promotion status as unknown unless specifically established.
- Distinguish observed metrics from production estimates and fitness adaptations proposed by the assistant.
- No posting, liking, following, or sending messages is part of this research.

## Collection method

Playwright opens public TikTok search pages and scrolls the normal UI. The collector reads the post data returned to those pages; it does not synthesize signed requests, solve verification challenges, or access private accounts. A verification challenge stops collection. Browser session files remain local and are excluded from version control.
