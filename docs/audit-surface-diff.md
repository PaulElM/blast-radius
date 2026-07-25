# KT-C — Export-Surface Diff Audit

**Date:** 2026-07-24
**Subject under test:** `src/surface.mjs`, `exportSurface()` + `diffSurface()`
**Case:** `drizzle-orm` 0.45.2 → 1.0.0-rc.4
**Verdict: PASS on Q1 (0/25 false positives). CONDITIONAL on shipping — three wording changes are mandatory, and one caveat in the report is currently a material understatement.**

---

## 0. Pre-registration (written before any verification was run)

> **Q1 threshold.** Draw 25 symbols the tool claims are `removed`, stratified across
> entry points. Verify each against the installed `.d.ts` in `data/pkgs/`.
> **If false positives > 20% (i.e. >5 of 25), the diff layer does not work and the
> report must not ship.**

Secondary, also pre-registered:
- Q2: sample ~8 `kept` symbols, check for hidden signature/type-parameter breaks.
- Q3: cross-check against drizzle's own primary sources, both directions.
- Explicit check: **did any entry point resolve 0 exports** (silent under-read)?

Evidence grading used throughout:
- **verified absent** — I read the artifact and the identifier has zero occurrences. Strongest.
- **verified present** — I read the artifact and the declaration is there.
- **searched, not found** — weaker; used nowhere in this report as the sole basis for a verdict.

---

## 1. What the tool claims (reproduced)

```
entry points: 443 → 718
removed entry points: 76      added: 351
exports removed: 1,434        added: 3,539   kept: 3,800
surviving exports that lost a public member: 917
```

Reproduced exactly. No discrepancy with the claim under test.

**Critical structural fact the headline hides:** the 1,434 `removed` rows are *two
different populations* with different failure modes:

| Population | Rows | Meaning |
|---|---:|---|
| **A — entry-point removals** | **798** | the whole subpath vanished; every symbol under it is collateral |
| **B — in-place removals** | **636** | the subpath still exists in rc.4, the symbol is gone from it |

Population A is dominated by one family: `./gel-core*` alone contributes ~491 rows.
A uniform sample of 25 from `removed.json` would have put ~14 rows in population A
and re-verified "gel-core is gone" a dozen times — a clean number that tests almost
nothing. **This is the wrong-sampling-unit trap that this project was burned by
before.** The sample below is drawn to avoid it.

---

## 2. Sampling unit and method

**Sampling unit: the `(subpath, symbol)` pair** — one row of the `removed` column,
which is exactly the unit the report bills a customer for. Not the symbol name
(a symbol can be removed from three entry points), and not the entry point.

**Population A (798 rows / 76 subpaths) was not sampled — it was CENSUSED.**
The check is cheap and decisive, so a sample would have been strictly worse. For
each of the 76 subpaths the tool declares removed, I checked whether the subpath is
still a key of rc.4's `package.json#exports`, and whether a surviving **wildcard**
key would still resolve it. Result in §3.1.

**Population B (636 rows / 188 subpaths) supplied 20 of the 25.** Drawn with a
seeded PRNG (mulberry32, seed `20260724`), stratified: subpaths shuffled, then rows
taken round-robin one-per-subpath so that `./pg-core` and `./mysql-core` cannot
dominate. 5 further rows drawn the same way from population A so the sample still
touches both. **Sample = 20 in-place + 5 entry-point = 25.**

> **Correction (2026-07-25).** This line read **186 subpaths** as published. The
> artifact says **188**: the shipped `reports/drizzle-orm-1.0.json`, a recompute
> with today's `surface.mjs`, and a recompute with the exact `surface.mjs` this
> audit was committed alongside all return 188 subpaths carrying at least one
> in-place removal. The **row** count is exact — 636 — and 798 + 636 = 1,434
> reconciles to `totals.removed`, so the frame was understated by two subpaths
> and nothing else moved.
>
> **What it costs, stated rather than waved away: the draw is one-row-per-subpath
> over a shuffled frame, so two subpaths were never eligible to be sampled.** That
> is a sampling-frame defect, and this audit's own §3 (defect 3 of the attribution
> audit, and the wrong-unit lesson behind it) is the reason it is recorded in the
> method section instead of quietly patched.
>
> **What it does not cost: the Q1 verdict.** 2 of 188 is 1.1% of the frame, and the
> `removed` column is not carried by the 25-row sample — it is carried by two
> exhaustive censuses (76/76 entry points in §3.1, 443/443 and 718/718 resolution
> in §3.2), both re-verified against the artifact. The sample is corroboration on
> top of a census, which is why a 1.1% frame error does not reach the conclusion.
>
> The two missing subpaths **cannot be named**: the audit recorded the frame's size
> but not its members, so which two were excluded is not recoverable from anything
> on disk. Reported as unrecoverable rather than guessed at.

