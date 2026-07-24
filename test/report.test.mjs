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
import { renderReport, SIGNATURE_AUDIT } from '../src/report.mjs'

/** Smallest run object renderReport will accept. Shape mirrors runReport(). */
function fixture({ pkg = 'typeorm', wildcards = [] } = {}) {
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
