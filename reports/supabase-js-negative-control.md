# Blast Radius Report — `@supabase/supabase-js` 2.110.8 → 3.0.0-next.29

> Prepared with **blast-radius** — a symbol-level usage census of the public repositories that consume `@supabase/supabase-js`.
> Corpus drawn 2026-07-24. Every number below is reproducible from the JSON companion to this file.

## The answer

**0 of the 146 public repositories we resolved import something that `3.0.0-next.29` no longer provides at the address they use it from.**

- 0 of them break at **runtime or import time**, not just in `tsc`.
- 0 entry points they import **stop resolving entirely** — those fail at import, before a line runs.
- 0 exports they call are gone from the entry point they import them from.
- 7 removed exports are used by **nobody** we found — that part of the break is free.

That zero is a finding, not an empty result. The same run resolved **146 repositories** and attributed **211 call sites** to `@supabase/supabase-js`, and `3.0.0-next.29` genuinely removes **7 exports** — the two sets simply do not intersect. The removals land entirely on surface nobody in the scanned corpus touches. Read it against the limits below: it is a statement about the corpus named here, not about your whole consumer base.

## Why your existing tools cannot tell you this

There are four rungs of visibility into who depends on you. Only the fourth answers the question a breaking change actually poses.

| Rung | Tells you | Cannot tell you |
|---|---|---|
| npm downloads | how many times a tarball moved | who, or whether the code is even run |
| dependents / "Used by" | who lists you in a manifest | which of your symbols they touch |
| grep across public code | who mentions your strings | whether `format` is yours or a local variable |
| **this report** | **who calls which of your exports, resolved through the type system** | — |

The third rung is where naive tooling stops, and it is not a small gap. In this corpus the resolver rejected identifiers that a text match would have counted: same-named locals, shadowed bindings, similarly-named packages, re-exports, and imports that are never used. Attribution here starts from an **import binding** and is resolved through the TypeScript language service — a hand-audit of 60 random attributions across two packages with opposite import idioms found **0 false positives**.

Precedent for taking this seriously: Rust runs `crater` across ~44,000 public crates before landing a breaking change, and Chrome will not remove a web API measured above ~0.03% usage. Both organisations built this capability in-house because it did not exist to buy.

## What changes between these two versions

Read from the **published npm artifacts** for `2.110.8` (published 2026-07-21) and `3.0.0-next.29` (published 2026-05-11) — not from a changelog, a roadmap, or the git tree. The tarball is what your consumers install.

| | count |
|---|---:|
| entry points in 2.110.8 | 3 |
| entry points in 3.0.0-next.29 | 3 |
| entry points **removed** | 0 |
| entry points added | 0 |
| exports **removed** | 7 |
| exports added | 0 |
| exports whose **name survives** | 242 |
| surviving exports that **lost a public member** | 2 |

> ⚠️ **"Name survives" is not "compatible."** This diff compares *export names*. It does not inspect signatures, type parameters, or runtime behaviour. A symbol can keep its name and still break every caller. In this tool's surface-diff audit, a hand-check of 12 surviving symbols drawn from `drizzle-orm`'s core entry points found **7 with incompatible signatures** — that audit was run against `drizzle-orm`, not against `@supabase/supabase-js`, so it measures **this method's blind spot** rather than anything about this release. It was deliberately drawn from where a refactor concentrates and is **not** extrapolated to the 242 above — the honest reading is that the true break count is materially higher than this report states, by an amount this method cannot measure.

Entry-point removals are the severest row in that table: when a subpath stops resolving, the consumer fails **at import time**, before a line of their code executes. No amount of call-site review on their side surfaces it in advance.

## What actually breaks, ranked by consumers affected

Three categories, kept apart because you triage them differently.

### A. Entry points that stop resolving — import-time breaks

The whole subpath is gone. These fail at import, before any of the consumer’s code runs, and no amount of call-site inspection on their side will find them in advance. Highest severity.

_No consumer in the scanned corpus is affected in this category._

### B. Removed exports that consumers actually use

The entry point still resolves; the symbol is gone. `type-only` rows break the build but not production — they are marked, not merged, because conflating them overstates the damage.

_No consumer in the scanned corpus is affected in this category._

### C. Removed members on exports that survive

The export is still there, so a changelog diff of export names misses these entirely. The narrowest category and the easiest to ship by accident.

_No consumer in the scanned corpus is affected in this category._

## The affected repositories, by name

_No repository in the scanned corpus is affected._

## Your most-used surface, for context

What consumers reach for most. Useful as a deprecation-order guide: the further down this list a symbol sits, the cheaper it is to remove.

