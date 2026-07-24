// Symbol attribution for a single source file.
//
// The whole product rests on this file being right. We are claiming "repo X uses
// symbol S of package P". A grep can't make that claim: `z.string()` says nothing
// about where `z` came from, and half the identifier names we care about (`parse`,
// `format`, `z`, `test`) are ordinary words that any file may bind locally.
//
// So every attribution here starts from an *import binding* and is resolved through
// the TypeScript language service. If a name is shadowed in an inner scope, the
// service does not return it, and we do not count it. That is the difference
// between this and a regex, and it is the thing KT-A measures.

import { Project, SyntaxKind, Node } from 'ts-morph'

let nextFileId = 0

// One project per process; source files are added and removed per call.
const project = new Project({
  useInMemoryFileSystem: true,
  compilerOptions: {
    allowJs: true,
    jsx: 2, // preserve — we only need bindings, never emit
    target: 99,
    module: 99,
    noResolve: true,
    skipLibCheck: true,
  },
})

/**
 * Does this module specifier refer to the target package?
 * Matches the bare name and subpath exports (`zod` -> `zod/v4`), never a
 * same-named relative import (`./zod`) and never a longer package
 * (`zod-validation-error`).
 */
export function specifierMatches(specifier, pkg) {
  if (specifier === pkg) return true
  return specifier.startsWith(pkg + '/')
}

/** Extract every local binding introduced by an import of `pkg`. */
function collectBindings(sourceFile, pkg) {
  const bindings = []

  for (const decl of sourceFile.getImportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue()
    if (!specifierMatches(specifier, pkg)) continue

    // `import type { X } from 'p'` — the whole clause is type-only.
    const declTypeOnly = decl.isTypeOnly()

    const def = decl.getDefaultImport()
    if (def) {
      bindings.push({
        local: def.getText(),
        exported: 'default',
        style: 'default',
        typeOnly: declTypeOnly,
        nameNode: def,
        specifier,
      })
    }

    const ns = decl.getNamespaceImport()
    if (ns) {
      bindings.push({
        local: ns.getText(),
        exported: null, // resolved per-reference from the property access
        style: 'namespace',
        typeOnly: declTypeOnly,
        nameNode: ns,
        specifier,
      })
    }

    for (const named of decl.getNamedImports()) {
      const alias = named.getAliasNode()
      bindings.push({
        local: (alias ?? named.getNameNode()).getText(),
        exported: named.getNameNode().getText(),
        style: 'named',
        // `import { type X }` is type-only even when the clause is not.
        typeOnly: declTypeOnly || named.isTypeOnly(),
        nameNode: alias ?? named.getNameNode(),
        specifier,
      })
    }
  }

  // CommonJS: `const { z } = require('zod')` / `const z = require('zod')`.
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getText() !== 'require') continue
    const [arg] = call.getArguments()
    if (!arg || !Node.isStringLiteral(arg)) continue
    if (!specifierMatches(arg.getLiteralValue(), pkg)) continue

    const varDecl = call.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)
    if (!varDecl) continue
    const nameNode = varDecl.getNameNode()

    if (Node.isIdentifier(nameNode)) {
      bindings.push({
        local: nameNode.getText(),
        exported: null,
        style: 'namespace', // `const z = require(p)` behaves like a namespace object
        typeOnly: false,
        nameNode,
        specifier: arg.getLiteralValue(),
      })
    } else if (Node.isObjectBindingPattern(nameNode)) {
      for (const el of nameNode.getElements()) {
        const prop = el.getPropertyNameNode()
        bindings.push({
          local: el.getNameNode().getText(),
          exported: (prop ?? el.getNameNode()).getText(),
          style: 'named',
          typeOnly: false,
          nameNode: el.getNameNode(),
          specifier: arg.getLiteralValue(),
        })
      }
    }
  }

  return bindings
}

/**
 * Walk a static property-access chain upward from a binding reference.
 *
 * `z.string()`        -> ['string']            (chain stops at the call)
 * `z.coerce.number()` -> ['coerce', 'number']
 * `z.ZodError`        -> ['ZodError']
 *
 * Without this the census collapses: with `import { z } from 'zod'` every single
 * use attributes to the symbol `z`, so the report says "46 repos use z" — true,
 * and worthless to a publisher asking which of *their* symbols a change breaks.
 * The chain naturally terminates at the first call expression, which is what we
 * want: `.min(8)` in `z.string().min(8)` is a method on the *result*, not a
 * symbol of the package.
 */
function memberPath(node) {
  const path = []
  let current = node
  for (;;) {
    const parent = current.getParent()
    if (parent && Node.isPropertyAccessExpression(parent) && parent.getExpression() === current) {
      path.push(parent.getNameNode().getText())
      current = parent
    } else if (parent && Node.isQualifiedName(parent) && parent.getLeft() === current) {
      path.push(parent.getRight().getText())
      current = parent
    } else {
      return { path, tip: current }
    }
  }
}

/** Is this node the declaration site rather than a use of it? */
function isDeclarationSite(node, binding) {
  return node === binding.nameNode || node.getStart() === binding.nameNode.getStart()
}

/**
 * Classify how a reference is used. `usage` distinguishes a real call/value/type
 * use from a re-export, which is NOT consumption and must not inflate the census.
 */
