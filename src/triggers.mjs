// Trigger detection — who is about to ship a breaking change, right now.
//
// The ICP for this product is not "a library author." It is **a commercial
// entity with a scheduled major release**, and the whole business rests on that
// trigger being a DATED, PUBLISHED event rather than a vague ache. This module
// exists because that event turns out to be machine-readable:
//
//   a dist-tag (`next` / `beta` / `rc` / `canary`) pointing at a version whose
//   MAJOR is higher than the major of `latest`
//
// means the publisher has already committed, in public, in a place no marketing
// site can walk back. No blog post to interpret, no roadmap to believe.
//
// Three failure modes this guards against, caught by TWO INDEPENDENT checks.
// That independence is worth stating, because the example everyone reaches for
// exercises only the first check and an earlier version of this comment claimed
// it exercised both:
//
//  - STALE TAGS. `@sentry/react` publishes a `next` tag at 10.50.0-alpha.0 while
//    `latest` is 10.68.0. That tag is abandoned, not upcoming. A naive "has a
//    prerelease tag" check calls it a candidate; the MAJOR COMPARISON ALONE
//    rejects it (10 is not above 10) and the publish-time check below is never
//    reached for this input. A prerelease whose version is older than `latest`
//    always has major <= latestMajor, so the major comparison covers that entire
//    class on its own.
//  - WALKED-BACK BRANCHES. A `2.0.0-beta.1` published BEFORE the current 1.9.0
//    stable CLEARS the major comparison (2 > 1) and is still not an upcoming
//    release — the publisher went back to shipping 1.x. Only the publish-time
//    check rejects this shape, and it is the sole reason that check exists.
//  - LONG-DEAD BETAS. A `5.0.0-beta` that last moved two years ago is not a
//    release event. Recency of the prerelease publish is reported so a stale one
//    can be judged rather than silently counted.

import { fetchPackument, majorOf } from './surface.mjs'

const PRERELEASE_TAGS = ['next', 'rc', 'beta', 'alpha', 'canary', 'experimental']

/** When did this major first appear, ignoring its own prereleases? */
function firstPublishOfMajor(packument, major) {
  let earliest = null
  for (const [version, at] of Object.entries(packument.time ?? {})) {
    if (version === 'created' || version === 'modified') continue
    if (version.includes('-')) continue // prerelease: not the moment it landed
    if (majorOf(version) !== major) continue
    if (!earliest || Date.parse(at) < Date.parse(earliest)) earliest = at
  }
  return earliest
}

/**
 * Candidate publishers: npm packages backed by a commercial entity, with a
 * TypeScript-heavy consumer base reachable through GitHub code search.
 *
 * Deliberately NOT "the most downloaded packages." The screening rule this
 * company earned the hard way is that a real market and a winnable one are
 * different questions — and for this product the discriminator is whether the
 * publisher is an entity that can sign a purchase order at all. A solo-maintained
 * package with 40M downloads validates the pain and cannot buy.
 */
export const CANDIDATES = [
  // data / ORM
  'drizzle-orm', 'prisma', '@prisma/client', 'kysely', 'typeorm', 'mongoose', '@supabase/supabase-js',
  // auth / infra SaaS
  '@clerk/nextjs', 'next-auth', '@auth0/auth0-spa-js', 'firebase', '@aws-sdk/client-s3',
  // observability
  '@sentry/react', '@sentry/node', '@sentry/nextjs', '@datadog/browser-rum', 'posthog-js', '@logtail/node',
  // payments / commerce
  'stripe', '@stripe/stripe-js', '@paddle/paddle-js', '@lemonsqueezy/lemonsqueezy.js',
  // AI / LLM vendors
  'ai', 'openai', '@anthropic-ai/sdk', '@google/generative-ai', 'langchain', '@langchain/core', 'llamaindex',
  // frameworks / build, commercially backed
  'next', 'nuxt', 'astro', 'vite', '@remix-run/react', 'react-router', '@angular/core',
  // API / RPC / state
  '@trpc/server', '@apollo/client', 'graphql-request', '@tanstack/react-query', '@reduxjs/toolkit',
  // UI vendors
  '@mui/material', 'antd', '@chakra-ui/react', '@shopify/polaris', '@twilio/conversations',
  // devtools / platform
  'wrangler', '@cloudflare/workers-types', 'vercel', 'netlify-cli', '@sanity/client', 'contentful',
  'algoliasearch', '@elastic/elasticsearch', 'twilio', '@sendgrid/mail', '@slack/web-api', 'octokit',
]

