// The canonical census — attributions reconciled against the package's own
// export surface, then crossed with the version diff.
//
// This module exists to close two defects that the Cycle 3 README recorded and
// deliberately left open, because both of them make published numbers WRONG in
// a way that is invisible to the precision test (KT-A) that passed 0/60:
//
//  (1) ROOT FRAGMENTATION. `z.string` (named import), `string` (namespace
//      import) and `default.string` (default import) are the same symbol counted
//      three times, so every count was a LOWER BOUND. KT-A cannot see this: each
//      of the three attributions is individually TRUE. A precision test measures
//      whether the hits we report are real. It says nothing about whether the
//      number next to them is right.
//
//  (2) SUBPATH FLATTENING. `drizzle-orm/pg-core` was rolled into `drizzle-orm`.
//      To a publisher those are different export surfaces, and in this target
//      76 whole entry points disappear in 1.0 — so flattening them would hide
//      the single largest category of break.
//
// The fix for both is the same object: the package's real export surface, read
// from the published tarball (see surface.mjs). Note the ordering that made
// this possible — canonicalisation is NOT string normalisation. Deciding that
// `default.createClient` and `createClient` are the same symbol requires knowing
// whether the package actually has a default export. That is a per-package fact
// resolved from the artifact, never a rule hard-coded from whichever package we
// happened to look at first.

/** `drizzle-orm/pg-core` -> `./pg-core`; `drizzle-orm` -> `.` */
export function specifierToSubpath(specifier, pkg) {
  if (specifier === pkg) return '.'
  if (specifier.startsWith(pkg + '/')) return './' + specifier.slice(pkg.length + 1)
  return null
}

/**
 * Resolve one attribution to { subpath, symbol, path } against the surface.
 *
 * `symbol` is the top-level export the consumer touched — that is the unit the
 * publisher's diff is expressed in. `path` keeps the full member chain so a
 * member-level break (`SupabaseClient.settings`) is still addressable.
 */
export function canonicalize(attribution, { pkg, surfaceIndex, defaultExports }) {
  const subpath = specifierToSubpath(attribution.specifier, pkg)
  const declared = subpath != null && surfaceIndex.has(subpath)
  const exported = declared ? surfaceIndex.get(subpath) : null

  let parts = attribution.symbol === '*' ? ['*'] : attribution.symbol.split('.')
  let merged = false

  // CJS/ESM interop: `import pkg from 'p'` binds the module namespace object
  // when `p` publishes no default export, so `default.createClient` and
  // `createClient` are the same symbol. When the package DOES export a default,
  // they are genuinely different and must stay apart.
  if (parts[0] === 'default' && parts.length > 1 && subpath != null && !defaultExports.has(subpath)) {
    parts = parts.slice(1)
    merged = true
  }

  const symbol = parts[0]
  return {
    subpath: subpath ?? '<unresolved>',
    declaredEntryPoint: declared,
    symbol,
    path: parts.join('.'),
    members: parts.slice(1),
    // A symbol the consumer imports that the package does not export is a real
    // signal, not a nuisance: either our surface under-captured it (a bug we
    // want to see) or the consumer is reaching past the public API (a break
    // waiting to happen). Either way it must be visible, never silently dropped.
    inSurface: exported ? exported.has(symbol) : null,
    merged,
  }
}

/**
 * Roll canonicalised attributions up per entry point.
 *
 * Repos, not hits, are the headline everywhere. One consumer with a 400-line
 * generated file is one consumer; counting its hits would let a single repo
 * dominate the report exactly as it once dominated the KT-A sample.
 */
/** First site per repo, so one repo contributes one line to a checklist. */
function dedupeByRepo(sites) {
  const seen = new Map()
  for (const s of sites) if (!seen.has(s.repo)) seen.set(s.repo, s)
  return [...seen.values()]
}