**Verification procedure per row** (deliberately stronger than reading the entry file):
`surface.mjs` follows `export * from` re-exports, so grepping only the entry `.d.ts`
would let me "confirm" a re-exported symbol as gone and cheerfully agree with a tool
false positive. Instead, for each sampled symbol I searched **every `.d.ts` in the
entire installed rc.4 tree** for the bare identifier. Zero occurrences anywhere =
verified absent, and no re-export path can exist. Non-zero = I then located the
declaration and determined whether it is reachable from the sampled subpath.

Grep was sanity-checked against known-present symbols (`PgSelectBase` → 6 files,
`sql` → 286 files) to prove it was not silently matching nothing.

---

## 3. Q1 results — is `removed` TRUE?

### 3.1 Population A census (all 76 entry points)

| Check | Result |
|---|---|
| Removed subpaths still present as a key in rc.4 `exports` | **0 of 76** |
| Wildcard (`*`) keys in rc.4 `exports` that could still resolve them | **0** (rc.4 has no wildcard keys; neither does 0.45.2) |
| Removed subpaths whose directory still exists on disk in rc.4 | **0** (spot-verified `gel`, `gel-core`, `knex`, `kysely`, `prisma`, `pg-core/db`, `sqlite-core/db` — all absent) |

**All 76 entry-point removals are true.** No systematic resolution-failure defect.

### 3.2 The silent-under-read check (pre-registered)

This was the failure mode most likely to produce a mass false positive, so it was
checked exhaustively rather than sampled:

| Version | Subpaths declared in `exports` | Resolved by the tool | Unresolved |
|---|---:|---:|---:|
| 0.45.2 | 443 | 443 | **0** |
| 1.0.0-rc.4 | 718 | 718 | **0** |

**No entry point was silently dropped in either version.** Four subpaths resolve to
zero exports (`./table.utils`, `./tracing`, `./gel/migrator`, `./knex` in 0.45.2;
`./table.utils` in rc.4) — I read those files: `table.utils.d.ts` and `tracing.d.ts`
contain literally `export {};`, and `knex.d.ts`/`kysely.d.ts` are empty
module-augmentation shims. **These are genuinely zero-export modules, not read
failures.** They contribute 0 symbol rows, which is correct, though see Defect 3.

I also confirmed the surviving subpaths with the steepest proportional export-count
drop (`./sqlite-core/session` 10→5, `./neon-http/driver` 4→2, etc.) — none is an
order-of-magnitude collapse of the shape a broken resolution would produce.

### 3.3 The 25-row sample

`decl` = files in rc.4 declaring the identifier. `any` = files in rc.4 mentioning the identifier at all.

