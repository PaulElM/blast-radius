// End-to-end run: discover consumers -> fetch -> attribute -> canonicalise
// against the export surface -> cross with the version diff.
//
// Every stage is cached on disk, so an interrupted run resumes and a re-run of
// an unchanged target costs zero API requests. That is not a convenience: at 10
// search requests/minute a full corpus draw is a multi-minute job, and a
// pipeline that has to restart from zero on any error is a pipeline nobody runs
// twice.

import { attributeFile } from './attribute.mjs'
import { canonicalCensus, blastRadius } from './census.mjs'
import { searchConsumers, fetchFile } from './github.mjs'
import { exportSurface, diffSurface, fetchPackument, resolveVersion, majorOf } from './surface.mjs'

/** Resolve the two versions to diff, and confirm the trigger event is real. */
export async function resolveTarget(pkg, fromSpec, toSpec) {
  const packument = await fetchPackument(pkg)
  const from = resolveVersion(packument, fromSpec)
  const to = resolveVersion(packument, toSpec)
  const times = packument.time ?? {}

  return {
    pkg,
    from,
    to,
    fromPublished: times[from] ?? null,
    toPublished: times[to] ?? null,
    distTags: packument['dist-tags'] ?? {},
    repository: packument.repository?.url ?? null,
    homepage: packument.homepage ?? null,
    // The whole ICP rests on the trigger being a DATED, PUBLISHED event rather
    // than a rumour. A prerelease dist-tag at a higher major is exactly that:
    // the publisher has already committed, in public, in a machine-readable
    // place. If this is false we are guessing, and the report should say so.
    isMajorBump: majorOf(to) > majorOf(from),
  }
}

export async function collectCorpus(pkg, { languages, pages, maxFiles, maxQueries, onLog } = {}) {
  onLog?.(`search: consumers of ${pkg} across [${languages.join(', ')}]`)
  const { files, queries } = await searchConsumers(pkg, { languages, pages, maxQueries, onLog })
  const repos = new Set(files.map((f) => f.repo))
  onLog?.(`  ${files.length} candidate files across ${repos.size} repos from ${queries.length} queries`)

  const targets = maxFiles ? files.slice(0, maxFiles) : files
  const results = []
  let fetched = 0
  let missing = 0

  for (const hit of targets) {
    let text
    try {
      text = await fetchFile(hit)
    } catch (err) {
      onLog?.(`  fetch failed ${hit.repo}/${hit.path}: ${String(err).slice(0, 100)}`)
      missing++
      continue
    }
    if (text == null) {
      missing++
      continue
    }
    fetched++
    results.push(attributeFile({ ...hit, ref: 'HEAD', text }, pkg))
    if (fetched % 200 === 0) onLog?.(`  parsed ${fetched}/${targets.length}`)
  }

  onLog?.(`  parsed ${fetched} files (${missing} unavailable)`)
  return { candidateFiles: files.length, candidateRepos: repos.size, queries, results, fetched, missing }
}

export async function runReport(pkg, { fromSpec = 'latest', toSpec = 'next', languages = ['typescript'], pages = 10, maxFiles = 0, maxQueries, onLog } = {}) {
  const target = await resolveTarget(pkg, fromSpec, toSpec)
  onLog?.(`target: ${pkg} ${target.from} -> ${target.to} (major bump: ${target.isMajorBump})`)

  const before = await exportSurface(pkg, target.from, { onLog })
  const after = await exportSurface(pkg, target.to, { onLog })
  const diff = diffSurface(before, after)
  onLog?.(`surface diff: ${JSON.stringify(diff.totals)}, ${diff.removedEntryPoints.length} entry points removed`)

  const corpus = await collectCorpus(pkg, { languages, pages, maxFiles, maxQueries, onLog })
  const census = canonicalCensus(corpus.results, { pkg, surface: before })
  onLog?.(`census: ${census.repoCount} repos, ${census.fileCount} files, ${census.attributions} attributions`)

  const radius = blastRadius(census, diff, { afterSurface: after })
  onLog?.(`blast radius: ${radius.affectedRepos}/${radius.scannedRepos} scanned repos affected`)

  return {
    target,
    diff,
    corpus,
    census,
    radius,
    surfaceSizes: {
      before: before.entries,
      after: after.entries,
      // Carried so the report can state the wildcard hole from THIS package's
      // manifest instead of asserting a fact about it that nobody measured.
      wildcardsBefore: before.wildcards ?? [],
      wildcardsAfter: after.wildcards ?? [],
    },
  }
}
