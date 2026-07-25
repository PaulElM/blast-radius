// Pipeline step (e) — the package's own public export surface, and the diff
// between two versions of it.
//
// This is the second load-bearing correctness surface in the product, and it is
// load-bearing in a different direction than attribution. Attribution answers
// "does this consumer really use symbol S". The surface answers "is S really one
// of the publisher's symbols, and does the new version still have it". A wrong
// surface corrupts the report's central claim — "N consumers break" — exactly as
// silently as a wrong attribution would, so it gets the same treatment: resolve
// it from the artifact, never from a name.
//
// Two decisions worth stating, because both were arrived at by being wrong first:
//
// 1. WE READ THE PUBLISHED ARTIFACT, NOT THE REPO. The npm tarball is what
//    consumers actually install. A repo's source tree can export things the build
//    strips, and can be on a commit nobody shipped.
//
// 2. WE INSTALL, RATHER THAN PARSE FILES IN ISOLATION. Real packages re-export
//    across module boundaries — `export * from './client'` and, worse,
//    `export * from '@supabase/auth-js'`. Parsing the entry .d.ts alone
//    under-reports the surface, which would make removed symbols look invented
//    and kept symbols look removed. This is the same single-file-resolution
//    defect the attribution layer still carries (README defect 4); here we can
//    afford to fix it, so we do. `npm install` resolves the semver ranges for us
//    — boring, and it is the same resolution the consumer gets.

import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { Project, Node } from 'ts-morph'

const execFileAsync = promisify(execFile)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PKGS = join(ROOT, 'data', 'pkgs')

/** Registry metadata for a package (dist-tags + versions). */
export async function fetchPackument(pkg) {
  const url = `https://registry.npmjs.org/${pkg.replace('/', '%2f')}`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`registry ${res.status} for ${pkg}`)
  return res.json()
}

/**
 * Resolve a dist-tag or exact version to an exact version.
 *
 * Dist-tags are the product's trigger detector: a `next` / `beta` / `rc` tag
 * whose version is a higher major than `latest` IS the dated event we sell
 * against. It is published fact, not a roadmap blog post someone has to believe.
 */
export function resolveVersion(packument, spec) {
  const tags = packument['dist-tags'] ?? {}
  if (tags[spec]) return tags[spec]
  if (packument.versions?.[spec]) return spec
  throw new Error(`no such version or dist-tag: ${spec}`)
}

/** Major version number of a semver string, prerelease included. */
export function majorOf(version) {
  return Number(String(version).split('.')[0])
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * Install `pkg@version` into an isolated directory and return the package root.
 * Cached by directory: a second call costs nothing.
 *
 * `--ignore-scripts` is not optional. We are installing arbitrary third-party
 * packages, including prereleases, purely to read their type declarations; there
 * is no reason to execute any of their lifecycle hooks.
 */
export async function installPackage(pkg, version, { onLog } = {}) {
  const slug = `${pkg.replace(/\W+/g, '-')}@${version}`
  const dir = join(PKGS, slug)
  const pkgRoot = join(dir, 'node_modules', pkg)

  if (await exists(join(pkgRoot, 'package.json'))) return pkgRoot

  onLog?.(`  installing ${pkg}@${version}`)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'surface-probe', private: true }))
  await execFileAsync(
    'npm',
    [
      'install',
      `${pkg}@${version}`,
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      '--loglevel=error',
    ],
    { cwd: dir, timeout: 300_000, maxBuffer: 32 * 1024 * 1024 },
  )

  if (!(await exists(join(pkgRoot, 'package.json')))) {
    throw new Error(`install produced no ${pkg} at ${pkgRoot}`)
  }
  return pkgRoot
}

/**
 * Enumerate the package's declared entry points as { subpath -> types file }.
 *
 * Subpaths are not cosmetic. `date-fns` and `date-fns/locale` are different
 * export surfaces to a publisher, and rolling them together is README defect 2b
 * — it makes a symbol look like it belongs to an entry point it does not. So the
 * surface is keyed by subpath from the start rather than flattened and regretted.
 */