/**
 * Does this package have a live, dated, next-major trigger?
 *
 * Returns null when it does not, so callers can filter. A null is not a failure
 * — most packages are not about to break their users, and that is exactly why
 * the detector is worth having.
 */
export async function detectTrigger(pkg, { deps } = {}) {
  // Injected seam, for the same reason `kt-a.mjs` has one: stubbing the global
  // `fetch` instead would drive the real `fetchPackument`, and this detector is
  // the one module whose registry reads are UNCACHED — so a stubbed-fetch test
  // measures the live npm registry rather than a fixture.
  const readPackument = deps?.fetchPackument ?? fetchPackument
  let packument
  try {
    packument = await readPackument(pkg)
  } catch (err) {
    return { pkg, error: String(err).slice(0, 120) }
  }

  const tags = packument['dist-tags'] ?? {}
  const time = packument.time ?? {}
  const latest = tags.latest
  if (!latest) return { pkg, error: 'no latest tag' }

  const latestMajor = majorOf(latest)
  const latestAt = time[latest] ? Date.parse(time[latest]) : null

  const candidates = []
  for (const tag of PRERELEASE_TAGS) {
    const version = tags[tag]
    if (!version || version === latest) continue
    if (majorOf(version) <= latestMajor) continue // same major, or a stale tag left behind
    const publishedAt = time[version] ? Date.parse(time[version]) : null
    // A HIGHER-major prerelease published before the current stable is a branch
    // the publisher walked back from, not an upcoming release.
    //
    // This does NOT reject @sentry/react. The major comparison above already
    // did, and this line is unreachable for that input — it is reached only when
    // majorOf(version) > latestMajor, which 10.50.0-alpha.0 against a 10.68.0
    // `latest` never satisfies. The shape it actually catches is the one named
    // in the header: a 2.0.0-beta.1 predating a 1.9.0 `latest`.
    if (publishedAt && latestAt && publishedAt < latestAt) continue
    candidates.push({ tag, version, publishedAt: time[version] ?? null })
  }

  // A publisher that shipped a major RECENTLY is a second kind of hit, not a
  // miss. The window in which a pre-release census could have helped them has
  // closed, but they are the population that has most recently been through a
  // breaking change, so treating "no live prerelease" as "nothing here" would
  // discard the entire recent list.
  //
  // This matters because most majors ship with NO prerelease dist-tag at all;
  // the publisher simply bumps. The prerelease detector therefore has LOW
  // RECALL by construction, and reading its hit count as the size of the market
  // would badly understate it.
  const majorFirstSeen = firstPublishOfMajor(packument, latestMajor)
  const daysSinceMajor = majorFirstSeen ? Math.round((Date.now() - Date.parse(majorFirstSeen)) / 86_400_000) : null
  const recentMajor = daysSinceMajor != null && daysSinceMajor <= 180 && latestMajor > 0

  if (!candidates.length) {
    if (!recentMajor) return null
    return {
      pkg,
      kind: 'recent-major',
      latest,
      latestMajor,
      majorShippedAt: majorFirstSeen,
      daysSinceMajor,
      repository: packument.repository?.url ?? null,
      homepage: packument.homepage ?? null,
    }
  }

  candidates.sort((a, b) => majorOf(b.version) - majorOf(a.version))
  const next = candidates[0]

  return {
    pkg,
    kind: 'upcoming-major',
    latest,
    latestPublished: time[latest] ?? null,
    nextMajor: next.version,
    nextTag: next.tag,
    nextPublished: next.publishedAt,
    majorJump: `${latestMajor} -> ${majorOf(next.version)}`,
    repository: packument.repository?.url ?? null,
    homepage: packument.homepage ?? null,
    allPrereleaseTags: candidates,
  }
}

