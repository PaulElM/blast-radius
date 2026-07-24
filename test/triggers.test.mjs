// `renderTriggers` emits a PUBLIC report that names third-party publishers by
// name, and it had no tests. That is how commercial framing reached the published
// report: the prose labelled the recent-major table as an internal target list and
// printed the question we intended to put to those same publishers. It was live
// and anonymously readable for several releases before a review caught it.
//
// The distinction pinned here is NOT "no internal words anywhere" — the audits
// publish the KT-A and KT-C test names deliberately, because those are the
// credibility exhibits a reader is invited to check. It is narrower: a report that
// names other people must not also describe what we intend to do to them.
//
// The denylist below is deliberately GENERIC. An earlier draft asserted the
// absence of the specific sentences that leaked, which would have republished
// them verbatim in this file to the very readers the fix protects — a guard that
// leaks what it guards. Generic vocabulary plus a pattern for the programme names
// catches every mutation the specific version caught, and discloses nothing.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderTriggers } from '../src/triggers.mjs'

/** Smallest scan object renderTriggers will accept, carrying one row per table. */
function fixture() {
  return {
    scanned: 58,
    errors: [],
    upcoming: [
      {
        pkg: 'drizzle-orm',
        kind: 'upcoming-major',
        latest: '0.45.2',
        nextMajor: '1.0.0-rc.4',
        nextTag: 'rc',
        nextPublished: '2026-06-27T00:00:00.000Z',
      },
    ],
    recent: [
      {
        pkg: '@clerk/nextjs',
        kind: 'recent-major',
        latestMajor: 7,
        majorShippedAt: '2026-03-03T00:00:00.000Z',
        daysSinceMajor: 143,
      },
    ],
  }
}

// Matches any internal programme label, present or future, without naming one.
// A bare list would go stale the moment a KT-D exists.
test('generated prose carries no internal programme label', () => {
  const md = renderTriggers(fixture())
  const hit = md.match(/\bKT-[A-Z]\b/)
  assert.equal(
    hit,
    null,
    `renderTriggers emitted an internal programme label (${hit?.[0]}); this report names third parties and must not also name what we run on them`,
  )
})

// Commercial intent, not the specific wording. Each of these describes our
// posture toward the listed publishers rather than any fact about their packages,
// which is the property that makes them wrong for this report.
test('generated prose carries no commercial framing', () => {
  const md = renderTriggers(fixture()).toLowerCase()
  for (const word of ['prospect', 'interview', 'sale window', 'pitch', 'lead list', 'would you pay']) {
    assert.ok(
      !md.includes(word),
      `renderTriggers emitted commercial framing ("${word}") into a report that names third parties`,
    )
  }
})

// The scrub must not be achievable by emptying the report. Each table still has to
// render its rows and the disclosure that bounds the whole scan — otherwise a
// future "fix" passes the two tests above by deleting the prose they inspect.
test('the report still renders its tables and its recall disclosure', () => {
  const md = renderTriggers(fixture())
  assert.match(md, /drizzle-orm/, 'upcoming table lost its rows')
  assert.match(md, /@clerk\/nextjs/, 'recent table lost its rows')
  assert.match(md, /low recall/i, 'the recall bound is the honesty of this report and must stay')
  assert.match(md, /## Recent/, 'the recent-major section must still exist')
})
