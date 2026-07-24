// Tests for the one distinction the search layer must never get wrong: a query
// that hit the 1000-result ceiling versus a query that failed.
//
// This exists because the failure actually happened. A run without GITHUB_TOKEN
// fell back to whatever was already cached, so the single-quote import form
// returned 5,421 files while `from "pkg"` and `require('pkg')` each returned
// `0 collected` with a 401 — and the pipeline carried on and produced a census
// that looked complete. Every double-quoted import in the ecosystem was missing
// and no number anywhere in the output said so.
//
// The two cases are indistinguishable downstream: "this query found nothing" and
// "this query never ran" both arrive as zero rows. So they have to be separated
// here, at the only place that still knows which one happened.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isFatalSearchError } from '../src/github.mjs'

test('a 401 is fatal — an unauthenticated run is blind, not partial', () => {
  assert.equal(isFatalSearchError(new Error('401 https://api.github.com/search/code?q=x: Bad credentials')), true)
})

test('exhausted retries is fatal — an abandoned query is a hole in the corpus', () => {
  assert.equal(isFatalSearchError(new Error('exhausted retries: https://api.github.com/search/code?q=x')), true)
})

test('a 422 is NOT fatal — that is the 1000-result ceiling doing its job', () => {
  // Paging past result 1000 is expected on every popular package. Treating it
  // as fatal would stop every run that matters.
  assert.equal(isFatalSearchError(new Error('422 https://api.github.com/search/code?q=x&page=11: only the first 1000 results are available')), false)
})

test('a 404 is NOT fatal — one deleted file is not a broken run', () => {
  assert.equal(isFatalSearchError(new Error('404 https://api.github.com/repos/a/b/contents/c.ts: Not Found')), false)
})