/** Scan a candidate list and return only the packages with a live trigger. */
export async function scanTriggers(packages = CANDIDATES, { onLog, deps } = {}) {
  const hits = []
  const errors = []
  for (const pkg of packages) {
    const result = await detectTrigger(pkg, { deps })
    if (result?.error) {
      errors.push(result)
      continue
    }
    if (!result) continue
    hits.push(result)
    onLog?.(
      result.kind === 'upcoming-major'
        ? `  UPCOMING  ${pkg.padEnd(30)} ${result.latest} -> ${result.nextMajor}  (${result.nextTag}, ${String(result.nextPublished).slice(0, 10)})`
        : `  RECENT    ${pkg.padEnd(30)} v${result.latestMajor} shipped ${String(result.majorShippedAt).slice(0, 10)} (${result.daysSinceMajor}d ago)`,
    )
  }
  return {
    scanned: packages.length,
    // When the registry was actually read. The renderer used to date this scan
    // from `new Date()` at render time, which is the same construct the report
    // carried: a claim about when the WORK happened, derived from when the
    // DOCUMENT was written. It is true only while the two coincide, and nothing
    // makes them coincide.
    scannedAt: new Date().toISOString(),
    hits,
    errors,
    upcoming: hits.filter((h) => h.kind === 'upcoming-major'),
    recent: hits.filter((h) => h.kind === 'recent-major'),
  }
}

export function renderTriggers(scan) {
  const L = []
  L.push('# Breaking-change triggers — live scan')
  L.push('')
  L.push(
    scan.scannedAt
      ? `Scanned **${scan.scanned}** commercially-backed npm packages on ${scan.scannedAt.slice(0, 10)}.`
      : `Scanned **${scan.scanned}** commercially-backed npm packages on a date this scan did not record.`,
  )
  L.push('')
  L.push('| | count |')
  L.push('|---|---:|')
  L.push(`| **upcoming major** (prerelease dist-tag above \`latest\`) | ${scan.upcoming.length} |`)
  L.push(`| **recent major** (shipped within 180 days) | ${scan.recent.length} |`)
  L.push('')

  L.push('## Upcoming — a major is staged behind a prerelease tag')
  L.push('')
  if (scan.upcoming.length) {
    L.push('| package | current | next major | tag | prerelease published |')
    L.push('|---|---|---|---|---|')
    for (const h of [...scan.upcoming].sort((a, b) => String(b.nextPublished).localeCompare(String(a.nextPublished)))) {
      L.push(`| \`${h.pkg}\` | ${h.latest} | **${h.nextMajor}** | \`${h.nextTag}\` | ${String(h.nextPublished).slice(0, 10)} |`)
    }
  } else {
    L.push('_None._')
  }
  L.push('')

  L.push('## Recent — a major shipped within the last 180 days')
  L.push('')
  L.push('These publishers have most recently been through a major, so the cost of shipping one without a downstream census is freshest here. The pre-release window has closed for them, which is why they are listed separately — not because there is nothing to measure.')
  L.push('')
  if (scan.recent.length) {
    L.push('| package | major | shipped | days ago |')
    L.push('|---|---|---|---:|')
    for (const h of [...scan.recent].sort((a, b) => a.daysSinceMajor - b.daysSinceMajor)) {
      L.push(`| \`${h.pkg}\` | v${h.latestMajor} | ${String(h.majorShippedAt).slice(0, 10)} | ${h.daysSinceMajor} |`)
    }
  } else {
    L.push('_None._')
  }
  L.push('')

  L.push('## What this scan does and does not measure')
  L.push('')
  L.push('**It has low recall by construction, and the hit count is a floor, not a market size.** Most majors ship with no prerelease dist-tag at all — the publisher simply bumps the version. This detector only sees publishers who stage a major behind a tag, plus those who shipped one in the last 180 days. Announced-but-unstaged deprecations (a changelog saying "removed in v5") are invisible to it entirely.')
  L.push('')
  L.push('**Rejected on purpose:** a prerelease tag whose version is *older* than the current `latest` is an abandoned branch, not an upcoming release. `@sentry/react` publishes `next` at `10.50.0-alpha.0` against a `latest` of `10.68.0`; a naive "has a prerelease tag" check would score that as a hit.')
  L.push('')
  if (scan.errors.length) {
    L.push(`_${scan.errors.length} packages could not be read: ${scan.errors.map((e) => e.pkg).join(', ')}._`)
    L.push('')
  }
  return L.join('\n')
}
