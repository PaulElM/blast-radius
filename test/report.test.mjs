// The report renderer had NO tests, and that is why the same defect shipped four
// times: a generated sentence asserting evidence that does not exist at the
// address it names. One earlier fix removed a fabricated claim; a second fixed
// a sentence promising file/line provenance the pipeline had discarded; a third
// corrected a README citing an audit path that was never published; and this
// file exists because a pre-publication review found two more before they
// shipped.
//
// The standing rule is "a claim in generated prose is a test obligation." These
// are the obligations for the two claims that assert EXTERNAL evidence — the
// ones a reader cannot check from the JSON companion, and therefore the ones
// where being wrong is most expensive.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderReport, renderJson, SIGNATURE_AUDIT, RENDERER_VERSION } from '../src/report.mjs'

// The corpus-drawn line as it stands in a PUBLISHED report, read off the shipped
// file rather than typed here. A unit test against a literal I wrote proves only
// that I can type: the obligation is that a run whose corpus was drawn on
// 2026-07-24 still renders the sentence those readers already have.
//
// ⚠️ This pins THAT PUBLISHED RUN, whose corpus was drawn on 2026-07-24 — the
// date below is a literal on purpose, so the pair can disagree. If that report
// is ever regenerated from a NEW corpus draw, D5 goes red on correct code and
// the fixture date must move with it. Said here so nobody debugs the renderer.
const SHIPPED_DRAWN_LINE = readFileSync(
  new URL('../reports/supabase-js-negative-control.md', import.meta.url),
  'utf8',
)
  .split('\n')
  .find((l) => l.startsWith('> Corpus drawn '))

// The wording that shipped in all three published reports, byte-for-byte. A
// single-language run must keep rendering exactly this: the published reports
// were typescript-only runs and their disclosure was true, so the fix for the
// multi-language case must be a no-op for them.
const SHIPPED_TS_ONLY =
  '- **Public code only, TypeScript only.** Private repositories are invisible, and this run scanned `language:typescript`. Your JavaScript consumers, your enterprise customers, and anything behind a VPN are not in these numbers — all of them push the real figure up, none down.'
const SHIPPED_TS_SCOPE = 'public repositories, language:typescript, default branch (HEAD)'

/** Smallest run object renderReport will accept. Shape mirrors runReport(). */
function fixture({
  pkg = 'typeorm',
  wildcards = [],
  languages = ['typescript'],
  collectedAt = { first: '2026-07-24T18:22:33.000Z', last: '2026-07-24T20:00:40.000Z' },
  // The affected-repo table is rendered only when a repository is affected, so
  // a fixture with an empty list cannot exercise the "read at their default
  // branch on DATE" sentence beside it. D6's first draft asserted against that
  // sentence on an empty fixture and passed while checking nothing — a check
  // satisfiable without effect. Caught by running, not by reading.
  affected = false,
  // `undefined` means the wildcard surface was never probed, which the renderer
  // must report as NOT RECORDED. It is a DIFFERENT state from a probe that ran
  // and found nothing, and conflating them is the defect W4/R2 exist to stop.
  wildcardProbe = undefined,
} = {}) {
  return {
    target: {
      pkg,
      from: '1.0.0',
      to: '2.0.0',
      fromPublished: '2025-01-01T00:00:00.000Z',
      toPublished: '2026-01-01T00:00:00.000Z',
      isMajorBump: true,
    },
    diff: {
      from: `${pkg}@1.0.0`,
      to: `${pkg}@2.0.0`,
      totals: { removed: 10, added: 2, kept: 100, memberRemovals: 3 },
      removedEntryPoints: [],
      addedEntryPoints: [],
      perEntry: [],
    },
    corpus: {
      queries: [{ query: `"from '${pkg}"`, reportedTotal: 500, collected: 500 }],
      candidateFiles: 500,
      candidateRepos: 50,
      fetched: 500,
      missing: 0,
      // `languages: null` is a distinct case from any list, not a synonym for
      // typescript — see L4. `collectedAt: null` is the same distinction for the
      // draw date: an ABSENT field, not an empty one — see D6.
      ...(languages === null ? {} : { languages }),
      ...(collectedAt === null ? {} : { collectedAt }),
    },
    census: {
      repoCount: 50,
      fileCount: 500,
      attributions: 900,
      mergedByDefaultInterop: 0,
      notInSurface: 0,
      entries: [],
    },
    radius: {
      affectedRepos: 5,
      scannedRepos: 50,
      runtimeAffectedRepos: 4,
      entryPointBreaks: [],
      symbolBreaks: [],
      memberBreaks: [],
      unusedRemovals: 10,
      wildcardEntryPoints: wildcardProbe,
      affectedRepoList: affected ? ['acme/app'] : [],
      evidenceByRepo: affected
        ? { 'acme/app': [{ what: 'createConnection', path: 'src/db.ts', line: 12, runtime: true }] }
        : {},
    },
    surfaceSizes: {
      before: new Map([['.', 1], ['./browser', 1]]),
      after: new Map([['.', 1], ['./browser', 1]]),
      wildcardsBefore: wildcards,
      wildcardsAfter: wildcards,
    },
  }
}