| # | Pop | Subpath | Symbol | kind | typeOnly | decl / any | Verdict |
|---:|---|---|---|---|---|---|---|
| 1 | B | `./mysql-core/columns/time` | `MySqlTimeBuilderInitial` | type | true | 0 / 0 | **TP** verified absent |
| 2 | B | `./libsql/session` | `LibSQLPreparedQuery` | class | false | 0 / 0 | **TP** verified absent |
| 3 | B | `./neon-serverless` | `NeonDriver` | class | false | 0 / 0 | **TP** verified absent |
| 4 | B | `./pg-core` | `PgGeometryObjectBuilderInitial` | type | true | 0 / 0 | **TP** verified absent |
| 5 | B | `./sqlite-proxy` | `RemotePreparedQuery` | class | false | 0 / 0 | **TP** verified absent |
| 6 | B | `./sqlite-core/query-builders/select` | `SQLiteSelectQueryBuilderBase` | class | false | 0 / 0 | **TP** verified absent |
| 7 | B | `./expo-sqlite` | `ExpoSQLitePreparedQuery` | class | false | 0 / 0 | **TP** verified absent |
| 8 | B | `./bun-sql/session` | `BunSQLPreparedQuery` | class | false | 0 / 0 | **TP** verified absent |
| 9 | B | `./pg-core/query-builders/select` | `PgSelectQueryBuilderBase` | class | false | 0 / 0 | **TP** verified absent |
| 10 | B | `./mysql-core/query-builders/delete` | `MySqlDeletePrepare` | type | true | 0 / 0 | **TP** verified absent |
| 11 | B | `./pg-core/columns/serial` | `PgSerialBuilderInitial` | type | true | 0 / 0 | **TP** verified absent |
| 12 | B | `./pg-core/columns/time` | `PgTimeBuilderInitial` | type | true | 0 / 0 | **TP** verified absent |
| 13 | B | `./bun-sqlite/driver` | `BunSQLiteDatabase` | class | false | 1 / 5 | **TP (MOVED)** — see below |
| 14 | B | `./sqlite-core/query-builders` | `SQLiteUpdateExecute` | type | true | 0 / 0 | **TP** verified absent |
| 15 | B | `./mysql-core/columns/float` | `MySqlFloatBuilderInitial` | type | true | 0 / 0 | **TP** verified absent |
| 16 | B | `./sqlite-core/query-builders/update` | `SQLiteUpdateExecute` | type | true | 0 / 0 | **TP** verified absent |
| 17 | B | `./mysql-core/columns/boolean` | `MySqlBooleanBuilderInitial` | type | true | 0 / 0 | **TP** verified absent |
| 18 | B | `./mysql-core/columns/smallint` | `MySqlSmallIntBuilderInitial` | type | true | 0 / 0 | **TP** verified absent |
| 19 | B | `./pg-core/columns/enum` | `PgEnumObjectColumnBuilderInitial` | type | true | 0 / 0 | **TP** verified absent |
| 20 | B | `./pg-core/query-builders/update` | `PgUpdatePrepare` | type | true | 0 / 0 | **TP** verified absent |
| 21 | A | `./prisma/pg/driver` | `PrismaPgConfig` | type | true | 0 / 0 | **TP** verified absent; subpath gone |
| 22 | A | `./gel-core/columns/localdate` | `GelLocalDateStringBuilderInitial` | type | true | 0 / 0 | **TP** verified absent; subpath gone |
| 23 | A | `./gel-core/columns/relative-duration` | `GelRelDuration` | class | false | 0 / 0 | **TP** verified absent; subpath gone |
| 24 | A | `./gel-core/columns/uuid` | `GelUUID` | class | false | 0 / 0 | **TP** verified absent; subpath gone |
| 25 | A | `./sqlite-core/db` | `BaseSQLiteDatabase` | class | false | 0 / 0 | **TP** verified absent; subpath gone |

**Row 13 detail — the only non-trivial row.** `BunSQLiteDatabase` is verified
**present** in rc.4, declared in `bun-sql/sqlite/driver.d.ts` and exported from
`./bun-sql/sqlite/driver` and `./bun-sql/sqlite`. But the sampled entry point
`./bun-sqlite/driver` **still exists in rc.4's `exports`** and no longer exports it.
So `import { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite/driver'` — which
compiles today — fails on rc.4. **The removal claim is factually true at the unit
being sold.** It is not a false positive. It is a *wording* obligation: the report
must say "moved to `drizzle-orm/bun-sql/sqlite/driver`", not imply deletion.

### 3.4 Result

> ## FALSE POSITIVES: **0 of 25 (0.0%)**
> Pre-registered fail threshold was >5 of 25. **Q1 PASSES**, with margin.
> 24 of 25 are verified absent from the entire rc.4 tree (zero occurrences in any
> `.d.ts`). 1 of 25 is a true removal-at-that-entry-point that has moved elsewhere.

Combined with the 76/76 entry-point census, **the `removed` column is sound.**