export function canonicalCensus(fileResults, { pkg, surface }) {
  const surfaceIndex = new Map()
  const defaultExports = new Set()
  for (const [subpath, symbols] of surface.entries) {
    surfaceIndex.set(subpath, new Set(symbols.keys()))
    if (symbols.has('default')) defaultExports.add(subpath)
  }

  const entries = new Map()
  const repos = new Set()
  const files = new Set()
  let attributions = 0
  let mergedCount = 0
  let unknownCount = 0

  for (const file of fileResults) {
    for (const a of file.attributions) {
      if (a.usage === 'reexport') continue // passing through, not consuming
      const c = canonicalize(a, { pkg, surfaceIndex, defaultExports })

      attributions++
      if (c.merged) mergedCount++
      if (c.inSurface === false) unknownCount++
      repos.add(a.repo)
      files.add(`${a.repo}/${a.path}`)

      if (!entries.has(c.subpath)) {
        entries.set(c.subpath, {
          subpath: c.subpath,
          declaredEntryPoint: c.declaredEntryPoint,
          repos: new Set(),
          symbols: new Map(),
        })
      }
      const entry = entries.get(c.subpath)
      entry.repos.add(a.repo)

      if (!entry.symbols.has(c.symbol)) {
        entry.symbols.set(c.symbol, {
          symbol: c.symbol,
          hits: 0,
          repos: new Set(),
          typeOnlyHits: 0,
          inSurface: c.inSurface,
          paths: new Map(),
          // One exemplar site per repo: repo -> {path, line}.
          //
          // A count tells a publisher how bad it is; a file and a line tell them
          // what to do on Monday. Without this the deliverable is an estimate
          // wearing a checklist's clothes — and the report SAID "with the file
          // and line" while carrying neither, which is the second time a
          // sentence has promised evidence the pipeline threw away.
          //
          // First occurrence only, deliberately: the goal is to let the reader
          // land on the break, not to mirror the corpus into the report.
          sites: new Map(),
          // Repos with at least one hit that is NOT type-only.
          //
          // "Does this break at runtime?" is a property of the CONSUMER, not of
          // the symbol. `import type { BaseSQLiteDatabase }` is erased at
          // compile time: that repo's build fails and its production bundle does
          // not. The symbol-level flag only fires when EVERY hit anywhere is
          // type-only, so one value-use in one repo was silently promoting the
          // other seven into a runtime-break headline they do not belong in.
          // Overstating severity is the failure mode a publisher fact-checks
          // first, and the one that costs the most when they find it.
          runtimeRepos: new Set(),
        })
      }
      const sym = entry.symbols.get(c.symbol)
      sym.hits++
      if (!sym.sites.has(a.repo)) sym.sites.set(a.repo, { path: a.path, line: a.line })
      if (a.typeOnly || a.usage === 'type') sym.typeOnlyHits++
      else sym.runtimeRepos.add(a.repo)
      sym.repos.add(a.repo)
      if (c.members.length) {
        const key = c.path
        if (!sym.paths.has(key)) sym.paths.set(key, new Set())
        sym.paths.get(key).add(a.repo)
      }
    }
  }

  const rendered = [...entries.values()]
    .map((e) => ({
      subpath: e.subpath,
      declaredEntryPoint: e.declaredEntryPoint,
      repos: e.repos.size,
      repoList: [...e.repos].sort(),
      symbols: [...e.symbols.values()]
        .map((s) => ({
          symbol: s.symbol,
          hits: s.hits,
          repos: s.repos.size,
          repoList: [...s.repos].sort(),
          typeOnlyHits: s.typeOnlyHits,
          inSurface: s.inSurface,
          sites: [...s.sites.entries()].map(([repo, site]) => ({
            repo,
            ...site,
            runtime: s.runtimeRepos.has(repo),
          })),
          runtimeRepoList: [...s.runtimeRepos].sort(),
          memberPaths: [...s.paths.entries()]
            .map(([path, r]) => ({ path, repos: r.size }))
            .sort((a, b) => b.repos - a.repos),
        }))
        .sort((a, b) => b.repos - a.repos || b.hits - a.hits),
    }))
    .sort((a, b) => b.repos - a.repos)

  return {
    pkg,
    surfaceVersion: surface.version,
    fileCount: files.size,
    repoCount: repos.size,
    attributions,
    // Reported, not buried: this is the size of the error the old census carried.
    mergedByDefaultInterop: mergedCount,
    notInSurface: unknownCount,
    entries: rendered,
  }
}

