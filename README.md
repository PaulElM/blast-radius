# blast-radius

**You can see your downloads. You can't see your API.**

A library publisher shipping v2 — removing an export, dropping an entry point,
changing a default — has one honest answer to "who does this break?": post an RFC
and pray. This tool answers it from the public ecosystem: **who calls which of
your exports, resolved through the type system, and which of them your planned
release removes.**

## Reports

Read one before reading anything else. All three are produced by the tool in
this repo, from the published npm artifacts and public GitHub code.

| Report | Target | Result |
|---|---|---|
| [**`drizzle-orm` 0.45.2 → 1.0.0-rc.4**](reports/drizzle-orm-1.0.md) | a live, staged major | **277 of 2,786 resolved repositories break**, each named with a file and line |
| [**`typeorm` 0.3.31 → 1.1.0**](reports/typeorm-1.1.0.md) | a major that already shipped | **441 of 2,415 resolved repositories break**, 343 of them at runtime or import time |
| [`@supabase/supabase-js` 2.110.8 → 3.0.0-next.29](reports/supabase-js-negative-control.md) | a live major prerelease | **0 of 146** — 7 exports removed, nobody uses them |

The last one is the point of the first two. A tool that only ever reports damage
is indistinguishable from a tool that invents it; the negative control is what
makes the positive results mean something. All were run with the same command.

**The two positive reports answer different questions, and the difference is
worth knowing before you read either.** drizzle's release was still staged when
it was measured, so that report is a warning: *these are the consumers your
unshipped release will break.* typeorm v1 shipped on 2026-05-19, so that report
is a measurement: *these are the consumers who have not migrated yet* — the
publisher's un-migrated tail, enumerated by name and line. Every symbol it
counts also carried a `@deprecated` marker in 0.3.x, which is stated plainly in
the report because it changes what the number means.

Two things in the drizzle report that no changelog, download count or
dependents graph can show you:

- **`relations` is gone from the root entry point** — 231 repositories, 931
  call sites — surviving only at `drizzle-orm/_relations`.
- **[An entire dialect was removed and no changelog says so](reports/drizzle-orm.notes.md)**:
  61 `gel-core` entry points, and the publisher's own live documentation page
  still tells users to `import ... from 'drizzle-orm/gel'`.

And the one in the typeorm report, which is the same shape pointed at a
different question: the legacy global connection API — `createConnection` (146
repositories), `Connection` (117), `getRepository` (94), `ConnectionOptions`
(65), `getConnection` (58) — is gone from the root entry point, and for all but
seven of the affected repositories there is no other entry point to re-point
at, so the fix is a rewrite rather than an import change.

**[The notes on that report](reports/typeorm.notes.md) say which seven, and
why the headline is two populations rather than one** — most of the removed
surface is `mongodb` driver typings that typeorm used to re-export, which is a
real break but not typeorm's own design. `ObjectId` and `Timestamp` still exist
in the `mongodb` package, so those repositories have a one-line import change.
**The report also states what it does not cover**: 3,696 of 17,216 candidate
files were opened, so the affected-repository list is a floor, and the absence
of a repository from it is not evidence that it is safe.

## The four rungs

| Rung | Tells you | Cannot tell you |
|---|---|---|
| npm downloads | how many times a tarball moved | who, or whether the code runs |
| dependents / "Used by" | who lists you in a manifest | which of your symbols they touch |
| grep across public code | who mentions your strings | whether `format` is yours or a local |
| **blast-radius** | **who calls which export, resolved not matched** | — |

Precedent for the fourth rung mattering: Rust runs `crater` across ~44,000 public
crates before landing breakage, and Chrome will not remove a web API measured
above ~0.03% usage. Both built it in-house because it was not available to buy.

## Status

Two pre-registered breakers, both aimed at layers that could silently produce
confident nonsense.

| Breaker | Layer under test | Threshold | Result |
|---|---|---|---|
| **KT-A** | symbol attribution | >20% false positives → stop | **0 / 60** — [full audit](docs/audit-attribution.md) |
| **KT-C** | export-surface diff | >20% false positives → do not ship | **0 / 25**, plus a 76/76 entry-point census — [full audit](docs/audit-surface-diff.md) |

KT-A hand-checked 30 random attributions each across two packages with **opposite
import idioms** — `zod` (namespace-style `z.string()`) and `date-fns` (bare named
exports called as ordinary English words: `format`, `parse`, `add`). The second
package is what earns the conclusion: one audited file imports
`{ format as formatDate }` from date-fns *and* has an unrelated local named
`format` on the same line. The tool attributed the import and ignored the local.
A text-matching implementation counts both.

**KT-A is a precision test, and precision is not usefulness.** It cannot see a
wrong *count*, because every attribution behind a wrong count is individually
true. That is why the census layer has its own tests and the diff layer needed
its own breaker.

## Why this is not grep

Every attribution starts from an **import binding** and is resolved through the
TypeScript language service. Verified behaviour (`test/attribute.test.mjs`):