| symbol | entry point | repos | call sites |
|---|---|---:|---:|
| `createClient` | `@supabase/supabase-js` | 111 | 121 |
| `SupabaseClient` | `@supabase/supabase-js` | 26 | 39 |
| `Session` | `@supabase/supabase-js` | 14 | 18 |
| `User` | `@supabase/supabase-js` | 13 | 16 |
| `PostgrestError` | `@supabase/supabase-js` | 3 | 5 |
| `AuthChangeEvent` | `@supabase/supabase-js` | 3 | 3 |
| `Provider` | `@supabase/supabase-js` | 2 | 2 |
| `FunctionsHttpError` | `@supabase/supabase-js` | 1 | 1 |
| `RealtimeChannel` | `@supabase/supabase-js` | 1 | 1 |
| `Factor` | `@supabase/supabase-js` | 1 | 1 |
| `PostgrestSingleResponse` | `@supabase/supabase-js` | 1 | 1 |
| `EmailOtpType` | `@supabase/supabase-js` | 1 | 1 |
| `AuthError` | `@supabase/supabase-js` | 1 | 1 |
| `Fetch` | `@supabase/supabase-js/dist/module/lib/types` | 1 | 1 |

## Method

1. **Export surface.** `@supabase/supabase-js@2.110.8` and `@3.0.0-next.29` are installed from npm with `--ignore-scripts` and their `.d.ts` declarations read through the TypeScript compiler, following re-exports across module and package boundaries. Entry points come from the manifest’s `exports` map, so each subpath is a surface of its own.
2. **Consumer discovery.** GitHub code search, 2 queries, open-prefix forms so subpath imports are not missed, partitioned by file size when a query saturates the 1000-result ceiling. 300 candidate files across 295 repositories.
3. **Attribution.** 150 files fetched at `HEAD` and parsed. Every symbol is resolved from its import binding through the TypeScript language service; text matching is never used.
4. **Canonicalisation.** Symbols are reconciled against the package’s own export surface, keyed by entry point. 0 attributions arriving through CJS default-interop were merged into their real symbol; 0 referenced a name the published surface does not export (see limits).
5. **Cross.** The census is intersected with the version diff to produce the three break categories above.

## Limits — read these before quoting any number

**Coverage: there is no reliable denominator, so this report contains no percentage.** GitHub code search reports a `total_count`, and it is not additive over partitions of the same corpus. Probed against `drizzle-orm` on 2026-07-24, minutes apart — this is a property of the search API, not of any one package:

| query | reported `total_count` |
|---|---:|
| `"drizzle-orm" language:typescript` | 3,916 |
| `"drizzle-orm" language:typescript size:0..100000` | 3,916 |
| `"drizzle-orm" language:typescript size:0..2000` | 7,756 |
| `"drizzle-orm" language:typescript size:2001..8000` | 61,168 |
| `"drizzle-orm" language:typescript size:2001..4000` | 5,228 |
| `"drizzle-orm" language:typescript size:4001..8000` | 4,548 |

The unpartitioned total and the `size:0..100000` total agree exactly, while narrower size bands report *more* files than the whole corpus — one band alone claims 61,168 against a stated total of 3,916. Any "% of your consumers" figure computed from these numbers would be fiction. What this report states instead is what it actually enumerated and resolved: a named corpus, and a named list of affected repositories inside it. **Treat every count as a floor.**

The queries behind *this* report, with the totals GitHub reported for each:

| query | reported `total_count` | files returned |
|---|---:|---:|
| `"from '@supabase/supabase-js" language:typescript` | 2,604 | 200 |
| `"from \"@supabase/supabase-js" language:typescript` | 2,564 | 100 |

Also true, and bounded:

- **150 candidate files were found but not opened.** This run fetched 150 of the 300 files search returned, in the order search returned them, and stopped there. The unopened remainder is not a random sample of the corpus, so the affected-repository list is a floor and the *absence* of a repository from it is not evidence that it is safe.
- **Public code only, TypeScript only.** Private repositories are invisible, and this run scanned `language:typescript`. Your JavaScript consumers, your enterprise customers, and anything behind a VPN are not in these numbers — all of them push the real figure up, none down.
- **`HEAD`, not a release tag.** Files are read at each repository’s default branch as of the corpus date. A consumer may have already migrated on a branch, or pinned an old version in production.
- **Member analysis is one level deep.** `Client.method` is resolved; `Client.method.option` is not. Signature and type-parameter changes are out of scope entirely — a symbol that survives with an incompatible signature is counted here as *unchanged*, so category B is a floor as well.
- **Single-file resolution.** A symbol re-exported through a consumer’s own barrel file and used elsewhere is attributed at the barrel, not at the ultimate use site. This undercounts affected files; it does not misattribute them.
- **Names the surface does not export.** 0 attributions reference an identifier absent from the published surface. Those are consumers reaching past the public API, or gaps in our surface extraction; either way they are excluded from the break counts rather than guessed at.
- **⚠️ Wildcard entry points are skipped, and this package declares 1: `./dist/*`.** A wildcard subpath cannot be enumerated from the manifest alone, so it is absent from the 3 entry points this report diffed. `@supabase/supabase-js` therefore exposes reachable import paths that were **never compared between the two versions**, and any break under one of them is invisible here. This is the largest single coverage hole in this report and it is not quantifiable from the manifest.

## Machine-readable

The JSON companion carries every affected repository, every call site with file and line, the full export diff, and the exact search queries used. Nothing in this document is a number you have to take on trust.

_Rendered by blast-radius report generation 2. The corpus draw date above is recorded provenance carried from the collector, not the time this file was written — re-rendering this run does not change it._
