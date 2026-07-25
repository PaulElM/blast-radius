// Tests for the canonical census and the blast-radius cross.
//
// These pin the two defects an earlier README recorded and left open. Both are
// invisible to KT-A, the precision audit that passed 0/60, because every
// individual attribution involved is TRUE — it is the ROLL-UP that was wrong.
// A precision test measures whether the hits are real. It cannot measure whether
// the number printed next to them is right, and this file is the answer to that.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { specifierToSubpath, canonicalize, canonicalCensus, blastRadius } from '../src/census.mjs'
import { diffSurface } from '../src/surface.mjs'

const sym = (kinds, members = [], privateMembers = []) => ({
  kinds,
  typeOnly: kinds.every((k) => k === 'interface' || k === 'type'),
  members,
  privateMembers,
})

function surface(version, entries) {
  return {
    pkg: 'p',
    version,
    entries: new Map(Object.entries(entries).map(([k, v]) => [k, new Map(Object.entries(v))])),
  }
}

function attribution(over = {}) {
  return {
    repo: 'o/r',
    path: 'src/a.ts',
    symbol: 'thing',
    local: 'thing',
    style: 'named',
    specifier: 'p',
    typeOnly: false,
    usage: 'call',
    line: 1,
    column: 1,
    snippet: '',
    ...over,
  }
}

const file = (attributions) => ({ repo: 'o/r', path: 'src/a.ts', attributions })

test('specifierToSubpath maps a package specifier to its entry point', () => {
  assert.equal(specifierToSubpath('drizzle-orm', 'drizzle-orm'), '.')
  assert.equal(specifierToSubpath('drizzle-orm/pg-core', 'drizzle-orm'), './pg-core')
  assert.equal(specifierToSubpath('drizzle-orm-extra', 'drizzle-orm'), null)
})

test('default-interop is merged ONLY when the package has no default export', () => {
  // This is the root-fragmentation fix, and the reason it is a per-package fact
  // rather than a string rule. `import p from 'pkg'` binds the module namespace
  // object when the package publishes no default, so `default.a` and `a` are the
  // same symbol. When the package DOES export a default they are genuinely
  // different, and merging them would invent usage that does not exist.
  const noDefault = { pkg: 'p', surfaceIndex: new Map([['.', new Set(['a'])]]), defaultExports: new Set() }
  const merged = canonicalize(attribution({ symbol: 'default.a', style: 'default' }), noDefault)
  assert.equal(merged.symbol, 'a')
  assert.equal(merged.merged, true)

  const withDefault = {
    pkg: 'p',
    surfaceIndex: new Map([['.', new Set(['a', 'default'])]]),
    defaultExports: new Set(['.']),
  }
  const kept = canonicalize(attribution({ symbol: 'default.a', style: 'default' }), withDefault)
  assert.equal(kept.symbol, 'default')
  assert.equal(kept.merged, false)
})

test('root fragmentation collapses: three import styles become one symbol', () => {
  // Before this, `a` (named), `a` (namespace) and `default.a` (default) were
  // three rows in the census and every published count was a lower bound.
  const s = surface('1.0.0', { '.': { a: sym(['function']) } })
  const c = canonicalCensus(
    [
      file([
        attribution({ symbol: 'a', style: 'named', repo: 'o/one' }),
        attribution({ symbol: 'a', style: 'namespace', repo: 'o/two' }),
        attribution({ symbol: 'default.a', style: 'default', repo: 'o/three' }),
      ]),
    ],
    { pkg: 'p', surface: s },
  )

  const root = c.entries.find((e) => e.subpath === '.')
  assert.equal(root.symbols.length, 1)
  assert.equal(root.symbols[0].symbol, 'a')
  assert.equal(root.symbols[0].repos, 3)
  assert.equal(c.mergedByDefaultInterop, 1)
})