| Case | Handled |
|---|---|
| `import { z as v } from 'zod'` | attributed to exported `z`, not local `v` |
| `import * as zod from 'zod'` | member resolved: `zod.string()` → `string` |
| `import z from 'zod'` | rooted at `default`, then canonicalised (below) |
| `const { z } = require('zod')` | attributed |
| shadowed binding (`function f(z)`) | **not** attributed |
| `zod-validation-error`, `@hono/zod-validator`, `./zod` | **not** attributed |
| imported but never used | reported as unused, never as usage |
| `import type` / `{ type X }` | flagged type-only, kept out of runtime counts |
| `export { z }` re-export | excluded from the census |
| `z.string().min(8)` | `z.string` — chain stops at the call |
| `z.coerce.number()` | `z.coerce.number` — both levels kept |

## Pipeline

```
(a) code search for candidate consumers   src/github.mjs
(b) fetch each file (cached, resumable)   src/github.mjs
(c) resolve imports -> symbols            src/attribute.mjs
(d) census, canonicalised per entry point src/census.mjs
(e) public-API diff of the two versions   src/surface.mjs
(f) report: markdown + machine-readable   src/report.mjs
```

Steps (e) and (f) closed the two defects that made every
earlier count a lower bound:

- **Root fragmentation.** `z.string` (named), `string` (namespace) and
  `default.string` (default) were the same symbol counted three times.
  Canonicalisation is **not** string normalisation — merging `default.x` into `x`
  is only correct when the package publishes no default export, which is a
  per-package fact read from the artifact, never a rule hard-coded from whichever
  package we happened to look at first.
- **Subpath flattening.** `drizzle-orm/pg-core` was rolled into `drizzle-orm`.
  Those are different export surfaces to a publisher — and on the first real
  target, 76 whole entry points disappear in the next major, so flattening them
  would have hidden the largest category of break.

## The surface is read from the published tarball, not the repo

`npm install --ignore-scripts` on both versions, then read their `.d.ts` through
the TypeScript compiler, following re-exports across module *and package*
boundaries. The tarball is what consumers actually install; a repo tree can
export things the build strips and can sit on a commit nobody shipped.

## Usage

```
GITHUB_TOKEN=$(gh auth token) node bin/blast-radius.mjs report <package> \
  [--from latest] [--to next] [--languages typescript,javascript] \
  [--pages N] [--max-files N] [--max-queries N]
```

`--to` accepts a dist-tag. A `next` / `beta` / `rc` tag at a **higher major than
`latest`** is the trigger event this product sells against: the publisher has
already committed, in public, in a machine-readable place.

`--languages` takes a list, and every language given is searched — one
`language:` qualifier per query, all of them in one run. Whichever list you pass
is what the report's own limits section and its JSON `coverage.scope` will name;
neither is a fixed string. The three reports above were typescript-only runs.

Every API response is cached under `data/cache`, so re-runs cost zero requests and
an interrupted run resumes rather than restarting. Reports land in `reports/`.

## Measured constraints (verified live, not assumed)

- code search: **10 req/min**, **1000 results max per query**; core API 5000/hour
- `GET /repos/{o}/{r}/dependents` → **404, no such API** (no free substitute)
- **`total_count` is not a denominator.** It is not additive over partitions of
  the same corpus: `"drizzle-orm" language:typescript` reports 3,916 while the
  single band `size:2001..8000` reports 61,168. The unpartitioned total and
  `size:0..100000` agree exactly, so the bounded form is sane and narrow bands are
  not. **Consequence: no report may state a "% of your consumers" figure.**
  Absolute counts over a named, enumerated corpus only — which is what the buyer
  wanted anyway: a checklist, not a statistic.
- Searching by **open prefix** (`"from 'drizzle-orm"`, no closing quote) is
  required. The closed form cannot match `from 'drizzle-orm/pg-core'`, so on a
  package with 443 entry points the old query was structurally blind to every
  subpath import.

## Known limits — read before trusting a report

1. **Public code only.** Private repos, enterprise customers and anything behind
   a VPN are invisible. All of these push the real number **up**, never down —
   every count is a floor. **The three reports above scanned
   `language:typescript` only, and each one says so in its own limits section** —
   the language coverage is a property of the run, not of the tool: `--languages`
   takes a list and the collector searches each one.
2. **`HEAD`, not a release tag.** Consumers may have migrated on a branch, or
   pinned an old version in production.
3. **Signatures are out of scope.** A symbol that survives with an incompatible
   signature is counted as *unchanged*. Member analysis is **one level deep**.
4. **Single-file resolution.** A symbol re-exported through a consumer's own
   barrel is attributed at the barrel, not at the ultimate use site. This
   undercounts affected files; it does not misattribute them.
5. **Sampling-frame bias is disclosed, not corrected.** Whether GitHub's code
   index skews toward popular repos is unmeasured.

## Tests

```
npm install && node --test 'test/*.test.mjs'
```

## About the repositories named in these reports

The reports name public GitHub repositories and link the exact file and line
where a symbol is used. That is deliberate: a checklist a publisher can open and
check beats a statistic they have to trust. Everything cited is public code, read
through the public GitHub API, and linked back to its source.

Nothing here is a judgement about any of those repositories or their authors.
Using a symbol that a library later removes is not a mistake — being told before
the release lands rather than after is the entire point. If you maintain a
repository named in a report and would rather not be, open an issue and it will
be removed from the published artifacts.

Each report is a snapshot of `HEAD` on the date recorded in the file. A
repository may have migrated since, or may pin an older version in production,
and neither is visible here.
