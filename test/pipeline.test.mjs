// The PRODUCER side of the coverage disclosure.
//
// `report.mjs` renders the scanned languages from `corpus.languages`, and
// test/report.test.mjs pins that rendering hard — but every one of those tests
// hands the field to a fixture. Delete `languages` from what `collectCorpus`
// returns and all of them stay green while every real run renders NOT RECORDED:
// the assertions would be testing the consumer and calling it end to end.
//
// This runs with NO network. `maxQueries: 0` makes `runQuery` return `skipped`
// before it issues a request, so the collector completes on an empty corpus —
// which is all this claim needs. It pins that the languages are carried OUT OF
// THE COLLECTOR, not that a search happened.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectCorpus, corpusDrawWindow } from '../src/pipeline.mjs'

test('L6: the collector reports the languages it was asked to search', async () => {
  const corpus = await collectCorpus('typeorm', {
    languages: ['typescript', 'javascript'],
    pages: 1,
    maxFiles: 0,
    maxQueries: 0,
  })

  assert.deepEqual(corpus.languages, ['typescript', 'javascript'])
  assert.equal(corpus.candidateFiles, 0, 'precondition: this must be the offline path')
  assert.equal(corpus.queries.length, 0, 'precondition: no query may have been issued')
})

test('L7: the reported languages are a copy, not the caller’s array', async () => {
  // Otherwise a caller mutating its own options list retroactively rewrites what
  // a finished report says it searched.
  const asked = ['typescript']
  const corpus = await collectCorpus('typeorm', { languages: asked, pages: 1, maxFiles: 0, maxQueries: 0 })
  asked.push('javascript')
  assert.deepEqual(corpus.languages, ['typescript'])
})

// D1–D4: the PRODUCER side of the corpus draw date.
//
// The renderer half is pinned in report.test.mjs off a fixture, so exactly as
// with `languages` above, deleting the field from the collector would leave
// those green while every real report stopped stating a draw date. The offline
// `maxQueries: 0` trick cannot reach this field — `runQuery` returns `skipped`
// BEFORE `searchPage`, so no stamp is ever recorded and null is the correct
// answer. So the window itself is pinned as a pure function, and the collector
// is pinned separately for carrying the key at all.

test('D1: the draw window is the first and last stamp, not the first seen', () => {
  const w = corpusDrawWindow([
    '2026-07-24T20:00:40.000Z',
    '2026-07-24T18:22:33.000Z',
    '2026-07-24T19:10:00.000Z',
  ])
  assert.deepEqual(w, { first: '2026-07-24T18:22:33.000Z', last: '2026-07-24T20:00:40.000Z' })
})

test('D2: a corpus with no recorded stamps has NO draw date, and never today’s', () => {
  // Null must survive out of here. The whole defect was substituting the clock
  // for an unknown, so an empty window that quietly became `now` would rebuild
  // it one layer down.
  assert.equal(corpusDrawWindow([]), null)
  assert.equal(corpusDrawWindow([null, null]), null)
})

test('D3: partial stamps still produce a window from what IS recorded', () => {
  // A run where some pages came from cache and some were fetched live must not
  // lose its date because one stamp was missing.
  const w = corpusDrawWindow([null, '2026-07-24T18:22:33.000Z', null])
  assert.deepEqual(w, { first: '2026-07-24T18:22:33.000Z', last: '2026-07-24T18:22:33.000Z' })
})

test('D4: the collector carries collectedAt out of the corpus draw', async () => {
  const corpus = await collectCorpus('typeorm', {
    languages: ['typescript'],
    pages: 1,
    maxFiles: 0,
    maxQueries: 0,
  })

  // The key must EXIST even when the window is empty, so the renderer's
  // unrecorded branch is reached by an absent draw rather than by an absent
  // field — those are different failures and only one of them is expected.
  assert.ok('collectedAt' in corpus, 'the collector must report its draw window')
  assert.equal(corpus.collectedAt, null, 'precondition: the offline path draws nothing')
  assert.equal(corpus.queries.length, 0, 'precondition: no query may have been issued')
})