/**
 * Cross the census with the version diff: which consumers actually break.
 *
 * Three categories, kept apart on purpose because they differ in severity and a
 * publisher triages them differently:
 *
 *   entryPointRemoved — the whole subpath stops resolving. Breaks at IMPORT
 *                       time, before a single line runs, and no call-site
 *                       inspection will find it.
 *   symbolRemoved     — an export is gone. Breaks at the use site.
 *   memberRemoved     — the export survives but a property of it is gone.
 *                       The narrowest and easiest to miss by reading a changelog.
 *
 * Type-only usage is tracked separately throughout: losing a type breaks the
 * build, not production, and pretending those are the same overstates the claim.
 */
/**
 * Where else does this name still exist in the new version?
 *
 * A 0.x -> 1.0 rewrite that removes 1,434 exports while ADDING 3,539 is not
 * mostly deleting things — it is mostly moving them. The consumer's import
 * breaks either way, so "affected" stays true, but "an API that 1.0 removes"
 * overstates the severity when the symbol is alive at a new address, and
 * overstating severity to a buyer who can check is precisely the self-inflicted
 * trust event this company's pricing red lines exist to prevent.
 *
 * This is a SIGNAL, never a proof. A same-named export elsewhere may be an
 * entirely different symbol — drizzle exports `bigint` from both `pg-core` and
 * `mysql-core`. So the report says "likely a move or rename, verify", and never
 * "this was moved". It also happens to be the triage the buyer is paying for.
 */
function relocationIndex(afterSurface) {
  const byName = new Map()
  if (!afterSurface) return byName
  for (const [subpath, symbols] of afterSurface.entries) {
    for (const name of symbols.keys()) {
      if (!byName.has(name)) byName.set(name, [])
      byName.get(name).push(subpath)
    }
  }
  return byName
}

