// The KT-A harness had no tests at all — the module that produced this
// project's headline result (0 false positives / 60) was the one nobody pinned.
//
// What is pinned here is CORPUS PROVENANCE. The published audit says "60 files
// from 300 candidates across 277 repos"; the harness computed those two numbers,
// printed them to stderr and discarded them, so no artifact carried the claim.
//
// K1 is the load-bearing one and the rest are its consumers. The mutant that
// matters is `candidateFiles: results.length` — the tidy that looks right,
// passes every renderer assertion that hands the field to a fixture, and turns
// a coverage limit ("240 candidates were never opened") into "we opened
// everything". So the fake search here deliberately returns MORE files than the
// fake fetch will serve: a harness where the two lists are the same length
// cannot fail in the direction under test.
//
// It runs with NO network and NO cache. The seam is `deps`, not a stubbed
// global `fetch`, because stubbing the global would make `searchConsumers`
// write fabricated responses into data/cache.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collect, buildAudit, renderAudit } from '../src/kt-a.mjs'

const hit = (repo, path) => ({ repo, path, url: `https://example/${repo}/${path}`, private: false })

/** 5 candidate files across 3 repos; only the first 2 are ever opened. */
function fakeDeps({ queries = [{ query: 'q1', collected: 5, error: null }], servable = 2 } = {}) {
  const files = [
    hit('a/one', 'src/x.ts'),
    hit('a/one', 'src/y.ts'),
    hit('b/two', 'src/z.ts'),
    hit('c/three', 'src/w.ts'),
    hit('c/three', 'src/v.ts'),
  ]
  const served = new Set(files.slice(0, servable).map((f) => `${f.repo}/${f.path}`))
  return {
    files,
    deps: {
      search: async () => ({ files, queries }),
      fetch: async (h) => (served.has(`${h.repo}/${h.path}`) ? `import { z } from 'zod'\nz.string()\n` : null),
    },
  }
}

const quiet = () => {}

test('K1: the corpus size comes from the SEARCH result, not from the files opened', async () => {
  const { deps } = fakeDeps()
  const corpus = await collect('zod', { maxFiles: 2, onLog: quiet, deps })

  assert.equal(corpus.results.length, 2, 'precondition: only 2 files may have been opened')
  assert.equal(corpus.candidateFiles, 5)
  assert.equal(corpus.candidateRepos, 3)
})

test('K2: the per-query record is carried, so a degraded draw is in the artifact', async () => {
  const queries = [
    { query: "\"from 'zod\"", collected: 100, error: null },
    { query: '"from \\"zod"', collected: 0, error: '403 rate limited' },
  ]
  const { deps } = fakeDeps({ queries })
  const corpus = await collect('zod', { maxFiles: 2, onLog: quiet, deps })

  assert.deepEqual(corpus.queries, queries)
})

test('K3: buildAudit records the corpus fields it was handed', async () => {
  const { deps } = fakeDeps()
  const audit = buildAudit(await collect('zod', { maxFiles: 2, onLog: quiet, deps }), { n: 2, seed: 1 })

  assert.equal(audit.candidateFiles, 5)
  assert.equal(audit.candidateRepos, 3)
  assert.equal(audit.files, 2, 'precondition: the two counts must differ, or this proves nothing')
})

test('K4: an unrecorded corpus records null — never the count of files opened', async () => {
  // This is the shape the two shipped audits were built from. Defaulting here
  // would assert every candidate was opened, which is the claim the field exists
  // to stop us making.
  const { deps } = fakeDeps()
  const { results } = await collect('zod', { maxFiles: 2, onLog: quiet, deps })
  const audit = buildAudit(results, { n: 2, seed: 1 })

  assert.equal(audit.candidateFiles, null)
  assert.equal(audit.candidateRepos, null)
  assert.equal(audit.files, 2)
})

test('K5: the rendered audit states the corpus and what it did not open', async () => {
  const { deps } = fakeDeps()
  const md = renderAudit(buildAudit(await collect('zod', { maxFiles: 2, onLog: quiet, deps }), { n: 2, seed: 1 }), 'zod')

  assert.match(md, /corpus drawn: \*\*5\*\* candidate files across \*\*3\*\* repos/)
  assert.match(md, /\*\*3\*\* found but not opened/)
  assert.doesNotMatch(md, /NOT RECORDED/)
})

test('K6: an unrecorded corpus renders NOT RECORDED, not a substituted number', async () => {
  const { deps } = fakeDeps()
  const { results } = await collect('zod', { maxFiles: 2, onLog: quiet, deps })
  const md = renderAudit(buildAudit(results, { n: 2, seed: 1 }), 'zod')

  assert.match(md, /corpus drawn: \*\*NOT RECORDED\*\*/)
  assert.doesNotMatch(md, /candidate files across/)
})

test('K7: a failed search query is announced in the rendered audit', async () => {
  const queries = [
    { query: "\"from 'zod\"", collected: 100, error: null },
    { query: '"from \\"zod"', collected: 0, error: '403 rate limited' },
  ]
  const { deps } = fakeDeps({ queries })
  const md = renderAudit(buildAudit(await collect('zod', { maxFiles: 2, onLog: quiet, deps }), { n: 2, seed: 1 }), 'zod')

  assert.match(md, /\*\*1 of 2 search queries FAILED\*\*/)
  assert.match(md, /this corpus is degraded/)
})

test('K7b: NEGATIVE CONTROL — a clean draw carries no degradation warning', async () => {
  // A warning that fires on everything is not a warning.
  const { deps } = fakeDeps()
  const md = renderAudit(buildAudit(await collect('zod', { maxFiles: 2, onLog: quiet, deps }), { n: 2, seed: 1 }), 'zod')

  assert.doesNotMatch(md, /FAILED/)
  assert.doesNotMatch(md, /degraded/)
})

test('K8: NO-REGRESSION — the draw is still stratified by repo and reproducible', async () => {
  const { deps } = fakeDeps({ servable: 5 })
  const corpus = await collect('zod', { maxFiles: 5, onLog: quiet, deps })
  const a = buildAudit(corpus, { n: 3, seed: 11 })
  const b = buildAudit(corpus, { n: 3, seed: 11 })

  assert.equal(a.sampleSize, 3)
  assert.equal(a.sampleRepos, 3, 'a stratified draw of 3 must span 3 distinct repos, not 3 hits in one')
  assert.deepEqual(
    a.sample.map((x) => `${x.repo}/${x.path}:${x.line}`),
    b.sample.map((x) => `${x.repo}/${x.path}:${x.line}`),
  )
})