test('the signature audit is never attributed to a package it was not run on', () => {
  const md = renderReport(fixture({ pkg: 'typeorm' }))

  // The exact wording that shipped the defect. It reads as though the 12-symbol
  // hand-audit was performed on whatever package the report targets.
  assert.ok(
    !md.includes("this package's core entry points"),
    'report must not claim the signature audit sampled the target package',
  )
  // The provenance must be named, and the mismatch called out explicitly.
  assert.ok(md.includes(SIGNATURE_AUDIT.package), 'audit provenance must be named')
  assert.ok(
    md.includes(`not against \`typeorm\``),
    'a foreign audit must say it does not measure this release',
  )
})

test('no disclaimer when the audit really was run on the target', () => {
  const md = renderReport(fixture({ pkg: SIGNATURE_AUDIT.package }))
  assert.ok(md.includes(SIGNATURE_AUDIT.package))
  assert.ok(
    !md.includes('not against'),
    'a same-package audit must not disclaim itself',
  )
})

test('wildcard entry points are reported from the manifest, not asserted away', () => {
  // typeorm really does declare these, and `./*` means every internal path is a
  // public subpath — so "this package declares none" was not a harmless nicety.
  const withWildcards = renderReport(fixture({ wildcards: ['./*', './*.js'] }))
  assert.ok(
    !withWildcards.includes('This package declares none'),
    'must not claim zero wildcards when the manifest declares them',
  )
  assert.ok(withWildcards.includes('`./*`'), 'each wildcard subpath must be named')
  assert.ok(withWildcards.includes('`./*.js`'))
  assert.ok(
    withWildcards.includes('never compared between the two versions'),
    'the coverage hole must be stated as a hole',
  )

  const without = renderReport(fixture({ wildcards: [] }))
  assert.ok(
    without.includes('it declares none'),
    'a package with no wildcards should say so, having been checked',
  )
  assert.ok(!without.includes('never compared between the two versions'))
})

test('a zero-affected run still states its own corpus rather than an empty page', () => {
  const run = fixture()
  run.radius.affectedRepos = 0
  run.radius.affectedRepoList = []
  const md = renderReport(run)
  assert.ok(md.includes('That zero is a finding, not an empty result.'))
  assert.ok(md.includes('50 repositories'), 'the zero must be qualified by what was resolved')
})

// L1–L5: the coverage disclosure must describe the run, not a constant.
//
// The defect these pin: `language:typescript` was a literal in the prose and a
// second literal in the JSON `scope`, while the CLI has always accepted
// `--languages typescript,javascript` and the collector has always looped over
// every one. The documented command produced a report swearing that the
// JavaScript consumers it had just named were "not in these numbers".
//
// L1 is the no-regression half and L2 is the discriminating half. A mutant that
// hardcodes the old string back leaves L1 GREEN and L2 RED — which is the only
// shape that proves L2 is testing the output rather than the plumbing.

test('L1: a typescript-only run renders the shipped wording byte-for-byte', () => {
  const md = renderReport(fixture({ languages: ['typescript'] }))
  assert.ok(
    md.includes(SHIPPED_TS_ONLY),
    'the three published reports must stay reproducible from this source',
  )
  assert.equal(renderJson(fixture({ languages: ['typescript'] })).coverage.scope, SHIPPED_TS_SCOPE)
})

test('L2: a multi-language run names every language it searched', () => {
  const md = renderReport(fixture({ languages: ['typescript', 'javascript'] }))

  assert.ok(
    !md.includes(SHIPPED_TS_ONLY),
    'a two-language run must not emit the typescript-only disclosure',
  )
  assert.ok(md.includes('TypeScript and JavaScript only'), 'both languages must be named')
  assert.ok(md.includes('`language:typescript` and `language:javascript`'), 'both qualifiers must be printed')
  // The load-bearing half: the old sentence disowned the very consumers this
  // run enumerated.
  assert.ok(
    !md.includes('Your JavaScript consumers'),
    'a run that scanned javascript must not call its javascript consumers absent',
  )
  assert.ok(md.includes('Your enterprise customers and anything behind a VPN are not in these numbers'))
})

