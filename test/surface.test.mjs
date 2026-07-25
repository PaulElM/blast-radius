// Tests for pipeline step (e) — the export surface and the version diff.
//
// The diff is the second load-bearing correctness surface in the product, and it
// fails DIFFERENTLY from attribution: attribution errors show up as an obviously
// wrong file in a hand-audit, while a diff error shows up as a plausible number
// nobody can check without redoing the work. So the cases pinned here are the
// ones that produced a *plausible* wrong answer on the first real run.

import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  resolveVersion,
  majorOf,
  memberClass,
  diffSurface,
  entryPoints,
  symbolIndex,
  wildcardCandidates,
  wildcardReachability,
} from '../src/surface.mjs'

const PACKUMENT = {
  'dist-tags': { latest: '0.45.2', rc: '1.0.0-rc.4', beta: '1.0.0-beta.22' },
  versions: { '0.45.2': {}, '1.0.0-rc.4': {}, '0.44.0': {} },
}

// A surface is { pkg, version, entries: Map<subpath, Map<symbol, info>> }.
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

test('resolveVersion accepts dist-tags and exact versions, rejects anything else', () => {
  assert.equal(resolveVersion(PACKUMENT, 'latest'), '0.45.2')
  assert.equal(resolveVersion(PACKUMENT, 'rc'), '1.0.0-rc.4')
  assert.equal(resolveVersion(PACKUMENT, '0.44.0'), '0.44.0')
  assert.throws(() => resolveVersion(PACKUMENT, 'nope'), /no such version or dist-tag/)
})

test('majorOf reads the major across a prerelease boundary', () => {
  // The whole trigger detector rests on this comparison: a prerelease dist-tag
  // at a HIGHER major is the published, dated event we sell against.
  assert.equal(majorOf('0.45.2'), 0)
  assert.equal(majorOf('1.0.0-rc.4'), 1)
  assert.ok(majorOf('1.0.0-rc.4') > majorOf('0.45.2'))
  assert.ok(majorOf('3.0.0-next.29') > majorOf('2.110.8'))
})

test('memberClass excludes TypeScript synthetic well-known-symbol names', () => {
  // Regression: `__@iterator@456` and `__@unscopables@458` carry a per-compilation
  // symbol id, so the SAME member is spelled differently in each version and the
  // diff reports it as removed. On the first real run this fired on a frozen
  // string array that had not changed at all — a 100% false positive, and it
  // would have shipped as a "breaking change" in a paid report.
  assert.equal(memberClass('__@iterator@456'), 'synthetic')
  assert.equal(memberClass('__@unscopables@458'), 'synthetic')
  assert.equal(memberClass('_getSessionToken'), 'private')
  assert.equal(memberClass('functionsFetch'), 'public')
})

test('diffSurface reports removed, added and kept exports', () => {
  const before = surface('1.0.0', { '.': { a: sym(['function']), b: sym(['class']), c: sym(['type']) } })
  const after = surface('2.0.0', { '.': { a: sym(['function']), c: sym(['type']), d: sym(['function']) } })
  const d = diffSurface(before, after)

  assert.equal(d.totals.removed, 1)
  assert.equal(d.totals.added, 1)
  assert.equal(d.totals.kept, 2)
  assert.deepEqual(d.perEntry[0].removed.map((r) => r.symbol), ['b'])
  assert.deepEqual(d.perEntry[0].added, ['d'])
})

test('a removed entry point is reported separately, not folded into removed symbols', () => {
  // Severity differs in kind, not degree: the subpath stops resolving, so every
  // consumer of it breaks at IMPORT time, before a line of their code runs.
  // Merging these into the ordinary symbol count would hide the worst category.
  const before = surface('1.0.0', { '.': { a: sym(['function']) }, './gel-core': { x: sym(['class']), y: sym(['type']) } })
  const after = surface('2.0.0', { '.': { a: sym(['function']) } })
  const d = diffSurface(before, after)

  assert.deepEqual(d.removedEntryPoints, ['./gel-core'])
  const gone = d.perEntry.find((e) => e.subpath === './gel-core')
  assert.equal(gone.entryPointRemoved, true)
  assert.equal(gone.removed.length, 2)
})

test('an added entry point is not mistaken for a break', () => {
  const before = surface('1.0.0', { '.': { a: sym(['function']) } })
  const after = surface('2.0.0', { '.': { a: sym(['function']) }, './new': { z: sym(['function']) } })
  const d = diffSurface(before, after)

  assert.deepEqual(d.addedEntryPoints, ['./new'])
  assert.equal(d.totals.removed, 0)
})

test('member removals are split into public and private, and only public counts', () => {
  // Private-by-convention members are real removals but not breaking changes a
  // publisher owes anyone. They stay in the data so the claim is auditable and
  // stay out of the total so the number we sell is not inflated.
  const before = surface('1.0.0', {
    '.': { Client: sym(['class'], ['settings', 'from'], ['_getSessionToken']) },
  })
  const after = surface('2.0.0', { '.': { Client: sym(['class'], ['from'], []) } })
  const d = diffSurface(before, after)

  const change = d.perEntry[0].memberChanges[0]
  assert.deepEqual(change.removedMembers, ['settings'])
  assert.deepEqual(change.removedPrivateMembers, ['_getSessionToken'])
  assert.equal(d.totals.memberRemovals, 1)
})