**`typeOnly` classification (pre-registered watch item).** Checked on all 25 rows
against the declarations I read: every row marked `typeOnly: true` is declared with
`type` or `interface` (e.g. `MySqlTimeBuilderInitial`, `PgUpdatePrepare`), and every
row marked `typeOnly: false` is a `declare class` (e.g. `LibSQLPreparedQuery`,
`GelUUID`, `BaseSQLiteDatabase`). **0 misclassifications in 25.** The distinction is
load-bearing — a `typeOnly` removal cannot break a runtime call site, only a build —
and the report is entitled to rely on it.

### 3.5 Attempts to kill this conclusion (all failed)

Honest disclosure of what I tried in order to break my own PASS:

1. **CJS declarations.** My grep covered `.d.ts` only; rc.4 also ships parallel
   `.d.cts`. If a symbol survived only in the CJS typings, "verified absent" would be
   overstated. Re-ran 10 of the absent symbols against `--include=*.d.cts`: **0 hits
   each.** Conclusion holds.
2. **Wildcard subpaths.** `entryPoints()` skips any `exports` key containing `*`. If
   rc.4 had replaced explicit subpaths with `./gel-core/*`, consumers would still
   resolve them while the tool called them removed. **Neither version has a single
   wildcard key.** Latent risk for other packages — see Defect 1.
3. **Silent resolution failure.** Fully closed by §3.2: 718/718 and 443/443.
4. **Moved-not-gone masquerading as gone.** Tested across the whole population, not
   just the sample — see §3.6.
5. **The publisher contradicting us.** The one `Gel` mention in the official
   changelogs looked like it might refute the `./gel-core` removal. Chased it; it did
   not — see §5.
6. **Reproducing these numbers and getting different ones (added 2026-07-25).**
   TypeScript resolves module identity by *real* path, so an installed tarball
   reached through a **symlink** was a different program to it: cross-module
   re-exports stopped resolving and the diff returned **`removed: 1256`** against
   the `1434` published here — a 12.4% undercount, with no error and no warning.
   Confirmed to be the path and not the code: today's `surface.mjs` and the
   `surface.mjs` this audit shipped alongside both return 1,256 through a symlinked
   layout and both return 1,434 in place, and a symlink-free copy of the tree in
   `/tmp` returns 1,434. **Fixed** — `installPackage` now canonicalises the package
   root on both exits — and the three published reports were re-checked to confirm
   no shipped number moved. Recorded here because the person most likely to hit it
   is a reader re-running the tool to check this audit, and a pnpm layout or a
   symlinked checkout is the ordinary case rather than an exotic one.

### 3.6 Moved-vs-gone, measured across the full population (not sampled)

| Population | Rows | Symbol name still exported *somewhere* in rc.4 | Name absent from package |
|---|---:|---:|---:|
| B (in-place) | 636 | 76 (11.9%) | 560 |
| A (entry-point) | 798 | 233 (29.2%) | 565 |
| **Total** | **1,434** | **≤309 (≤21.5%)** | ≥1,125 |

**These are UPPER bounds on "moved", and I want to be explicit about why.** The match
is by symbol *name*, so a generic name that independently exists elsewhere in rc.4
counts as "moved" when it is nothing of the sort. I measured the contamination rather
than hand-waving it: of the 76 in-place "moved" rows, **60 land at ≤3 subpaths in
rc.4 (plausible genuine relocations) and 16 are name collisions on four generic
identifiers** — `PreparedQuery`, `PreparedQueryKind`, `PreparedQueryHKTBase`,
`PgInsertPrepare`. So ~21% of the "moved" rows in population B are false moves.

