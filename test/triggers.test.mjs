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
import { renderTriggers, detectTrigger, scanTriggers } from '../src/triggers.mjs'

const DAY = 86_400_000
const ago = (days) => new Date(Date.now() - days * DAY).toISOString()

/** A packument stub. `time` keys are versions, exactly as the registry serves them. */
function packument({ tags, time }) {
  return { 'dist-tags': tags, time, repository: null, homepage: null }
}

/** Feed one canned packument to `detectTrigger` with no network and no cache. */
const stub = (doc) => ({ deps: { fetchPackument: async () => doc } })

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

// ---------------------------------------------------------------------------
// `detectTrigger` had NO tests. Everything above this line covers the renderer,
// so the entire detection rule — the two independent rejections, the 180-day
// window, the prerelease-blind major dating — shipped in a public report
// unpinned. The report's one named negative control (`@sentry/react`) was cited
// in the source as the witness for the publish-time check; it never reaches it.
// ---------------------------------------------------------------------------

// G1 — the report's named example, in its real shape. Rejected.
test('G1 a same-major prerelease below `latest` is not an upcoming major', async () => {
  const doc = packument({
    tags: { latest: '10.68.0', next: '10.50.0-alpha.0' },
    time: { '10.0.0': ago(400), '10.68.0': ago(30), '10.50.0-alpha.0': ago(60) },
  })
  assert.equal(await detectTrigger('@sentry/react', stub(doc)), null)
})

// G1b — the SAME rejection with the publish-time check deliberately unable to
// help: the stale alpha is published AFTER `latest`. Only the major comparison
// can reject this, so G1b pins that check in isolation. Without it, G1 alone is
// satisfied by either check and pins neither.
test('G1b a same-major prerelease is rejected on the major alone, even when newer than `latest`', async () => {
  const doc = packument({
    tags: { latest: '10.68.0', next: '10.50.0-alpha.0' },
    time: { '10.0.0': ago(400), '10.68.0': ago(30), '10.50.0-alpha.0': ago(10) },
  })
  assert.equal(await detectTrigger('@sentry/react', stub(doc)), null)
})

// G2 — THE ONLY TEST THAT REACHES THE PUBLISH-TIME CHECK. A 2.0.0-beta.1 clears
// the major comparison (2 > 1) and is still not upcoming, because it predates
// the 1.9.0 stable: the publisher walked the branch back.
const walkedBack = (betaAgo) =>
  packument({
    tags: { latest: '1.9.0', beta: '2.0.0-beta.1' },
    time: { '1.0.0': ago(400), '1.9.0': ago(100), '2.0.0-beta.1': ago(betaAgo) },
  })

test('G2 a higher-major prerelease published BEFORE `latest` is a walked-back branch', async () => {
  assert.equal(await detectTrigger('demo', stub(walkedBack(200))), null)
})

// G3 — the negative control for G2, and its precondition. The two fixtures
// differ in NOTHING but the prerelease publish date, so if G3 were not a hit,
// G2 would be green while pinning the major comparison a second time.
// A rejection that fires on everything is not a rejection.
test('G3 the same prerelease published AFTER `latest` IS an upcoming major', async () => {
  const hit = await detectTrigger('demo', stub(walkedBack(50)))
  assert.equal(hit?.kind, 'upcoming-major')
  assert.equal(hit.nextMajor, '2.0.0-beta.1')
  assert.equal(hit.nextTag, 'beta')
  assert.equal(hit.majorJump, '1 -> 2')
})

// G4 — a shipped major inside the window is the second kind of hit, not a miss.
test('G4 a major shipped inside 180 days is a recent-major hit', async () => {
  const doc = packument({ tags: { latest: '7.2.1' }, time: { '7.0.0': ago(143), '7.2.1': ago(5) } })
  const hit = await detectTrigger('@clerk/nextjs', stub(doc))
  assert.equal(hit?.kind, 'recent-major')
  assert.equal(hit.daysSinceMajor, 143)
  assert.equal(hit.latestMajor, 7)
})