test('subpaths stay separate instead of being flattened into the root', () => {
  // Defect 2b. `p` and `p/sub` are different export surfaces to a publisher, and
  // on this cycle's target 76 whole entry points disappear — flattening them
  // would hide the single largest category of break.
  const s = surface('1.0.0', { '.': { a: sym(['function']) }, './sub': { a: sym(['function']) } })
  const c = canonicalCensus(
    [
      file([
        attribution({ symbol: 'a', specifier: 'p', repo: 'o/one' }),
        attribution({ symbol: 'a', specifier: 'p/sub', repo: 'o/two' }),
      ]),
    ],
    { pkg: 'p', surface: s },
  )

  assert.equal(c.entries.length, 2)
  assert.deepEqual(c.entries.map((e) => e.subpath).sort(), ['.', './sub'])
  for (const entry of c.entries) assert.equal(entry.symbols[0].repos, 1)
})

test('re-exports are not counted as consumption', () => {
  const s = surface('1.0.0', { '.': { a: sym(['function']) } })
  const c = canonicalCensus([file([attribution({ symbol: 'a', usage: 'reexport' })])], { pkg: 'p', surface: s })
  assert.equal(c.attributions, 0)
  assert.equal(c.repoCount, 0)
})

test('a symbol absent from the published surface is flagged, not silently dropped', () => {
  const s = surface('1.0.0', { '.': { a: sym(['function']) } })
  const c = canonicalCensus([file([attribution({ symbol: 'ghost' })])], { pkg: 'p', surface: s })
  assert.equal(c.notInSurface, 1)
  assert.equal(c.entries[0].symbols[0].inSurface, false)
})

test('blastRadius separates entry-point, symbol and member breaks', () => {
  const before = surface('1.0.0', {
    '.': { kept: sym(['function']), gone: sym(['function']), Client: sym(['class'], ['settings', 'from']) },
    './dropped': { x: sym(['function']) },
  })
  const after = surface('2.0.0', {
    '.': { kept: sym(['function']), Client: sym(['class'], ['from']) },
  })
  const diff = diffSurface(before, after)

  const census = canonicalCensus(
    [
      file([
        attribution({ symbol: 'kept', repo: 'o/safe' }),
        attribution({ symbol: 'gone', repo: 'o/breaks' }),
        attribution({ symbol: 'Client.settings', repo: 'o/member' }),
        attribution({ symbol: 'x', specifier: 'p/dropped', repo: 'o/entry' }),
      ]),
    ],
    { pkg: 'p', surface: before },
  )

  const r = blastRadius(census, diff)
  assert.deepEqual(r.entryPointBreaks.map((b) => b.subpath), ['./dropped'])
  assert.deepEqual(r.symbolBreaks.map((b) => b.symbol), ['gone'])
  assert.deepEqual(r.memberBreaks.map((b) => b.path), ['Client.settings'])
  // `o/safe` uses only a surviving symbol and must not appear.
  assert.equal(r.affectedRepoList.includes('o/safe'), false)
  assert.ok(r.affectedRepoList.includes('o/breaks'))
  assert.ok(r.affectedRepoList.includes('o/entry'))
})

test('type-only breakage is counted but excluded from the runtime-affected total', () => {
  // Losing a type breaks `tsc`, not production. Merging the two would overstate
  // the severity of the claim we are selling.
  const before = surface('1.0.0', { '.': { OnlyAType: sym(['type']), realFn: sym(['function']) } })
  const after = surface('2.0.0', { '.': {} })
  const diff = diffSurface(before, after)

  const census = canonicalCensus(
    [
      file([
        attribution({ symbol: 'OnlyAType', repo: 'o/types', usage: 'type', typeOnly: true }),
        attribution({ symbol: 'realFn', repo: 'o/runtime', usage: 'call' }),
      ]),
    ],
    { pkg: 'p', surface: before },
  )

  const r = blastRadius(census, diff)
  assert.equal(r.affectedRepos, 2)
  assert.equal(r.runtimeAffectedRepos, 1)
  assert.equal(r.symbolBreaks.find((b) => b.symbol === 'OnlyAType').typeOnly, true)
  assert.equal(r.symbolBreaks.find((b) => b.symbol === 'realFn').typeOnly, false)
})