test('L3: the scanned languages are machine-readable, not prose-only', () => {
  const json = renderJson(fixture({ languages: ['typescript', 'javascript'] }))
  assert.deepEqual(json.coverage.languages, ['typescript', 'javascript'])
  assert.equal(
    json.coverage.scope,
    'public repositories, language:typescript and language:javascript, default branch (HEAD)',
  )
})

test('L4: an unrecorded language list renders as unknown, never as typescript', () => {
  const md = renderReport(fixture({ languages: null }))
  const json = renderJson(fixture({ languages: null }))

  // Defaulting to typescript here is how this defect comes back: a confident
  // coverage claim that no code checked.
  //
  // Asserted against the CLAIM, not the substring: `language:typescript` also
  // appears in COVERAGE_PROBE, which is a pinned drizzle-orm exhibit that
  // renders its own provenance and date. A bare `!includes('language:typescript')`
  // fails here for a reason that has nothing to do with this defect — which is
  // how it failed on the first run of this test.
  assert.ok(!md.includes('this run scanned `language:'), 'an unrecorded run must not name a qualifier')
  assert.ok(!md.includes('TypeScript only'))
  assert.ok(md.includes('did not record which languages it searched'))
  assert.equal(json.coverage.languages, null)
  assert.ok(json.coverage.scope.includes('NOT RECORDED'))
})

test('L5: a javascript-only run is a javascript-only report', () => {
  const md = renderReport(fixture({ languages: ['javascript'] }))
  assert.ok(md.includes('**Public code only, JavaScript only.**'))
  assert.ok(md.includes('this run scanned `language:javascript`.'))
  assert.ok(!md.includes('TypeScript only'), 'the label must follow the corpus')
  assert.ok(!md.includes('Your JavaScript consumers'))
})

// D5–D9: the corpus draw date must describe the RUN, not the render.
//
// The defect these pin: `renderReport` dated the corpus from `new Date()`, so
// re-rendering a cached run restamped a corpus drawn days earlier with today's
// date. Every stage of this pipeline is cached, so "re-render an old run" is the
// normal case, not an exotic one — and the published negative control was
// waiting to be re-rendered when this was found.
//
// D5 is the no-regression half and D6 is the discriminating half: a mutant that
// puts the clock back leaves D5 green on the day it runs and D6 red forever.

test('D5: a run drawn on the shipped date renders the shipped line byte-for-byte', () => {
  const md = renderReport(fixture())
  assert.ok(SHIPPED_DRAWN_LINE, 'precondition: the published report must carry a corpus-drawn line')
  assert.ok(
    md.includes(SHIPPED_DRAWN_LINE),
    'a published report must stay reproducible from this source, to the byte',
  )
  assert.ok(md.includes('> Corpus drawn 2026-07-24.'), 'the date must come from the run')
})

test('D6: an unrecorded draw window is NOT RECORDED, never the day it was rendered', () => {
  const md = renderReport(fixture({ collectedAt: null, affected: true }))
  const today = new Date().toISOString().slice(0, 10)

  // Precondition, because the assertions below are about a section that only
  // exists when a repository is affected — without this they pass vacuously.
  assert.ok(md.includes('default branch'), 'precondition: the affected-repo section must render')

  assert.ok(md.includes('Corpus draw date **NOT RECORDED**'), 'an unknown date must say so')
  assert.ok(
    !md.includes(`Corpus drawn ${today}`),
    'the render date must never be substituted for the draw date',
  )
  // The severe half: this is the sentence beside the named third-party
  // repositories, telling them when their code was read.
  assert.ok(
    !md.includes(`default branch on ${today}`),
    'the corpus date beside the affected-repo table must not be the clock either',
  )
  assert.ok(md.includes('default branch on a date this run did not record'))
})

test('D6b: the affected-repo sentence carries the DRAW date, not the render date', () => {
  const md = renderReport(fixture({ affected: true }))
  assert.ok(md.includes('default branch'), 'precondition: the affected-repo section must render')
  assert.ok(
    md.includes('default branch on 2026-07-24.'),
    'the date beside named third parties must come from the run',
  )
})

test('D7: a corpus drawn across two days reports a range, not a side', () => {
  const md = renderReport(
    fixture({ collectedAt: { first: '2026-07-24T23:50:00.000Z', last: '2026-07-25T00:20:00.000Z' } }),
  )
  assert.ok(md.includes('Corpus drawn 2026-07-24 – 2026-07-25.'), 'both ends must be stated')
})