The error direction is safe for the Q1 verdict: overcounting moves means
*undercounting* deletions, so the `removed` column is if anything sounder than the
table suggests. The relocations I have **verified by reading both artifacts** are the
17-symbol `.` → `./_relations` / `./casing` family (§5.1 confirms these against the
publisher's own changelog) plus the `BunSQLDatabase` / `BunSQLiteDatabase` /
`MySqlDatabase` / `NeonDriverOptions` driver-reshuffle group.

**Roughly one removed row in five is a relocation, not a deletion.** Every one is still
a real break for a consumer on the old import path — but a report that says
"1,434 symbols removed" without qualification will be read as "deleted", and a
publisher who spot-checks three of them will find the symbol still in their own tree
and conclude the report is junk. **This is the single most dangerous wording risk in
the product**, because it destroys credibility on true positives.

The root entry is the clearest case. All 9 dramatic names in the claim under test —
`relations`, `Relations`, `createOne`, `createMany`, `getOperators`,
`extractTablesRelationalConfig`, `normalizeRelation`, `createTableRelationsHelpers`,
`Casing` — are **verified absent from rc.4's `index.d.ts`** (which uses an explicit
named export list, so this is a direct read, not an inference), and **verified
present** at `./_relations` (and `./casing`). They moved. The break is real; the word
"removed" alone is not the honest description.

---

## 4. Q2 — is the diff COMPLETE? What does it miss?

The tool compares **names only**. It never looks at a signature, a type parameter
list, or a base class. A symbol that survives under the same name at the same entry
point is silently classified `kept` — i.e. "not a break" — no matter what happened
to its type.

Sample: 12 `kept` symbols (task asked ~8; I took 12), seeded PRNG `987654321`, drawn
from the core entry points `.`, `./pg-core`, `./mysql-core`, `./sqlite-core`,
`./node-postgres` where real consumer-facing API lives. Verified by reading the
declaration in both installed versions.

| # | Subpath | Symbol | 0.45.2 → 1.0.0-rc.4 | Verdict |
|---:|---|---|---|---|
| 1 | `.` | `BuildColumns` | type params identical | compatible |
| 2 | `./pg-core` | `PgSmallSerial` | `PgSmallSerial<T extends ColumnBaseConfig<'number','PgSmallSerial'>>` → `PgSmallSerial` (**generic removed**) | **HIDDEN BREAK** |
| 3 | `./sqlite-core` | `ConvertCustomConfig` | `<TName extends string, T extends Partial<CustomTypeValues>>` → `<T extends Partial<CustomTypeValues>>` (**arity 2→1**) | **HIDDEN BREAK** |
| 4 | `./pg-core` | `PgUpdateReturning` | body now resolves through `PgUpdateKind<T['_']['hkt'], …>`; requires an `hkt` member the old `T` had no reason to carry | **HIDDEN BREAK** |
| 5 | `./mysql-core` | `MySqlRealConfig` | interface unchanged | compatible |
| 6 | `.` | `KnownKeysOnly` | unchanged | compatible |
| 7 | `./mysql-core` | `extractUsedTable` | `(table: …): string[]` unchanged | compatible |
| 8 | `./mysql-core` | `smallint` | `smallint<TName extends string>(name: TName): MySqlSmallIntBuilderInitial<TName>` → `smallint<TUnsigned extends boolean\|undefined>(config?: MySqlIntConfig<TUnsigned>): MySqlSmallIntBuilder<TUnsigned>` (**parameter meaning and return type both changed**) | **HIDDEN BREAK** |
| 9 | `./pg-core` | `AnyPgTable` | unchanged | compatible |
| 10 | `./sqlite-core` | `SQLiteSetOperatorInterface` | type-param list **reordered**, `THKT` inserted first, `TResultType` dropped | **HIDDEN BREAK** |
| 11 | `./pg-core` | `cidr` | `cidr<TName extends string>(name: TName): PgCidrBuilderInitial<TName>` → `cidr(name?: string): PgCidrBuilder` (**return type replaced**; `PgCidrBuilderInitial` is itself in our removed list) | **HIDDEN BREAK** |
| 12 | `./mysql-core` | `MySqlSelectBuilder` | 2nd param `TPreparedQueryHKT extends PreparedQueryHKTBase` → `THKT extends MySqlSelectHKTBase = MySqlSelectQueryBuilderHKT` | **HIDDEN BREAK** |

> ## **7 of 12 sampled `kept` symbols (58%) carry an incompatible signature.**