function classify(node) {
  const parent = node.getParent()
  if (!parent) return 'value'
  if (Node.isExportSpecifier(parent)) return 'reexport'
  if (Node.isCallExpression(parent) && parent.getExpression() === node) return 'call'
  if (Node.isNewExpression(parent) && parent.getExpression() === node) return 'construct'
  if (Node.isTypeReference(parent) || node.getFirstAncestorByKind(SyntaxKind.TypeReference)) {
    return 'type'
  }
  return 'value'
}

/**
 * Snippet spanning the binding reference through the end of its member path.
 *
 * A single-line snippet is misleading exactly where review matters most:
 * `const parsedCredentials = z\n  .object({...})` renders as `... = z`, which
 * shows the auditor no member at all. The audit is only as good as what the
 * auditor can see, so the snippet must cover the span the symbol was read from.
 */
function snippetFor(sourceFile, node, tip) {
  const lines = sourceFile.getFullText().split('\n')
  const startLine = sourceFile.getLineAndColumnAtPos(node.getStart()).line
  const endLine = sourceFile.getLineAndColumnAtPos((tip ?? node).getEnd()).line
  return lines
    .slice(startLine - 1, Math.min(endLine, startLine + 2))
    .map((l) => l.trim())
    .join(' ')
    .slice(0, 200)
}

/**
 * Attribute symbol usage of `pkg` in one file.
 *
 * Returns per-hit provenance (repo/path/line/snippet/binding) — not just a count.
 * A bare histogram cannot be hand-checked, and KT-A is a hand-check.
 */
export function attributeFile({ repo, path, ref, text }, pkg) {
  const ext = path.endsWith('.tsx') ? '.tsx'
    : path.endsWith('.jsx') ? '.jsx'
    : path.endsWith('.js') ? '.js'
    : '.ts'
  // Each file gets a unique virtual path. Reusing one path leaves stale
  // language-service state behind, which silently returns the *previous* file's
  // references — an attribution bug that only appears when scanning more than
  // one file, i.e. never in a single-file spot check and always in production.
  const virtualPath = `/scan/${nextFileId++}${ext}`

  let sourceFile
  try {
    sourceFile = project.createSourceFile(virtualPath, text, { overwrite: true })
  } catch (err) {
    return { repo, path, ref, imports: [], attributions: [], error: String(err) }
  }

  const bindings = collectBindings(sourceFile, pkg)
  const attributions = []
  const unused = []

  for (const binding of bindings) {
    let refs = []
    try {
      refs = binding.nameNode.findReferencesAsNodes()
    } catch {
      refs = []
    }

    let used = 0
    for (const node of refs) {
      if (isDeclarationSite(node, binding)) continue

      const { path: members, tip } = memberPath(node)

      // For a namespace import the local name is arbitrary (`zod`, `z`, `Z`),
      // so the module root contributes nothing and the first member IS the
      // symbol. For named/default imports the exported name is itself
      // meaningful and roots the path.
      const root = binding.style === 'namespace' ? [] : [binding.exported]
      const parts = [...root, ...members]
      // A bare reference to a namespace object (passed around as a value) is
      // recorded as `*` rather than guessed at.
      const symbol = parts.length ? parts.join('.') : '*'

      const usage = classify(tip === node ? node : tip)

      used++
      attributions.push({
        repo,
        path,
        ref,
        symbol,
        local: binding.local,
        style: binding.style,
        specifier: binding.specifier,
        typeOnly: binding.typeOnly,
        usage,
        line: sourceFile.getLineAndColumnAtPos(node.getStart()).line,
        column: sourceFile.getLineAndColumnAtPos(node.getStart()).column,
        snippet: snippetFor(sourceFile, node, tip),
      })
    }

    // Imported but never referenced. This is real information (dead import /
    // transitive dependency) but it is NOT usage. Counting it would be exactly
    // the kind of false positive KT-A exists to catch.
    if (used === 0) {
      unused.push({ local: binding.local, exported: binding.exported, style: binding.style })
    }
  }

  // Attributions hold only plain values by now, so the AST can go. Without this
  // a census over thousands of files retains every parsed file in memory.
  project.removeSourceFile(sourceFile)

  return {
    repo,
    path,
    ref,
    imports: bindings.map((b) => ({
      local: b.local,
      exported: b.exported,
      style: b.style,
      typeOnly: b.typeOnly,
      specifier: b.specifier,
    })),
    unusedImports: unused,
    attributions,
  }
}

/** Roll per-file attributions up into a symbol histogram. */
export function census(fileResults) {
  const symbols = new Map()
  const repos = new Set()

  for (const file of fileResults) {
    for (const a of file.attributions) {
      if (a.usage === 'reexport') continue // passing through, not consuming
      repos.add(a.repo)
      const entry = symbols.get(a.symbol) ?? { symbol: a.symbol, hits: 0, repos: new Set(), typeOnlyHits: 0 }
      entry.hits++
      if (a.typeOnly || a.usage === 'type') entry.typeOnlyHits++
      entry.repos.add(a.repo)
      symbols.set(a.symbol, entry)
    }
  }

  return {
    repoCount: repos.size,
    symbols: [...symbols.values()]
      .map((e) => ({ symbol: e.symbol, hits: e.hits, repos: e.repos.size, typeOnlyHits: e.typeOnlyHits }))
      .sort((a, b) => b.repos - a.repos || b.hits - a.hits),
  }
}