export async function entryPoints(pkgRoot) {
  const manifest = JSON.parse(await readFile(join(pkgRoot, 'package.json'), 'utf8'))
  const out = new Map()

  const pickTypes = (value) => {
    if (typeof value === 'string') return value.endsWith('.d.ts') || value.endsWith('.d.mts') ? value : null
    if (!value || typeof value !== 'object') return null
    // Condition order matters: `types` first, then the runtime-flavoured ones.
    for (const key of ['types', 'typings', 'import', 'require', 'default', 'node', 'browser']) {
      if (key in value) {
        const hit = pickTypes(value[key])
        if (hit) return hit
      }
    }
    return null
  }

  if (manifest.exports && typeof manifest.exports === 'object') {
    for (const [key, value] of Object.entries(manifest.exports)) {
      if (key.includes('*')) continue // wildcard subpaths are not enumerable
      const types = pickTypes(value)
      if (types) out.set(key === '.' ? '.' : key, types)
    }
  }

  if (!out.size) {
    const fallback = manifest.types ?? manifest.typings
    if (fallback) out.set('.', fallback)
  }

  // `exports` may declare a subpath whose `types` condition is absent while a
  // sibling .d.ts exists next to the JS. Recover those rather than silently
  // dropping a whole entry point from the surface.
  if (manifest.exports && typeof manifest.exports === 'object') {
    for (const [key, value] of Object.entries(manifest.exports)) {
      if (key.includes('*') || out.has(key)) continue
      const js = typeof value === 'string' ? value : pickJs(value)
      if (!js) continue
      const guess = js.replace(/\.(m|c)?js$/, '.d.$1ts').replace('.d..ts', '.d.ts')
      if (await exists(join(pkgRoot, guess))) out.set(key, guess)
    }
  }

  return out
}

/**
 * Subpaths the manifest declares with a wildcard, e.g. `"./plugins/*"`.
 *
 * `entryPoints()` skips these because they cannot be enumerated from the
 * manifest alone, so every symbol reachable only through one is invisible to the
 * diff. That is a hole in coverage, and **a hole nobody counted reads exactly
 * like an absence of breakage** — the same failure shape as a search query that
 * returned zero because it never ran. So it is counted here and printed in the
 * deliverable, rather than described in the abstract and asserted away.
 */
export async function wildcardSubpaths(pkgRoot) {
  const manifest = JSON.parse(await readFile(join(pkgRoot, 'package.json'), 'utf8'))
  if (!manifest.exports || typeof manifest.exports !== 'object') return []
  return Object.keys(manifest.exports).filter((k) => k.includes('*')).sort()
}

/**
 * The files a wildcard-reachable subpath could resolve to, relative to the
 * package root. Pure, so the matching rule is testable without a filesystem.
 *
 * Deliberately NOT an implementation of Node's `exports` resolution algorithm.
 * It answers the narrower question the report actually needs: *is there a file
 * at this address*. That is what decides whether the consumer's import throws
 * `ERR_MODULE_NOT_FOUND`, and it is decidable from the installed tarball alone.
 * Reading each wildcard's target conditions instead would buy nothing here and
 * would be a new capability rather than a coverage fix.
 *
 * A key matches by prefix/suffix around its single `*`; the captured segment is
 * then probed with the extensions a TypeScript consumer resolves through. `./*`
 * captures `a/b` from `./a/b`, and `./*.js` captures `a/b` from `./a/b.js` — so
 * both forms converge on the same candidate set without inspecting targets.
 */
export function wildcardCandidates(subpath, wildcards) {
  const out = []
  for (const key of wildcards) {
    const star = key.indexOf('*')
    if (star === -1) continue
    const prefix = key.slice(0, star)
    const suffix = key.slice(star + 1)
    if (!subpath.startsWith(prefix)) continue
    if (suffix && !subpath.endsWith(suffix)) continue
    const cap = subpath.slice(prefix.length, suffix ? subpath.length - suffix.length : undefined)
    if (!cap) continue
    for (const ext of ['', '.js', '.mjs', '.d.ts', '/index.js', '/index.d.ts']) out.push(cap + ext)
  }
  return [...new Set(out)]
}

/**
 * Which of `subpaths` resolve to a real file in this installed package.
 *
 * Returns a Map rather than mutating anything, and the caller decides what an
 * absent entry means. Crossing two of these — one per version — is what turns
 * "wildcard paths are invisible to us" into a counted number, and the whole
 * point is that the count can be non-zero.
 */