// G5 — the window has to CLOSE, or every package with a major is a hit forever.
test('G5 a major shipped outside 180 days is not a hit', async () => {
  const doc = packument({ tags: { latest: '7.2.1' }, time: { '7.0.0': ago(300), '7.2.1': ago(5) } })
  assert.equal(await detectTrigger('old', stub(doc)), null)
})

// G6 — a 0.x package has no major to have shipped. `drizzle-orm` at 0.45.2 is
// caught as UPCOMING, never as recent; without the `latestMajor > 0` guard every
// active 0.x package would be a false recent-major hit.
// The 0.x line MUST be recent, or the 180-day window rejects this fixture on its
// own and the `latestMajor > 0` guard is never the thing under test. The first
// draft dated 0.1.0 at 400 days and the mutant that deletes the guard SURVIVED.
test('G6 a 0.x package is never a recent-major hit', async () => {
  const doc = packument({ tags: { latest: '0.45.2' }, time: { '0.1.0': ago(30), '0.45.2': ago(3) } })
  assert.equal(await detectTrigger('drizzle-orm', stub(doc)), null)
})

// G7 — the major's date must ignore its own prereleases, or a long beta cycle
// dates the major to the beta and the package ages out of the window early.
test('G7 the major is dated from its first STABLE publish, not its prereleases', async () => {
  const doc = packument({
    tags: { latest: '2.1.0' },
    time: { '2.0.0-beta.1': ago(300), '2.0.0': ago(20), '2.1.0': ago(4) },
  })
  const hit = await detectTrigger('demo', stub(doc))
  assert.equal(hit?.kind, 'recent-major')
  assert.equal(hit.daysSinceMajor, 20)
})

// G8 — with several live prerelease tags, the highest major wins.
test('G8 the highest-major prerelease tag is the reported next major', async () => {
  const doc = packument({
    tags: { latest: '1.9.0', beta: '2.0.0-beta.1', next: '3.0.0-next.1' },
    time: { '1.0.0': ago(400), '1.9.0': ago(100), '2.0.0-beta.1': ago(50), '3.0.0-next.1': ago(40) },
  })
  const hit = await detectTrigger('demo', stub(doc))
  assert.equal(hit.nextMajor, '3.0.0-next.1')
  assert.equal(hit.majorJump, '1 -> 3')
})

// G9 — an unreadable package is an error, not a silent miss. A registry 404
// counted as "no trigger" would shrink the scanned population invisibly.
test('G9 a registry failure is recorded as an error, not as an absent trigger', async () => {
  const boom = { deps: { fetchPackument: async () => { throw new Error('registry 404 for nope') } } }
  const res = await detectTrigger('nope', boom)
  assert.match(res.error, /registry 404/)
})

// G10 — the scan separates hits from errors, records its own draw time, and
// reports the size of the population it actually walked.
test('G10 scanTriggers threads deps, counts the population and records scannedAt', async () => {
  const docs = {
    up: packument({ tags: { latest: '1.9.0', rc: '2.0.0-rc.1' }, time: { '1.0.0': ago(400), '1.9.0': ago(100), '2.0.0-rc.1': ago(10) } }),
    dead: packument({ tags: { latest: '3.0.0' }, time: { '3.0.0': ago(900) } }),
  }
  const scan = await scanTriggers(['up', 'dead', 'bad'], {
    deps: { fetchPackument: async (p) => { if (p === 'bad') throw new Error('registry 500 for bad'); return docs[p] } },
  })
  assert.equal(scan.scanned, 3, 'scanned counts the population walked, not the hits')
  assert.equal(scan.upcoming.length, 1)
  assert.equal(scan.recent.length, 0)
  assert.equal(scan.errors.length, 1)
  assert.match(scan.scannedAt, /^\d{4}-\d{2}-\d{2}T/)
})
