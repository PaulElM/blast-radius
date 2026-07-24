// KT-A — the precision breaker.
//
// The census is only worth money if "repo X uses symbol S" is true. This module
// draws a REPRODUCIBLE RANDOM sample of attributions and prints each one with
// enough provenance to be judged by hand, one at a time.
//
// Pass condition (pre-registered before the audit was run, not chosen after
// seeing the data): false-positive rate must be <= 20%. Above that, the form
// does not work and the product stops.
//
// Random, not top-N: failure modes cluster (one weird repo, one import style),
// so a convenience sample of the most common symbols would pass while the
// product was broken.

import { searchConsumers, fetchFile } from './github.mjs'
import { attributeFile, census } from './attribute.mjs'

/** Deterministic PRNG (mulberry32) so a sample can be re-drawn and re-audited. */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(items, rand) {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Draw a sample stratified by repo: shuffle within each repo, then take
 * round-robin across repos.
 *
 * A flat random draw over attributions is dominated by whichever repo has the
 * biggest file — the first run of this audit pulled 13 of 30 hits from one
 * repo, so "30 checks" was really ~11. Since attribution failures cluster by
 * import style, and import style is a property of the repo, that is precisely
 * the wrong axis to under-sample.
 */
function stratifiedSample(items, n, seed) {
  const rand = rng(seed)
  const byRepo = new Map()
  for (const item of items) {
    if (!byRepo.has(item.repo)) byRepo.set(item.repo, [])
    byRepo.get(item.repo).push(item)
  }

  const buckets = shuffle([...byRepo.values()], rand).map((b) => shuffle(b, rand))
  const out = []
  for (let round = 0; out.length < n; round++) {
    let placed = false
    for (const bucket of buckets) {
      if (round >= bucket.length) continue
      out.push(bucket[round])
      placed = true
      if (out.length === n) break
    }
    if (!placed) break
  }
  return out
}

export async function collect(pkg, { pages = 1, maxFiles = 120, language = 'typescript' } = {}) {
  process.stderr.write(`search: consumers of "${pkg}" (${language})\n`)
  const { files: hits } = await searchConsumers(pkg, { pages, languages: [language], partition: false })
  process.stderr.write(`  ${hits.length} candidate files across ${new Set(hits.map((h) => h.repo)).size} repos\n`)

  const targets = hits.slice(0, maxFiles)
  const results = []
  let fetched = 0

  for (const hit of targets) {
    const text = await fetchFile(hit)
    if (text == null) continue
    fetched++
    results.push(attributeFile({ ...hit, ref: 'HEAD', text }, pkg))
    if (fetched % 20 === 0) process.stderr.write(`  parsed ${fetched}/${targets.length}\n`)
  }

  process.stderr.write(`  parsed ${fetched} files\n`)
  return results
}

export function buildAudit(fileResults, { n = 30, seed = 1 } = {}) {
  const all = fileResults.flatMap((f) => f.attributions)
  const drawn = stratifiedSample(all, n, seed)
  return {
    population: all.length,
    files: fileResults.length,
    filesWithError: fileResults.filter((f) => f.error).length,
    sampleSize: drawn.length,
    sampleRepos: new Set(drawn.map((a) => a.repo)).size,
    seed,
    census: census(fileResults),
    sample: drawn,
  }
}

export function renderAudit(audit, pkg) {
  const L = []
  L.push(`# KT-A precision audit — ${pkg}`)
  L.push('')
  L.push(`- files parsed: **${audit.files}** (${audit.filesWithError} parse errors)`)
  L.push(`- attributions in population: **${audit.population}**`)
  L.push(`- distinct consuming repos: **${audit.census.repoCount}**`)
  L.push(`- sample drawn: **${audit.sampleSize}** across **${audit.sampleRepos}** distinct repos (seed ${audit.seed}, reproducible, stratified by repo)`)
  L.push('')
  L.push(`**Pass condition: false positives <= 20% of the sample (${Math.floor(audit.sampleSize * 0.2)} of ${audit.sampleSize}).**`)
  L.push('')
  L.push('## Sample — judge each line: does this file really use this symbol of the package?')
  L.push('')
  audit.sample.forEach((a, i) => {
    L.push(`### ${i + 1}. \`${a.symbol}\` — ${a.repo}/${a.path}:${a.line}`)
    L.push(`- binding: \`${a.local}\` (${a.style} import from \`${a.specifier}\`)${a.typeOnly ? ', type-only' : ''}`)
    L.push(`- usage: ${a.usage}`)
    L.push('```ts')
    L.push(a.snippet)
    L.push('```')
    L.push('')
  })
  L.push('## Top symbols by consuming repos')
  L.push('')
  L.push('| symbol | repos | hits | type-only hits |')
  L.push('|---|---:|---:|---:|')
  for (const s of audit.census.symbols.slice(0, 25)) {
    L.push(`| \`${s.symbol}\` | ${s.repos} | ${s.hits} | ${s.typeOnlyHits} |`)
  }
  L.push('')
  return L.join('\n')
}