test('a removed symbol that survives elsewhere is flagged as a likely relocation', () => {
  // A 0.x -> 1.0 rewrite removing 1,434 exports while ADDING 3,539 is mostly
  // MOVING things. The consumer's import breaks either way, so "affected" stays
  // true — but calling a relocation a removal overstates severity to a buyer who
  // can check, which is the exact self-inflicted trust event the pricing red
  // lines exist to prevent.
  const before = surface('1.0.0', { './old': { moved: sym(['function']), deleted: sym(['function']) } })
  const after = surface('2.0.0', { './old': {}, './new': { moved: sym(['function']) } })
  const diff = diffSurface(before, after)

  const census = canonicalCensus(
    [
      file([
        attribution({ symbol: 'moved', specifier: 'p/old', repo: 'o/a' }),
        attribution({ symbol: 'deleted', specifier: 'p/old', repo: 'o/b' }),
      ]),
    ],
    { pkg: 'p', surface: before },
  )

  const r = blastRadius(census, diff, { afterSurface: after })
  const moved = r.symbolBreaks.find((b) => b.symbol === 'moved')
  const deleted = r.symbolBreaks.find((b) => b.symbol === 'deleted')

  assert.equal(moved.likelyRelocated, true)
  assert.deepEqual(moved.stillExportedFrom, ['./new'])
  assert.equal(deleted.likelyRelocated, false)
  assert.deepEqual(deleted.stillExportedFrom, [])
  // Both still count as affected — the consumer's import fails either way.
  assert.equal(r.affectedRepos, 2)
})

test('relocation flagging stays inert when no after-surface is supplied', () => {
  const before = surface('1.0.0', { '.': { gone: sym(['function']) } })
  const after = surface('2.0.0', { '.': {} })
  const census = canonicalCensus([file([attribution({ symbol: 'gone' })])], { pkg: 'p', surface: before })
  const r = blastRadius(census, diffSurface(before, after))
  assert.equal(r.symbolBreaks[0].likelyRelocated, false)
})

test('every break carries a file and a line, one per repo', () => {
  // The report SAYS "with the file and line". It said so for a whole cycle while
  // the census threw the provenance away and the list rendered bare repo names —
  // a promise of evidence that the pipeline had already discarded. This test is
  // the promise, pinned: a break without a location is a worry, not a checklist.
  const before = surface('1.0.0', { '.': { gone: sym(['function']) } })
  const after = surface('2.0.0', { '.': {} })
  const census = canonicalCensus(
    [
      file([
        attribution({ symbol: 'gone', repo: 'o/a', path: 'src/db.ts', line: 12 }),
        // Second hit in the SAME repo must not add a second checklist row.
        attribution({ symbol: 'gone', repo: 'o/a', path: 'src/other.ts', line: 40 }),
        attribution({ symbol: 'gone', repo: 'o/b', path: 'lib/x.ts', line: 3 }),
      ]),
    ],
    { pkg: 'p', surface: before },
  )

  const r = blastRadius(census, diffSurface(before, after))
  assert.deepEqual(r.symbolBreaks[0].sites, [
    { repo: 'o/a', path: 'src/db.ts', line: 12, runtime: true },
    { repo: 'o/b', path: 'lib/x.ts', line: 3, runtime: true },
  ])
  assert.deepEqual(r.evidenceByRepo['o/b'], [
    { kind: 'symbol', what: 'gone (.)', path: 'lib/x.ts', line: 3, runtime: true },
  ])
  // Every affected repo is locatable — the list and the evidence cannot drift.
  for (const repo of r.affectedRepoList) assert.ok(r.evidenceByRepo[repo]?.length, `no site for ${repo}`)
})