export function blastRadius(census, diff, { afterSurface } = {}) {
  const byEntry = new Map(diff.perEntry.map((e) => [e.subpath, e]))
  const stillNamed = relocationIndex(afterSurface)
  // Which (entry point, symbol) pairs does any scanned consumer actually touch?
  // Needed to count the removals that cost nothing, and it has to be a real
  // lookup rather than arithmetic over totals: subtracting break counts from the
  // removal total silently mixes in symbols that are used but not removed, and
  // can even go negative. A headline number ("this part of the break is free")
  // must be counted, not inferred.
  const used = new Set()
  for (const entry of census.entries) {
    for (const sym of entry.symbols) used.add(entry.subpath + '::' + sym.symbol)
  }

  const entryPointBreaks = []
  const symbolBreaks = []
  const memberBreaks = []
  const affectedRepos = new Set()
  const runtimeAffectedRepos = new Set()

  for (const entry of census.entries) {
    const d = byEntry.get(entry.subpath)
    if (!d) continue

    if (d.entryPointRemoved) {
      const used = entry.symbols.map((s) => s.symbol)
      const survivingNames = used.filter((s) => (stillNamed.get(s) ?? []).length > 0)
      entryPointBreaks.push({
        subpath: entry.subpath,
        repos: entry.repos,
        repoList: entry.repoList,
        symbolsUsed: used.length,
        // How much of what they import from this dead entry point still exists
        // somewhere in the new version. High => the fix is a re-point, not a
        // rewrite, and saying so is the difference between a scare and a triage.
        symbolsStillExportedElsewhere: survivingNames.length,
        // One site per repo, so an import-time break is actionable and not just
        // alarming. First symbol that names the repo wins.
        sites: dedupeByRepo(entry.symbols.flatMap((s) => s.sites ?? [])),
      })
      // A dead entry point fails at import — but `import type { X } from
      // 'dead/path'` is erased, so that consumer's build breaks and its runtime
      // does not. Runtime status is per repo here too.
      const runtimeHere = new Set(entry.symbols.flatMap((s) => s.runtimeRepoList ?? []))
      for (const r of entry.repoList) {
        affectedRepos.add(r)
        if (runtimeHere.has(r)) runtimeAffectedRepos.add(r)
      }
      continue
    }

    const removed = new Map(d.removed.map((r) => [r.symbol, r]))
    const memberRemoved = new Map(
      d.memberChanges.filter((c) => c.removedMembers.length).map((c) => [c.symbol, new Set(c.removedMembers)]),
    )

    for (const sym of entry.symbols) {
      const gone = removed.get(sym.symbol)
      if (gone) {
        const typeOnly = gone.typeOnly || sym.typeOnlyHits === sym.hits
        const elsewhere = (stillNamed.get(sym.symbol) ?? []).filter((s) => s !== entry.subpath)
        symbolBreaks.push({
          subpath: entry.subpath,
          symbol: sym.symbol,
          kinds: gone.kinds,
          typeOnly,
          repos: sym.repos,
          hits: sym.hits,
          repoList: sym.repoList,
          // Empty => gone from the package entirely. Non-empty => a same-named
          // export survives at these entry points, so this is LIKELY a move or
          // rename rather than a deletion. Still a break for the consumer.
          stillExportedFrom: elsewhere,
          likelyRelocated: elsewhere.length > 0,
          sites: sym.sites ?? [],
        })
        const runtimeHere = new Set(sym.runtimeRepoList ?? (typeOnly ? [] : sym.repoList))
        for (const r of sym.repoList) {
          affectedRepos.add(r)
          if (runtimeHere.has(r)) runtimeAffectedRepos.add(r)
        }
        continue
      }

      const goneMembers = memberRemoved.get(sym.symbol)
      if (!goneMembers) continue
      for (const mp of sym.memberPaths) {
        const first = mp.path.split('.')[1]
        if (first && goneMembers.has(first)) {
          memberBreaks.push({
            subpath: entry.subpath,
            symbol: sym.symbol,
            member: first,
            path: mp.path,
            repos: mp.repos,
          })
        }
      }
    }
  }

  const sortByRepos = (a, b) => b.repos - a.repos
  entryPointBreaks.sort(sortByRepos)
  symbolBreaks.sort(sortByRepos)
  memberBreaks.sort(sortByRepos)

  // repo -> what breaks in it and where. This is the checklist the buyer is
  // actually paying for: an affected-repo list without a file and a line is a
  // list of people to worry about, not a list of things to fix.
  const byRepo = new Map()
  const addEvidence = (breaks, kind, label) => {
    for (const b of breaks) {
      for (const site of b.sites ?? []) {
        if (!byRepo.has(site.repo)) byRepo.set(site.repo, [])
        byRepo.get(site.repo).push({
          kind,
          what: label(b),
          path: site.path,
          line: site.line,
          runtime: site.runtime ?? true,
        })
      }
    }
  }
  addEvidence(entryPointBreaks, 'entry-point', (b) => b.subpath)
  addEvidence(symbolBreaks, 'symbol', (b) => `${b.symbol} (${b.subpath})`)

  return {
    from: diff.from,
    to: diff.to,
    scannedRepos: census.repoCount,
    scannedFiles: census.fileCount,
    affectedRepos: affectedRepos.size,
    affectedRepoList: [...affectedRepos].sort(),
    evidenceByRepo: Object.fromEntries([...byRepo.entries()].sort(([a], [b]) => (a < b ? -1 : 1))),
    runtimeAffectedRepos: runtimeAffectedRepos.size,
    shareOfScannedRepos: census.repoCount ? affectedRepos.size / census.repoCount : 0,
    entryPointBreaks,
    symbolBreaks,
    memberBreaks,
    // Removed symbols that NO scanned consumer touches. This is the other half
    // of the answer and it is worth money too: it tells a publisher which parts
    // of the break are free.
    unusedRemovals: diff.perEntry.reduce(
      (n, e) => n + e.removed.filter((r) => !used.has(e.subpath + '::' + r.symbol)).length,
      0,
    ),
  }
}