export async function wildcardReachability(pkgRoot, wildcards, subpaths) {
  const reach = new Map()
  for (const subpath of subpaths) {
    let found = false
    for (const cand of wildcardCandidates(subpath, wildcards)) {
      if (await exists(join(pkgRoot, cand))) {
        found = true
        break
      }
    }
    reach.set(subpath, found)
  }
  return reach
}

function pickJs(value) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return null
  for (const key of ['import', 'require', 'default', 'node', 'browser']) {
    if (key in value) {
      const hit = pickJs(value[key])
      if (hit) return hit
    }
  }
  return null
}

/**
 * Is this property name a real, consumer-reachable member?
 *
 * Two exclusions, both found by running the diff rather than by reasoning about
 * it, and both of which produced fake "breaking changes" on the first run:
 *
 *  - `__@iterator@456` / `__@unscopables@458` — TypeScript's internal spelling
 *    of well-known symbols. The trailing number is a per-compilation symbol id,
 *    so the SAME member gets a different name in each version and every diff
 *    reports it as removed-and-added. It is pure noise and it is 100%
 *    false-positive: it fired on `SIGN_OUT_SCOPES`, a frozen string array that
 *    did not change at all.
 *  - `_leadingUnderscore` — private by convention. Real removals, but not
 *    breaking changes a publisher owes anyone; counting them inflates the number
 *    we are selling. They are kept in the data under `privateMembers` so the
 *    claim stays auditable, and excluded from the headline.
 */
export function memberClass(name) {
  if (/^__@/.test(name)) return 'synthetic'
  if (name.startsWith('_')) return 'private'
  return 'public'
}

/** Kind label for an exported declaration, used to explain a break to a human. */
function kindOf(decl) {
  if (Node.isFunctionDeclaration(decl)) return 'function'
  if (Node.isClassDeclaration(decl)) return 'class'
  if (Node.isInterfaceDeclaration(decl)) return 'interface'
  if (Node.isTypeAliasDeclaration(decl)) return 'type'
  if (Node.isEnumDeclaration(decl)) return 'enum'
  if (Node.isModuleDeclaration(decl)) return 'namespace'
  if (Node.isVariableDeclaration(decl)) return 'const'
  return 'other'
}

/** A type-only export cannot break a runtime call site — say so in the report. */
function isTypeOnlyKind(kinds) {
  return kinds.length > 0 && kinds.every((k) => k === 'interface' || k === 'type')
}

/**
 * The public export surface of one installed package version.
 *
 * Returns { pkg, version, entries: Map<subpath, Map<symbol, {kinds, members}>> }.
 *
 * `members` is ONE level deep, deliberately. The census produces member paths
 * (`z.coerce.number`, `SupabaseClient.auth`), so a purely top-level surface
 * could not classify them at all. Two levels would be a different and much
 * larger project; the depth limit is recorded in the report rather than hidden.
 */
export async function exportSurface(pkg, version, { onLog } = {}) {
  const pkgRoot = await installPackage(pkg, version, { onLog })
  const entries = await entryPoints(pkgRoot)
  const wildcards = await wildcardSubpaths(pkgRoot)

  const project = new Project({
    compilerOptions: {
      allowJs: true,
      declaration: true,
      target: 99,
      module: 99,
      moduleResolution: 100, // Bundler — honours the `exports` map, like consumers do
      skipLibCheck: true,
      strict: false,
      baseUrl: pkgRoot,
    },
  })

  const surface = new Map()

  for (const [subpath, typesFile] of entries) {
    const abs = resolve(pkgRoot, typesFile)
    if (!(await exists(abs))) continue

    let sourceFile
    try {
      sourceFile = project.addSourceFileAtPath(abs)
    } catch {
      continue
    }

    const symbols = new Map()
    let exported
    try {
      exported = sourceFile.getExportedDeclarations()
    } catch {
      continue
    }

    for (const [name, decls] of exported) {
      const kinds = [...new Set(decls.map(kindOf))]
      const members = new Set()

      for (const decl of decls) {
        if (Node.isModuleDeclaration(decl)) {
          for (const stmt of decl.getStatements?.() ?? []) {
            const n = stmt.getSymbol?.()?.getName?.()
            if (n) members.add(n)
          }
        }
        // A `const x: {...}` or a class: its properties are reachable as `x.y`
        // in consumer code, which is exactly the shape the census emits.
        if (Node.isVariableDeclaration(decl) || Node.isClassDeclaration(decl) || Node.isInterfaceDeclaration(decl)) {
          try {
            for (const prop of decl.getType().getProperties()) members.add(prop.getName())
          } catch {
            /* unresolvable type — the symbol still counts, its members do not */
          }
        }
      }

      const grouped = { public: [], private: [], synthetic: [] }
      for (const member of members) grouped[memberClass(member)].push(member)

      symbols.set(name, {
        kinds,
        typeOnly: isTypeOnlyKind(kinds),
        members: grouped.public.sort(),
        privateMembers: grouped.private.sort(),
      })
    }

    surface.set(subpath, symbols)
    onLog?.(`  ${pkg}@${version} ${subpath} -> ${symbols.size} exports`)
  }

  // `root` is carried so a later stage can ask whether a subpath the manifest
  // never declared still resolves to a file. Without it the wildcard hole can
  // only be described, never counted.
  return { pkg, version, entries: surface, wildcards, root: pkgRoot }
}

