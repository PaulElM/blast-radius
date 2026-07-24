import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attributeFile, census, specifierMatches } from '../src/attribute.mjs'

const run = (text, pkg = 'zod', path = 'src/a.ts') =>
  attributeFile({ repo: 'acme/app', path, ref: 'main', text }, pkg)

const symbols = (r) => r.attributions.map((a) => a.symbol).sort()

test('specifier matching accepts subpaths, rejects near-misses and relative paths', () => {
  assert.equal(specifierMatches('zod', 'zod'), true)
  assert.equal(specifierMatches('zod/v4', 'zod'), true)
  assert.equal(specifierMatches('zod-validation-error', 'zod'), false)
  assert.equal(specifierMatches('./zod', 'zod'), false)
  assert.equal(specifierMatches('myzod', 'zod'), false)
})

test('named import is attributed to the exported name, not the local alias', () => {
  const r = run(`import { z as v } from 'zod'\nconst s = v.string()\n`)
  assert.equal(r.attributions.length, 1)
  assert.equal(r.attributions[0].symbol, 'z.string')
  assert.equal(r.attributions[0].local, 'v')
})

test('namespace import resolves the property, not the namespace name', () => {
  const r = run(`import * as z from 'zod'\nconst a = z.string()\nconst b = z.number()\n`)
  assert.deepEqual(symbols(r), ['number', 'string'])
})

test('member path resolves to the symbol, not the bare binding', () => {
  // Without this the census reports "everyone uses z" — true and useless.
  const r = run(`import { z } from 'zod'\nconst a = z.string()\nconst b = z.object({})\n`)
  assert.deepEqual(symbols(r), ['z.object', 'z.string'])
})

test('member path stops at the call — chained methods are not package symbols', () => {
  // `.min` is a method on the ZodString *result*, not an export of zod.
  const r = run(`import { z } from 'zod'\nconst a = z.string().min(8).email()\n`)
  assert.deepEqual(symbols(r), ['z.string'])
})

test('nested namespace member keeps both levels', () => {
  const r = run(`import { z } from 'zod'\nconst a = z.coerce.number()\n`)
  assert.deepEqual(symbols(r), ['z.coerce.number'])
})

test('bare namespace reference is recorded as * rather than guessed', () => {
  const r = run(`import * as zod from 'zod'\nregister(zod)\n`)
  assert.deepEqual(symbols(r), ['*'])
})

test('shadowed identifier is NOT attributed', () => {
  // The single most important case: `z` inside the function is a parameter,
  // not the import. A grep counts this; binding resolution must not.
  const r = run(`
import { z } from 'zod'
export function f(z: any) {
  return z.string()
}
`)
  assert.equal(r.attributions.length, 0, 'shadowed local must not be attributed')
})

test('same-named import from a different package is NOT attributed', () => {
  const r = run(`import { z } from 'zod-validation-error'\nconst a = z.string()\n`)
  assert.equal(r.attributions.length, 0)
})

test('unused import is reported as unused, never as usage', () => {
  const r = run(`import { z } from 'zod'\nconst x = 1\n`)
  assert.equal(r.attributions.length, 0)
  assert.deepEqual(r.unusedImports.map((u) => u.exported), ['z'])
})

test('type-only import is flagged, not silently counted as a value use', () => {
  const r = run(`import type { ZodType } from 'zod'\nlet t: ZodType | null = null\n`)
  assert.equal(r.attributions.length, 1)
  assert.equal(r.attributions[0].typeOnly, true)
  assert.equal(r.attributions[0].usage, 'type')
})

test('inline type specifier is flagged type-only even in a value clause', () => {
  const r = run(`import { z, type ZodType } from 'zod'\nlet t: ZodType = z.string()\n`)
  const byName = Object.fromEntries(r.attributions.map((a) => [a.symbol, a]))
  assert.equal(byName.ZodType.typeOnly, true)
  assert.equal(byName['z.string'].typeOnly, false)
})

test('re-export is classified as reexport and excluded from the census', () => {
  const r = run(`import { z } from 'zod'\nexport { z }\n`)
  assert.equal(r.attributions[0].usage, 'reexport')
  assert.equal(census([r]).symbols.length, 0, 're-export is pass-through, not consumption')
})

test('CommonJS require is attributed', () => {
  const r = run(`const { z } = require('zod')\nconst s = z.string()\n`, 'zod', 'src/a.js')
  assert.equal(r.attributions.length, 1)
  assert.equal(r.attributions[0].symbol, 'z.string')
})

test('default import is rooted at "default"', () => {
  const r = run(`import zod from 'zod'\nconst s = zod.string()\n`)
  assert.equal(r.attributions[0].symbol, 'default.string')
})

test('every attribution carries hand-checkable provenance', () => {
  const r = run(`import { z } from 'zod'\n\nconst s = z.string()\n`)
  const a = r.attributions[0]
  assert.equal(a.repo, 'acme/app')
  assert.equal(a.path, 'src/a.ts')
  assert.equal(a.line, 3)
  assert.equal(a.snippet, 'const s = z.string()')
})

test('snippet spans a multi-line member chain so the symbol is visible', () => {
  const r = run(`import { z } from 'zod'\nconst c = z\n  .object({})\n`)
  assert.equal(r.attributions[0].symbol, 'z.object')
  assert.match(r.attributions[0].snippet, /\.object/)
})

test('tsx parses without error', () => {
  const r = run(`import { z } from 'zod'\nexport const C = () => <div>{z.string().parse('')}</div>\n`, 'zod', 'src/a.tsx')
  assert.equal(r.error, undefined)
  assert.ok(r.attributions.length >= 1)
})

test('census ranks by consuming repo count and dedupes repos', () => {
  const mk = (repo, symbol) => ({
    repo, path: 'a.ts', attributions: [{ repo, symbol, usage: 'call', typeOnly: false }],
  })
  const c = census([mk('a/1', 'string'), mk('b/2', 'string'), mk('a/1', 'lazy')])
  assert.equal(c.repoCount, 2)
  assert.equal(c.symbols[0].symbol, 'string')
  assert.equal(c.symbols[0].repos, 2)
})
