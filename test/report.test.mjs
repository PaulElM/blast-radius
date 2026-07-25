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
import { renderReport, renderJson, SIGNATURE_AUDIT } from '../src/report.mjs'

// The wording that shipped in all three published reports, byte-for-byte. A
// single-language run must keep rendering exactly this: the published reports
// were typescript-only runs and their disclosure was true, so the fix for the
// multi-language case must be a no-op for them.
const SHIPPED_TS_ONLY =
  '- **Public code only, TypeScript only.** Private repositories are invisible, and this run scanned `language:typescript`. Your JavaScript consumers, your enterprise customers, and anything behind a VPN are not in these numbers — all of them push the real figure up, none down.'
const SHIPPED_TS_SCOPE = 'public repositories, language:typescript, default branch (HEAD)'

/** Smallest run object renderReport will accept. Shape mirrors runReport(). */
function fixture({ pkg = 'typeorm', wildcards = [], languages = ['typescript'] } = {}) {
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
      // typescript — see L4.
      ...(languages === null ? {} : { languages }),
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
      affectedRepoList: [],
      evidenceByRepo: {},
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