/**
 * Diff two surfaces of the same package.
 *
 * `removed` is the money column: an exported symbol present in the old version
 * and absent from the new one is a break for every consumer that uses it.
 *
 * `removedEntryPoints` is reported separately and NOT folded into `removed`,
 * because it is a categorically bigger event: the whole subpath stopped
 * resolving, so every symbol under it breaks at import time rather than at the
 * call site.
 */
export function diffSurface(oldSurface, newSurface) {
  const subpaths = new Set([...oldSurface.entries.keys(), ...newSurface.entries.keys()])
  const perEntry = []
  const removedEntryPoints = []
  const addedEntryPoints = []

  for (const subpath of [...subpaths].sort()) {
    const before = oldSurface.entries.get(subpath)
    const after = newSurface.entries.get(subpath)

    if (before && !after) {
      removedEntryPoints.push(subpath)
      perEntry.push({
        subpath,
        entryPointRemoved: true,
        removed: [...before.keys()].map((s) => ({ symbol: s, ...before.get(s) })),
        added: [],
        kept: [],
        memberChanges: [],
      })
      continue
    }
    if (!before && after) {
      addedEntryPoints.push(subpath)
      perEntry.push({
        subpath,
        entryPointAdded: true,
        removed: [],
        added: [...after.keys()],
        kept: [],
        memberChanges: [],
      })
      continue
    }

    const removed = []
    const kept = []
    const memberChanges = []
    for (const [name, info] of before) {
      if (!after.has(name)) {
        removed.push({ symbol: name, ...info })
        continue
      }
      kept.push(name)
      const next = after.get(name)
      const afterMembers = new Set(next.members)
      const afterPrivate = new Set(next.privateMembers ?? [])
      const goneMembers = info.members.filter((m) => !afterMembers.has(m))
      const gonePrivate = (info.privateMembers ?? []).filter((m) => !afterPrivate.has(m))
      // Only a public member removal is reported as a change. Private removals
      // ride along so the count stays auditable, but they never reach a headline.
      if (goneMembers.length || gonePrivate.length) {
        memberChanges.push({
          symbol: name,
          removedMembers: goneMembers,
          removedPrivateMembers: gonePrivate,
        })
      }
    }
    const added = [...after.keys()].filter((n) => !before.has(n))

    perEntry.push({ subpath, removed, added, kept, memberChanges })
  }

  return {
    from: `${oldSurface.pkg}@${oldSurface.version}`,
    to: `${newSurface.pkg}@${newSurface.version}`,
    removedEntryPoints,
    addedEntryPoints,
    perEntry,
    totals: {
      removed: perEntry.reduce((n, e) => n + e.removed.length, 0),
      added: perEntry.reduce((n, e) => n + e.added.length, 0),
      kept: perEntry.reduce((n, e) => n + e.kept.length, 0),
      memberRemovals: perEntry.reduce(
        (n, e) => n + e.memberChanges.filter((c) => c.removedMembers.length).length,
        0,
      ),
    },
  }
}

/** Flat lookup: subpath -> Set(symbol), for cross-referencing a census. */
export function symbolIndex(surface) {
  const index = new Map()
  for (const [subpath, symbols] of surface.entries) {
    index.set(subpath, new Set(symbols.keys()))
  }
  return index
}

export { PKGS as PACKAGE_CACHE_DIR }