test('D8: the draw window and renderer generation are machine-readable', () => {
  const json = renderJson(fixture())
  assert.deepEqual(json.coverage.collectedAt, {
    first: '2026-07-24T18:22:33.000Z',
    last: '2026-07-24T20:00:40.000Z',
  })
  assert.equal(json.rendererVersion, RENDERER_VERSION)

  // `generatedAt` is a fact about the DOCUMENT and is correctly the clock. The
  // whole defect was these two being one field; asserting they differ is what
  // stops them being re-merged by a tidy.
  assert.equal(json.generatedAt.slice(0, 10), new Date().toISOString().slice(0, 10))
  assert.notEqual(json.generatedAt, json.coverage.collectedAt.last)

  const unrecorded = renderJson(fixture({ collectedAt: null }))
  assert.equal(unrecorded.coverage.collectedAt, null, 'an unrecorded window must stay null in the JSON')
})

test('D9: the report states which renderer generation produced it', () => {
  // Three reports were published from two generations and nothing in any of them
  // said so; the oldest was missing two coverage disclosures the others carried.
  const md = renderReport(fixture())
  assert.ok(md.includes(`report generation ${RENDERER_VERSION}`), 'the generation must be on the page')
  assert.ok(
    md.includes('not the time this file was written'),
    'the stamp must say what it does and does not date',
  )
})

test('failed search queries are named in the deliverable, not silently dropped', () => {
  const run = fixture()
  run.corpus.queries.push({
    query: `"require('typeorm')"`,
    reportedTotal: 5867,
    collected: 0,
    error: 'HTTP 401 — unauthenticated',
  })
  const md = renderReport(run)
  assert.ok(md.includes('did not complete'), 'a hole in the corpus must be announced')
  assert.ok(md.includes('HTTP 401 — unauthenticated'), 'the reason must be printed')
})

// ---------------------------------------------------------------------------
// The wildcard coverage hole. The shipped `typeorm` report told the reader this
// hole "is not quantifiable from the manifest" — true of the manifest, and false
// of the report, which was holding the corpus that names every wildcard subpath
// its consumers import. A limit that overstates its own blindness is a claim
// like any other, and it sent a reader away from a number we had.
// ---------------------------------------------------------------------------

test('R1: a probed wildcard surface reports the measured counts', () => {
  const md = renderReport(
    fixture({ wildcards: ['./*', './*.js'], wildcardProbe: { consumedNotDeclared: 64, broken: 12 } }),
  )
  assert.ok(md.includes('**64**'), 'must state how many undeclared subpaths consumers import')
  assert.ok(md.includes('**12**'), 'must state how many of them stopped resolving')
  assert.ok(md.includes('counted in category A above'))
  // The claim that had to die: the measured part is no longer called unmeasurable.
  assert.ok(!md.includes('This is the largest single coverage hole in this report and it is not quantifiable'))
  // The claim that had to SURVIVE: subpaths no consumer imports are still
  // uncounted, and deleting that would be the opposite error.
  assert.ok(md.includes('no scanned consumer imports'))
})

test('R2: an UNPROBED wildcard surface says NOT RECORDED, never a zero', () => {
  const md = renderReport(fixture({ wildcards: ['./*'] }))
  assert.ok(md.includes('`NOT RECORDED`'))
  assert.ok(md.includes('not the same as probing it and finding nothing'))
  assert.ok(!md.includes('**0** of them resolve'), 'an unprobed hole must never render as zero breaks')
})

test('R3: a package with no wildcard keys renders neither probe nor NOT RECORDED', () => {
  // Negative control. A disclosure that fires on every package is not a
  // disclosure — the "declares none" branch must stay reachable and quiet.
  const md = renderReport(fixture({ wildcards: [] }))
  assert.ok(md.includes('it declares none, so nothing is lost here'))
  assert.ok(!md.includes('`NOT RECORDED`'))
  assert.ok(!md.includes('counted in category A above'))
})

test('R4: the headline entry-point bullet counts wildcard breaks too', () => {
  // The bullet reads off `entryPointBreaks.length`, so a wildcard break that
  // never reached that array would leave the headline saying 0 while category A
  // listed rows. Pins the two together.
  const run = fixture({ wildcards: ['./*'], wildcardProbe: { consumedNotDeclared: 3, broken: 1 } })
  run.radius.entryPointBreaks = [
    { subpath: './deep/Gone', repos: 15, symbolsUsed: 1, symbolsStillExportedElsewhere: 0, viaWildcard: true, sites: [] },
  ]
  const md = renderReport(run)
  assert.ok(md.includes('1 entry points they import **stop resolving entirely**'))
  assert.ok(md.includes('`typeorm/deep/Gone`'))
})