test('runtime-vs-compile is decided per repo, not per symbol', () => {
  // Found by hand-verifying a real report row. `BaseSQLiteDatabase` is a class,
  // and one consumer imported it as a VALUE while another wrote
  // `import type { BaseSQLiteDatabase }`. The symbol-level flag only fires when
  // every hit everywhere is type-only, so the single value-use dragged the
  // type-only consumers into the "breaks at runtime" headline with it.
  const before = surface('1.0.0', { '.': { Klass: sym(['class']) } })
  const after = surface('2.0.0', { '.': {} })
  const census = canonicalCensus(
    [
      file([
        attribution({ symbol: 'Klass', repo: 'o/value-use', usage: 'call' }),
        attribution({ symbol: 'Klass', repo: 'o/type-use', usage: 'type', typeOnly: true }),
      ]),
    ],
    { pkg: 'p', surface: before },
  )

  const r = blastRadius(census, diffSurface(before, after))
  assert.equal(r.affectedRepos, 2, 'both are affected — both fail to compile')
  assert.equal(r.runtimeAffectedRepos, 1, 'only the value-use repo breaks at runtime')
  assert.equal(r.evidenceByRepo['o/type-use'][0].runtime, false)
  assert.equal(r.evidenceByRepo['o/value-use'][0].runtime, true)
})

test('a removal nobody uses is counted as free, not as a break', () => {
  const before = surface('1.0.0', { '.': { used: sym(['function']), unused: sym(['function']) } })
  const after = surface('2.0.0', { '.': {} })
  const diff = diffSurface(before, after)

  const census = canonicalCensus([file([attribution({ symbol: 'used' })])], { pkg: 'p', surface: before })
  const r = blastRadius(census, diff)

  assert.equal(r.symbolBreaks.length, 1)
  assert.equal(r.unusedRemovals, 1)
})

// ---------------------------------------------------------------------------
// Wildcard-reachable entry points — the hole that made category A print zero.
//
// `diff.perEntry` only has rows for subpaths the manifest DECLARES. Consumers
// import through wildcard `exports` keys too, and the cross used to `continue`
// straight past every one of those. On the shipped `typeorm` report that skipped
// 64 of the 66 entry points consumers actually import from, 12 of which resolve
// in the old version and are gone in the new one — so the report's own
// highest-severity row was structurally incapable of being non-zero.
//
// The fixture below deliberately contains one gone, one surviving, one that
// never resolved, and one declared subpath. A fixture where every consumed
// subpath is declared cannot fail in the direction under test.
// ---------------------------------------------------------------------------

function wildcardFixture() {
  const before = surface('1.0.0', { '.': { kept: sym(['function']) } })
  const after = surface('2.0.0', { '.': { kept: sym(['function']) } })
  const census = canonicalCensus(
    [
      file([
        attribution({ symbol: 'kept', specifier: 'p', repo: 'o/declared' }),
        attribution({ symbol: 'Opt', specifier: 'p/deep/Gone', repo: 'o/gone' }),
        attribution({ symbol: 'Live', specifier: 'p/deep/Survives', repo: 'o/survives' }),
        attribution({ symbol: 'Never', specifier: 'p/deep/Never', repo: 'o/never' }),
      ]),
    ],
    { pkg: 'p', surface: before },
  )
  const reach = {
    before: new Map([['./deep/Gone', true], ['./deep/Survives', true], ['./deep/Never', false]]),
    after: new Map([['./deep/Gone', false], ['./deep/Survives', true], ['./deep/Never', false]]),
  }
  return { before, after, diff: diffSurface(before, after), census, reach }
}

