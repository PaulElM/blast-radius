# Breaking-change triggers — live scan

Scanned **58** commercially-backed npm packages on 2026-07-24.

| | count |
|---|---:|
| **upcoming major** (prerelease dist-tag above `latest`) | 1 |
| **recent major** (shipped within 180 days) | 17 |

## Upcoming — the sale window is open

| package | current | next major | tag | prerelease published |
|---|---|---|---|---|
| `drizzle-orm` | 0.45.2 | **1.0.0-rc.4** | `rc` | 2026-06-27 |

## Recent — the window closed, but they just paid the cost

These are the better KT-B interviews. The question is not "would you buy this" but **"you shipped this three months ago — what would you have paid to have had it two weeks before?"** A counterfactual against a real, recent, remembered event beats a hypothetical against an imagined one.

| package | major | shipped | days ago |
|---|---|---|---:|
| `@slack/web-api` | v8 | 2026-07-14 | 10 |
| `vercel` | v56 | 2026-07-13 | 11 |
| `@cloudflare/workers-types` | v5 | 2026-07-03 | 22 |
| `ai` | v7 | 2026-06-25 | 29 |
| `astro` | v7 | 2026-06-22 | 32 |
| `react-router` | v8 | 2026-06-17 | 37 |
| `@angular/core` | v22 | 2026-06-03 | 51 |
| `typeorm` | v1 | 2026-05-19 | 66 |
| `@datadog/browser-rum` | v7 | 2026-04-30 | 85 |
| `netlify-cli` | v26 | 2026-04-28 | 87 |
| `twilio` | v6 | 2026-04-20 | 95 |
| `@mui/material` | v9 | 2026-04-07 | 108 |
| `stripe` | v22 | 2026-04-03 | 113 |
| `@stripe/stripe-js` | v9 | 2026-03-26 | 121 |
| `@twilio/conversations` | v3 | 2026-03-18 | 128 |
| `vite` | v8 | 2026-03-12 | 134 |
| `@clerk/nextjs` | v7 | 2026-03-03 | 143 |

## What this scan does and does not measure

**It has low recall by construction, and the hit count is a floor, not a market size.** Most majors ship with no prerelease dist-tag at all — the publisher simply bumps the version. This detector only sees publishers who stage a major behind a tag, plus those who shipped one in the last 180 days. Announced-but-unstaged deprecations (a changelog saying "removed in v5") are invisible to it entirely.

**Rejected on purpose:** a prerelease tag whose version is *older* than the current `latest` is an abandoned branch, not an upcoming release. `@sentry/react` publishes `next` at `10.50.0-alpha.0` against a `latest` of `10.68.0`; a naive "has a prerelease tag" check would score that as a prospect.