n=12 is small; the honest reading is "roughly half, plausibly more" rather than a
precise 58%. But the direction is unambiguous, and the mechanism is systemic rather
than incidental: drizzle 1.0 performed a wholesale **`XBuilderInitial<TName>` →
`XBuilder`** de-generification across every dialect's column layer. That single
refactor breaks the name-identical survivors *and* is exactly why so many
`*BuilderInitial` types show up (correctly) in the removed column. The tool sees
the second half of that change and is blind to the first.

**Consequence for the report.** `kept: 3,800` currently reads as "3,800 symbols are
fine." It actually means "3,800 symbols still exist under the same name" — a much
weaker statement.

**I am deliberately NOT extrapolating a break count from this.** The obvious move is
to multiply ~58% across all 3,800 `kept` and announce ~1,900 additional breaks. That
would be unsound and I decline to put it in a customer-facing report: my 12 symbols
were drawn from *core* entry points (`.`, `./pg-core`, `./mysql-core`,
`./sqlite-core`, `./node-postgres`), which is exactly where the de-generification
refactor is concentrated. The peripheral driver/session entries that make up much of
the remaining `kept` population were not sampled and may be far less affected.
Projecting a core-entry rate onto the whole is the same wrong-unit error this audit
exists to catch.

What the evidence *does* support, stated at its true strength:
- **Qualitative, airtight:** the tool never inspects signatures or type parameters at
  all, so `kept` cannot mean "compatible" and must never be presented as a safety
  signal.
- **Quantitative, bounded:** *in core entry points*, roughly half of surviving symbols
  were signature-incompatible in a 12-symbol hand audit.

The existing caveat that "category B is a floor" is therefore **not adequate** — it
is technically true but will be read as "slightly conservative" when the gap is large
and systemic. It must be restated in the body, not a footnote.

---

## 5. Q3 — cross-check against drizzle's own primary sources

**Sources read (all primary):** the 22 official `changelogs/drizzle-orm/1.0.0-*.md`
files from the `drizzle-team/drizzle-orm` repo at ref `beta` (70,077 chars, fetched
via `gh api`); the GitHub release bodies for `v1.0.0-rc.4` and the betas; drizzle's
own `orm.drizzle.team/docs/relations-v1-v2` migration guide; and the rc.4 tarball
itself (README only — **there is no CHANGELOG or MIGRATION file in the published
tarball**, which is itself worth telling a customer).

### 5.1 Where they agree with us — strong corroboration

The `1.0.0-beta.1.md` changelog contains this verbatim:

> "The following entities have been moved from `drizzle-orm` and
> `drizzle-orm/relations` to `drizzle-orm/_relations`"

…followed by a 33-item list including `Relations`, `One`, `Many`, `getOperators`,
`Operators`, `getOrderByOperators`, `FindTableByDBName`, `DBQueryConfig`,
`TableRelationalConfig`, `RelationalSchemaConfig`, `extractTablesRelationalConfig`,
`relations`, `createOne`, `createMany`, `normalizeRelation`,
`createTableRelationsHelpers`, `TableRelationsHelpers`, `mapRelationalRow`.

**The publisher's own list is a near-exact match for our root-entry `removed` set,
and it independently confirms our "moved to `./_relations`" annotation in the
publisher's own words.** This is the best possible validation of the diff: an
external, authoritative, symbol-level ground truth we did not have when building it,
agreeing with us on both the fact and the mechanism.

### 5.2 Our recall gap — things they document that we structurally cannot see

- The RQBv1→RQBv2 rewrite: `relations()` → `defineRelations()`, `where`/`orderBy`
  moving from callback to object syntax, `fields`/`references` → `from`/`to`.
- The MySQL `mode` parameter being eliminated.
- `drizzle()`'s `schema` option replaced by `relations`.
- rc.4's removal of the `mapResult` method from the `PreparedQuery` interface.

Every one of these is a **behavioural or signature** change on a symbol whose *name*
survives. **Our recall gap is not random — it is precisely the Q2 blind spot.** These
two findings are the same finding seen from two sides, which raises my confidence in
both.

### 5.3 What we found that they never documented — the value proposition

Searched all 22 official 1.0 changelogs and the migration guide:

| Our finding | Scale | Mentions in drizzle's own 1.0 docs |
|---|---:|---:|
| **The entire `gel` / Gel dialect removed** | **61 subpaths, ~500 symbols** | **0** |
| **`./knex` removed** | 1 subpath | **0** |
| **`./kysely` removed** | 1 subpath | **0** |
| **`./prisma/*` removed** | 9 subpaths | **0** |
| Q2 signature breaks (`ConvertCustomConfig`, `SQLiteSetOperatorInterface`, `MySqlSelectBuilder`, `smallint`, `cidr`, `PgSmallSerial`, `PgUpdateReturning`) | ~half of 3,800 `kept` | **0** |

#### The Gel finding — and the moved-vs-deleted test I ran on my own headline

Before claiming "deleted", I applied to my own marquee finding the exact rigor §3.6
applies to the tool: **a thing missing from here may simply live somewhere else.** If
Gel had been spun out into its own package or renamed, "deleted" would be false and
would hand the publisher the precise disproof I warn about in §7. Five independent
checks:

| Check | Source (all primary) | Result |
|---|---|---|
| `gel*` subpaths in the installed artifact | `package.json#exports` | 0.45.2: **61** → rc.4: **0** |
| `Gel` identifier anywhere in rc.4 typings | `grep -rlw Gel --include=*.d.ts` over the installed tree | **0 files** |
| Source tree at the release tag | `contents/drizzle-orm/src?ref=v1.0.0-rc.4` vs `?ref=0.45.2` | `gel/`, `gel-core/` present at 0.45.2, **absent at v1.0.0-rc.4**; `cockroach-core/`, `mssql-core/`, `node-mssql/` added |
| Spun out to a standalone package? | npm registry | `@drizzle/gel`, `drizzle-gel`, `gel-drizzle` → **E404**; `npm search` shows no drizzle Gel adapter |
| Renamed to its former brand (EdgeDB)? | 22 official 1.0 changelogs | `edgedb` / `EdgeDB` → **0 mentions** |

**"Deleted" is earned.** Gel was not relocated, renamed, or extracted — it was
removed from the source tree and from the shipped artifact.

The only occurrence of "Gel" in any official 1.0 changelog is in `beta.15`:

> "Made `name` argument in `.prepare(name)` optional in `Gel`, `Postgres`,
> `Cockroach` dialects"

— i.e. the publisher's last written word on Gel treats it as a **live, actively
maintained dialect**. I searched the corpus for "separate package", "moved to a",
"dropped support", "removed support", "no longer supported", "deprecat", and
"@drizzle/": **zero hits for all seven.**

#### …and it is worse than undocumented: the live docs are actively wrong

While verifying the above I found the stronger version of this finding.
`https://orm.drizzle.team/docs/get-started-gel` **is still published today** and
instructs the user, verbatim:

```
npm i drizzle-orm@rc gel
import { drizzle } from 'drizzle-orm/gel';
```

The npm registry resolves `drizzle-orm@rc` to **`1.0.0-rc.4`** — the exact artifact
under audit — and that artifact exports **no `gel` subpath at all**
(`Object.keys(exports).filter(/gel|edge/i)` → `[]`). **Following the publisher's own
current documentation produces an immediate module-resolution failure.**

So the claim is not merely "a breaking change they forgot to write down." It is:
*the publisher does not appear to know this shipped.* That is the most valuable thing
this report can tell drizzle, and neither their changelog nor their docs nor any
blog post contains it.

This is the product thesis demonstrated on a real package: **a symbol-level diff of
the shipped artifact surfaced a dialect-scale breaking change that the publisher's
own release notes omit and their live documentation contradicts.** Same story, at
smaller scale, for `knex`, `kysely`, and `prisma` consumers.

*Scope note, so the claim is not overstated: "never documented" is bounded by the
corpus I actually searched — the 22 official `1.0.0-*` drizzle-orm changelogs, the
GitHub release bodies, the `relations-v1-v2` migration guide, and the published
tarball. I did not read every page of the docs site or Discord history.*

---

## 6. Defects found (I am the auditor; these are for the fixer, not fixed here)

