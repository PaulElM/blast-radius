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
import { collectCorpus } from '../src/pipeline.mjs'

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
