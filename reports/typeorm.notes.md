### This major has ALREADY SHIPPED — which changes the sentence, not the method

Report #1 (`drizzle-orm` 0.45.2 → 1.0.0-rc.4) diffed a release that had not landed
yet. Its claim was *"the release you are staging will break these consumers."*

This one is different and the difference must not be blurred. `typeorm@1.0.0`
shipped on 2026-05-19 and `1.1.0` is the current `latest`. A repository that still
imports a removed symbol at HEAD today is therefore **not a consumer who is about
to be broken — it is a consumer still sitting on 0.3.x who has not migrated.**

That is a smaller claim in one direction and a larger one in another. It cannot
warn anybody in time. But it is *measured against reality rather than forecast*:
these repositories have had the new major available for months and are still on the
old API, so this is the publisher's **un-migrated tail**, enumerated by name and by
line. Nothing in the downloads graph distinguishes those repos from migrated ones.

### First, what 748 counts — it is 374 symbols, counted at two entry points

The summary table above reports **748 exports removed**. That row is a sum over
entry points, and this package has exactly two enumerable ones, so read it
carefully: **374 distinct symbols were removed, each of them from both `.` and
`./browser`.** The two sets are identical — measured, not assumed: 374 removed under
`.`, 374 under `./browser`, 374 shared, and **zero symbols removed from `./browser`
that were not also removed from the root.** `./browser` is a mirror of the root
entry point, not an additional population.

An earlier draft of this file wrote *"748 removed exports, 374 of them from the root
entry point."* Every word of that is true and the sentence still misleads, because
"374 of them" invites the reader to subtract and conclude that 374 *other* symbols
went somewhere else. None did. **The distinct-symbol count for this release is 374,
and that is the number the split below divides.**

⇒ The generated table is not wrong — summing per-entry-point removals is what that
row means — but a number whose label is defensible can still be read as a magnitude
it does not have. **A count needs its unit stated whenever the unit is not the one a
reader will assume**, and "exports" reads as "symbols" to everyone who is not
holding the schema.

**The same unit applies to the "used by nobody" line in "The answer," and there it
matters more.** That section reports **23** removed exports in use and **725** used
by nobody. Both are per-entry-point counts over the same 748. In distinct symbols:
**23 are used, all of them at the root, and 351 root symbols are used by nobody we
found.** The 725 is those 351 plus all 374 `./browser` mirrors, none of which any
consumer imports.

Read the practical sentence carefully, because this is the number a publisher would
act on: **351 of typeorm's root removals broke nobody in this corpus — not 725.**
The larger figure would overstate how much of the removal was free, and "free to
remove" is exactly the kind of reassurance a publisher acts on without re-deriving.
Both numbers remain floors: the corpus is bounded (see below), so "used by nobody
**we found**" is the honest phrasing and the report uses it.

### The root removals are TWO populations, and only one of them is typeorm's own API

Of those 374 root removals, publishing the total alone would be true and misleading,
so here is the split, computed rather than eyeballed:

| root-entry-point removals | count |
|---|---:|
| symbols re-exported from the **mongodb driver's** typings (`driver/mongodb/typings`) | **341** |
| **typeorm's own API** | **33** |

**Two rows in the breakage table above belong to this population and the table does
not say so.** `ObjectId` (2 repos) and `Timestamp` (5 repos) are marked
**"no — deleted"**, which is accurate about typeorm and misleading about the fix:
both still exist in the `mongodb` package, so those seven repositories have a
one-line import change, not a rewrite. Every *other* row in that table is a genuine
deletion with no drop-in source. **Triage those two rows last.**

The empirical result is also the vindication of splitting at all: of the 341 mongodb
symbols, **exactly those two are used by anyone in this corpus.** The 33 own-API
removals carry essentially the whole finding. Publishing 374 undivided would have
aimed the reader at 341 symbols that turned out to matter to seven repositories.

0.3.31's root carried `export * from "./driver/mongodb/typings"`; 1.1.0 does not.
So `ObjectId`, `Binary`, `BSONRegExp`, `AggregationCursor` and 337 siblings did stop
resolving from `typeorm` — **a consumer who wrote `import { ObjectId } from
'typeorm'` is genuinely broken** — but they were never typeorm's symbols to design.
They are a dependency's surface that leaked through a re-export and was withdrawn.
Anyone hit by these has a one-line fix: import them from `mongodb` instead.

**How the split is computed, and the one case where the obvious method is wrong.**
Membership in the mongodb typings module is decided by parsing that module's own
export symbols, not by name pattern. But membership by *name* misattributes any
symbol both sides happen to call the same thing, and there is exactly one:
**`ConnectionOptions`**. mongodb's typings declare an unrelated `ConnectionOptions`
interface, while typeorm's root exports its own on line 138 of `index.d.ts` —
`export { ConnectionOptions } from "./connection/ConnectionOptions"`. **An explicit
named re-export takes precedence over `export *`, so the symbol a consumer actually
resolved was typeorm's, and its removal is typeorm's break.** Counting it as
mongodb's would hand the reader the "just import it from `mongodb` instead" fix for
a symbol where that fix does not exist. A first pass of this file reported 342 / 32
by name membership alone; the corrected split is **341 / 33**, and the correction
moves a symbol *into* the finding rather than out of it.

**The 33 own-API removals are the finding.** They are the entire legacy global
connection API, and `globals.d.ts` makes the removal unambiguous:

- **0.3.31** exports `createConnection` (3 overloads), `createConnections`,
  `getConnection`, `getConnectionManager`, `getConnectionOptions`, `getManager`,
  `getMongoManager`, `getSqljsManager`, `getRepository`, `getTreeRepository`,
  `getCustomRepository`, `getMongoRepository`, `createQueryBuilder`.
- **1.1.0** exports exactly one symbol from that module: `getMetadataArgsStorage`.

Also gone: the `Connection` and `ConnectionManager` classes, the
`EntityRepository` / `AbstractRepository` custom-repository pair with its three
`CustomRepository*` error classes, and the `useContainer` / `getFromContainer` DI
hooks.

Checked for the innocent explanations before calling it a removal, because
"removed" and "moved" are not the same claim:

- **Not relocated.** No public entry point in 1.1.0 exports any of them. The string
  `createConnection` survives in 1.1.0 only as an internal method on
  `MysqlDriver` / `AuroraMysqlDriver`, which is not consumer-reachable as an import.
- **Not a rename.** The replacement (`DataSource`) already existed in 0.3.31 and is
  in the `kept` set, so this is a withdrawal of the old path, not a substitution.

### These were deprecated, and saying so makes the report MORE useful, not less

Every one of the removed globals carries an `@deprecated` JSDoc tag in 0.3.31.
TypeORM signposted this for the whole 0.3 line and then executed it in 1.0.

A report that hid that would be selling surprise it cannot deliver. What it can
deliver is the thing a deprecation notice never tells the publisher: **who ignored
it.** The count below is the number of public repositories that were told, had
months to act, and are still on the removed API — with the file and line for each.
That is the population a migration guide, a codemod, or a support budget gets aimed
at, and it is not visible in downloads, in the dependents graph, or in the
changelog.

### Corpus, not census — and the ceiling is in force here

`"from 'typeorm"` reports a `total_count` of 8,168 and the collector partitions by
file size when a query saturates the 1000-result ceiling. **The partitions saturate
too** (`size:0..1000` alone reports 4,456 and returns its 1,000). Partitioning
raised the frame; it did not clear the ceiling.

So every count here is a **floor over a corpus**, never a percentage of consumers.
Per the coverage probe shipped with this tool, `total_count` is not additive over
partitions of the same corpus, so no share-of-ecosystem figure may be computed from
these numbers, and none is printed.

**A hole that turned out to be self-inflicted and permanent — the cache had poisoned
itself, and no future run would ever have recovered.** The previous draft of this
file reported that `"from 'typeorm" language:typescript size:8001..16000` returned
**0 against a reported `total_count` of 5,867**, and diagnosed it as a third kind of
zero the instrument cannot classify: *"the query ran, the server reported thousands
of matches, and returned none of them."*

**That diagnosis was wrong, and it was wrong because nobody re-issued the query.**
Re-sending the identical URL live returns **HTTP 200 with 100 items** and the same
`total_count` of 5,867. Reading the stored entry explains the rest: disk held
`{"total_count": 5867, "items": []}`. So GitHub returned a **transient empty page
once**, the collector wrote that response to a permanent on-disk cache, and every
run since replayed the empty page without ever asking again.

This is worse than the hole it was mistaken for, in the one way that matters:
**it could not self-heal.** A flaky response is a bad minute; a flaky response
written to a cache with no expiry is a permanent, silent, inherited blind spot that
looks identical to a real measurement on every subsequent run. It had already
survived one full cycle being described as a property of the *search API*.

Fixed by evicting that single cache entry. The band immediately returned its full
1,000, and the candidate corpus went from **16,234 to 17,216 files** — so the query
table above shows this band populated, not zero.

⇒ **A cache entry is an assertion about the past, and citing it is citing a
measurement nobody re-took.** The tool already separates "found nothing" from "never
ran"; this is a third state it still does not model — *"ran once, failed silently,
and will never run again."* Not fixed in code here, deliberately: the standing
instruction is to state limits rather than grow the instrument, and an eviction is a
one-command remedy that is now written down. **Any cached zero must be re-issued
live before it is published as a finding.**

### Limits inherited from the instrument, unchanged and stated

The published audits (`docs/audit-attribution.md`, `docs/audit-surface-diff.md`)
carry the full list. The three that bear on this report specifically:

1. **Wildcard `exports` keys are not enumerable, and typeorm IS affected — this is
   the largest coverage hole in this report.** Both versions declare four `exports`
   keys: `.`, `./browser`, `./*.js` and `./*`. Only the two concrete ones are
   enumerable, and those are the 2 entry points diffed here. **`./*` means every
   internal path is a public subpath**, so a consumer importing
   `typeorm/browser/driver/...` or any other deep path is importing from a surface
   this diff never read.

   An earlier draft of this file asserted the opposite — "typeorm is not affected" —
   on the grounds that both versions resolved 2 entry points and 630 / 257 root
   exports, "a read, not a blank." **That reasoning is wrong and the correction is
   the point:** a non-empty read proves the parser ran, not that it saw the whole
   surface. Those are different claims, and conflating them converts a known hole
   into a false all-clear. Verified against the two published manifests directly.

   Consequence for the numbers below: the removal counts are a floor for a second,
   independent reason — not only is the corpus partial, the *surface* is partial too.
2. **`kept` is membership-only, never signature-checked.** A symbol that survived
   with an incompatible signature is counted as kept. Real breakage is therefore
   **at least** what is reported here.
3. **Binding resolution is single-file.** A symbol re-exported through a consumer's
   own local barrel file is not followed, which again undercounts.