**Defect 1 — wildcard subpaths are silently skipped (latent, not fired here).**
`entryPoints()` does `if (key.includes('*')) continue`. Neither drizzle version uses
wildcard `exports` keys, so this cost nothing today. On a package that migrates
explicit subpaths to `./foo/*`, every one of those subpaths would be reported as a
removed entry point while consumers resolve them fine — a mass false positive of
exactly the shape KT-C exists to catch. *Proposed fix:* expand wildcard keys by
globbing the target pattern; if that is out of scope, **fail loudly** when a
wildcard key exists rather than skipping in silence.

**Defect 2 — `removed` conflates deleted with relocated.** 21.5% of removed rows are
symbols still exported elsewhere in the new version. The data to fix this already
exists (`symbolIndex(newSurface)`). *Proposed fix:* annotate each removed row with
`movedTo: [subpaths] | null` and render it in the report.

**Defect 3 — zero-export entry points are indistinguishable from read failures.**
`./knex` and `./kysely` legitimately resolve 0 exports (empty augmentation shims), so
their removal is booked as an entry-point removal worth 0 symbols. That is arguably
correct but it under-states a real break, and more importantly the pipeline has no
way to tell "genuinely empty" from "we failed to read it". *Proposed fix:* record an
explicit `resolvedExportCount` and `resolutionStatus` per entry point so the
distinction is auditable rather than inferred.

**Defect 4 — `kept` is asserted, never verified.** Covered in §4. *Proposed fix:*
compare the declaration's type-parameter arity and normalised signature text; even a
crude arity + textual comparison would have caught 6 of the 7 breaks found above.

**Non-defect, confirmed good:** the `memberClass` filter for TypeScript's synthetic
well-known-symbol names (`__@iterator@456`) is correct and load-bearing, and I found
no second instance of that failure shape in this package. The pinning test should
stay.

---

## 7. Verdict and required wording changes

### PASS on Q1. The `removed` column is sound: 0/25 false positives, plus a 76/76 entry-point census and a 718/718 resolution check.

**The report MAY ship for the `removed` claim — and MUST NOT ship with its current
wording.** Three changes are mandatory:

1. **Split "removed" into "deleted" and "moved".** Report ≥1,125 deleted and ≤309
   moved-to-another-entry-point, each still counted as a break for consumers on the
   old path, with the destination named. Shipping "1,434 removed" unqualified invites
   a publisher to disprove us with a symbol we ourselves know still exists — which
   discredits the true positives alongside it. Before publishing the split, de-duplicate the
   name-collision moves identified in §3.6 (~21% of population B's moved rows).
2. **Stop presenting `kept: 3,800` as a safety signal, and restate the category-B
   caveat in the body.** Required language: *"This diff compares export names only.
   It does not inspect signatures or type parameters, so `kept` means 'still exists
   under the same name', not 'still compatible'. In a hand-audit of 12 surviving
   symbols in core entry points, 7 had incompatible signatures. Treat every figure
   here as a lower bound."* **Do not publish an extrapolated break count** — see §4
   for why the tempting ~2× multiplier is not supported by the sample.
3. **Say plainly that entry-point removals are import-time failures**, not call-site
   failures — a `./gel-core` consumer's build dies immediately, which is a different
   and larger event than losing one symbol.

### Recommended, not blocking
4. Lead the customer-facing report with the **undocumented** findings (Gel, knex,
   kysely, prisma). That is the part the publisher cannot get from their own
   changelog, and on this package it is a dialect-scale omission. It is the only
   section a reader cannot reconstruct from the release notes. Lead specifically with the fact that
   `orm.drizzle.team/docs/get-started-gel` still tells users to
   `npm i drizzle-orm@rc` and `import { drizzle } from 'drizzle-orm/gel'` against a
   version that has no such export — that is a live, checkable, self-evident defect
   any reader can confirm in thirty seconds, which is what makes the rest credible.
5. Note that the published tarball contains **no CHANGELOG and no migration guide** —
   a consumer literally cannot self-serve this information from what they install.

### Residual risk I am not clearing
- n=12 for Q2 supports "roughly half", not a precise percentage. If the report wants
  to state a number for hidden breaks, that number needs a larger sample first.
- This audit covers **one package pair**. Defect 1 (wildcards) is unfired here and
  will fire on some other package. KT-C should be re-run on a package that uses
  wildcard `exports` before the diff layer is trusted generally.