test('W1: a wildcard-reachable subpath that stops resolving IS an entry-point break', () => {
  const { after, diff, census, reach } = wildcardFixture()
  const r = blastRadius(census, diff, { afterSurface: after, wildcardReach: reach })
  const broken = r.entryPointBreaks.filter((b) => b.viaWildcard)
  assert.equal(broken.length, 1)
  assert.equal(broken[0].subpath, './deep/Gone')
  assert.equal(broken[0].repos, 1)
  assert.ok(broken[0].sites.length >= 1, 'an import-time break must carry a file and a line')
})

test('W2: a wildcard subpath that still resolves is NOT a break', () => {
  const { after, diff, census, reach } = wildcardFixture()
  const r = blastRadius(census, diff, { afterSurface: after, wildcardReach: reach })
  assert.equal(r.entryPointBreaks.some((b) => b.subpath === './deep/Survives'), false)
})

test('W3: a subpath that resolved in NEITHER version is not our break', () => {
  // Negative control. It was already unresolvable before this release, so
  // reporting it would blame the publisher for a break they did not cause —
  // and a category that fires on everything is not a category.
  const { after, diff, census, reach } = wildcardFixture()
  const r = blastRadius(census, diff, { afterSurface: after, wildcardReach: reach })
  assert.equal(r.entryPointBreaks.some((b) => b.subpath === './deep/Never'), false)
})

test('W4: an UNPROBED wildcard surface renders NOT RECORDED, never zero', () => {
  // The branch a tidy will "simplify" to `{ broken: 0 }`. An unprobed hole and a
  // probed-and-empty hole are different claims and only one of them is evidence.
  const { after, diff, census } = wildcardFixture()
  const r = blastRadius(census, diff, { afterSurface: after })
  assert.equal(r.wildcardEntryPoints, null)
  assert.equal(r.entryPointBreaks.length, 0)
})

test('W5: the probe counts what it examined, not just what it found', () => {
  const { after, diff, census, reach } = wildcardFixture()
  const r = blastRadius(census, diff, { afterSurface: after, wildcardReach: reach })
  assert.equal(r.wildcardEntryPoints.consumedNotDeclared, 3)
  assert.equal(r.wildcardEntryPoints.broken, 1)
})

test('W6: a wildcard break adds its repos to the affected and runtime sets', () => {
  const { after, diff, census, reach } = wildcardFixture()
  const r = blastRadius(census, diff, { afterSurface: after, wildcardReach: reach })
  assert.ok(r.affectedRepoList.includes('o/gone'))
  assert.equal(r.affectedRepoList.includes('o/survives'), false)
  assert.ok(r.evidenceByRepo['o/gone'].some((e) => e.kind === 'entry-point'))
})

test('W7: the wildcard pass moves NO declared-surface number', () => {
  // The double-count guard, and it is the check that can fail: wildcard-reachable
  // files were never in the manifest's `removed` list, so nothing may come out of
  // `unusedRemovals` or `symbolBreaks` to pay for the new category.
  const { after, diff, census, reach } = wildcardFixture()
  const off = blastRadius(census, diff, { afterSurface: after })
  const on = blastRadius(census, diff, { afterSurface: after, wildcardReach: reach })
  assert.equal(on.unusedRemovals, off.unusedRemovals)
  assert.equal(on.symbolBreaks.length, off.symbolBreaks.length)
  assert.equal(on.memberBreaks.length, off.memberBreaks.length)
  assert.equal(on.scannedRepos, off.scannedRepos)
})

test('W8: a DECLARED subpath is never counted through the wildcard path', () => {
  // Guards against the same entry point being reported twice — once from
  // `perEntry` and once from the wildcard probe.
  const { after, diff, census } = wildcardFixture()
  const reach = { before: new Map([['.', true]]), after: new Map([['.', false]]) }
  const r = blastRadius(census, diff, { afterSurface: after, wildcardReach: reach })
  assert.equal(r.entryPointBreaks.some((b) => b.subpath === '.'), false)
  assert.equal(r.wildcardEntryPoints.broken, 0)
})