test('a symbol losing only private members does not count as a member removal', () => {
  const before = surface('1.0.0', { '.': { Client: sym(['class'], ['from'], ['_secret']) } })
  const after = surface('2.0.0', { '.': { Client: sym(['class'], ['from'], []) } })
  const d = diffSurface(before, after)

  assert.equal(d.totals.memberRemovals, 0)
  assert.deepEqual(d.perEntry[0].memberChanges[0].removedMembers, [])
})

test('entryPoints reads the exports map and prefers the types condition', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'br-surface-'))
  await mkdir(join(dir, 'dist'), { recursive: true })
  await writeFile(join(dir, 'dist', 'index.d.ts'), 'export const a = 1')
  await writeFile(join(dir, 'dist', 'sub.d.ts'), 'export const b = 2')
  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'p',
      exports: {
        '.': { types: './dist/index.d.ts', import: './dist/index.js' },
        './sub': { types: './dist/sub.d.ts', import: './dist/sub.js' },
        './pattern/*': { types: './dist/*.d.ts' },
        './package.json': './package.json',
      },
    }),
  )

  const entries = await entryPoints(dir)
  assert.equal(entries.get('.'), './dist/index.d.ts')
  assert.equal(entries.get('./sub'), './dist/sub.d.ts')
  // Wildcard subpaths are not enumerable — including them would invent entry
  // points that no consumer can actually import by that name.
  assert.equal(entries.has('./pattern/*'), false)
})

test('entryPoints falls back to the types field when there is no exports map', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'br-surface-'))
  await writeFile(join(dir, 'index.d.ts'), 'export const a = 1')
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'p', main: './index.js', types: './index.d.ts' }))

  const entries = await entryPoints(dir)
  assert.equal(entries.get('.'), './index.d.ts')
})

test('symbolIndex flattens a surface to subpath -> set of names', () => {
  const s = surface('1.0.0', { '.': { a: sym(['function']) }, './x': { b: sym(['class']) } })
  const index = symbolIndex(s)
  assert.ok(index.get('.').has('a'))
  assert.ok(index.get('./x').has('b'))
  assert.equal(index.get('.').has('b'), false)
})

// ---------------------------------------------------------------------------
// Wildcard reachability. `entryPoints()` cannot enumerate a `./*` key, so every
// subpath behind one was invisible to the diff — described in the deliverable as
// a hole that "is not quantifiable", while the corpus on the other side of the
// cross named exactly which of those subpaths consumers import. These pin the
// matching rule and the file probe that turn it into a number.
// ---------------------------------------------------------------------------

test('X1: `./*` captures the whole subpath and probes the resolvable extensions', () => {
  const c = wildcardCandidates('./driver/postgres/Opts', ['./*'])
  assert.ok(c.includes('driver/postgres/Opts'))
  assert.ok(c.includes('driver/postgres/Opts.js'))
  assert.ok(c.includes('driver/postgres/Opts.d.ts'))
  assert.ok(c.includes('driver/postgres/Opts/index.js'))
})

test('X2: `./*.js` matches by suffix and converges on the same candidate', () => {
  // Both forms must reach `a/b.js`, or a consumer writing the explicit `.js`
  // specifier is scored differently from one writing the bare form.
  assert.ok(wildcardCandidates('./a/b.js', ['./*.js']).includes('a/b.js'))
  assert.ok(wildcardCandidates('./a/b', ['./*']).includes('a/b.js'))
})

test('X3: a non-matching prefix yields nothing — the pattern is not a wildcard for everything', () => {
  assert.deepEqual(wildcardCandidates('./other/x', ['./lib/*']), [])
  assert.deepEqual(wildcardCandidates('./a/b', []), [])
  // A key with no star is not a wildcard and must not match by accident.
  assert.deepEqual(wildcardCandidates('./a/b', ['./a/b']), [])
})

test('X4: reachability is decided by a file existing, in both directions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wild-'))
  await mkdir(join(root, 'driver', 'postgres'), { recursive: true })
  await writeFile(join(root, 'driver', 'postgres', 'Opts.d.ts'), 'export interface Opts {}')

  const reach = await wildcardReachability(root, ['./*'], ['./driver/postgres/Opts', './driver/postgres/Missing'])
  assert.equal(reach.get('./driver/postgres/Opts'), true)
  // The discriminating half: a probe that returned true for everything would
  // report zero breaks forever, which is the state this whole fix replaces.
  assert.equal(reach.get('./driver/postgres/Missing'), false)
})

test('X5: with no wildcard keys nothing is reachable, and that is not an error', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wild-'))
  await writeFile(join(root, 'a.js'), '')
  const reach = await wildcardReachability(root, [], ['./a'])
  assert.equal(reach.get('./a'), false)
})
