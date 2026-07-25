# KT-A — attribution precision audit (the pre-registered kill switch)

**Verdict: PASS. 0 false positives / 60, across two packages with deliberately
opposite import idioms. Kill threshold was > 20%.**

| package | idiom stressed | sample | false positives |
|---|---|---:|---:|
| `zod` | namespace-style member access (`z.string()`) | 30 / 30 repos | **0** |
| `date-fns` | bare named-export calls (`format(d)`, `parse(s)`, `add()`) | 30 / 30 repos | **0** |

The second run exists because the first proved less than it appeared to. zod is the
*friendliest* possible case for this technique: almost all usage is `z.method()`,
member access off one distinctive binding. The failure mode KT-A was written to
catch — *symbol attribution misfires in a dynamic language* — barely occurs there,
because nobody writes a bare `string()`. `date-fns` is the adversarial case: its
exports are ordinary English words (`format`, `parse`, `add`, `get`, `sub`) called
bare, which is exactly where a local variable of the same name collides.

**The single most informative hit in the whole audit** (`dfo-no/krb-webclient/src/i18n.ts:45`):

```ts
import { format as formatDate, formatRelative, formatDistance, isDate } from 'date-fns';
...
if (format === 'relative') ...            // `format` here is a LOCAL parameter
return formatDate(value, format, { locale });
```

One line containing both an aliased date-fns import of the export `format` **and**
an unrelated local variable literally named `format`. The tool attributed column 18
(`formatDate` → exported symbol `format`) and did **not** attribute the local
`format` at column 34. A text-matching implementation counts both. This is the case
the whole product rests on, and it is handled.

KT-A was pre-registered in the planning phase as the test that stops the project: *"hand-check
30 random hits. False-positive rate > 20% → the form doesn't work, stop."* It was
built and run before the report generator, the API-diff step, or any publishing
infrastructure — because a precision failure would have made all of those worthless.

## What was tested

- **`zod`** — 60 files from 300 candidates across 277 repos; 1,070 attributions,
  54 consuming repos. Sample 30, seed 7, stratified by repo (30 hits / 30 repos).
- **`date-fns`** — 60 files from 300 candidates across 290 repos; 154 attributions.
  Sample 30, seed 3, stratified by repo (30 hits / 30 repos). 29 named-import
  hits, 1 namespace.

Raw artifacts: `data/audits/{zod,date-fns}-kt-a.{md,json}`.
Both reproducible from the recorded seed.

## Method — and one correction made mid-audit

The first draw was a **flat** random sample over attributions. It pulled **13 of 30
hits from a single repo** (`ShritamGhosh/ExamPlaner`), because one large generated
file contributed ~400 attributions. So "30 checks" was really about 11.

That is the wrong axis to under-sample: attribution failures cluster by **import
style**, and import style is a property of the repo. The sampler was rewritten to
stratify by repo before the audit was scored. The recorded pass comes from the
stratified draw only.

Each of the 30 was judged against the question *"does this file really use this
symbol of this package?"* — and the tool's own labels were **not** trusted. The
underlying import statements were re-read from source for every questionable case.

## Findings

**0 false positives.** Seven cases were pulled for adversarial verification — **four
from the zod draw and three from the date-fns draw**, stated as two numbers because
that is how they were drawn:

| Checked | Tool claimed | Source says | Verdict |
|---|---|---|---|
| `obytes/…/env.ts` | `default` import | `import z from 'zod';` | correct |
| `victor-software-house/is-node-vulnerable/cli.ts` | namespace, symbol `parse` | `import * as z from 'zod';` + `z.parse(...)` | correct |
| `Phala-Network/phat-frame-gateway/bun.ts` | namespace, symbol `object` | `import * as z from 'zod'` | correct |
| `litosbla/prueba_carolina/auth.ts` | `z.object` | `z\n  .object({...})` across lines | correct |
| `dfo-no/krb-webclient/src/i18n.ts` | `format` | aliased import + same-named local on one line | correct (see above) |
| `jrmajor/jrmajor/src/gen.ts` | `differenceInDays` | `import * as d from 'date-fns'` | correct |
| `rafaLino/monthly-control/src/i18n.ts` | `es` | `import { es } from 'date-fns/locale'` | correct |

**Two negative controls passed that were not designed for.** The Phala file also
imports `zValidator` from `@hono/zod-validator`; it was correctly **not** attributed
to `zod`. And multi-line member chains (`z` on one line, `.object(` on the next)
resolved correctly rather than degrading to a bare `z`.

This is the result that matters: the risk KT-A existed to measure was *symbol
attribution in a dynamic language will misfire*. Binding resolution through the
language service, rather than text matching, is why it did not.

## Two defects found by the audit that were NOT false positives

**1. Granularity collapse — found and fixed.** With `import { z } from 'zod'`, the
first implementation attributed every use to the symbol `z`. The census read
"46 repos use `z`" — true, and worth nothing to a publisher asking which of *their*
symbols a change breaks. Member-path resolution was added; the census now reads:

| symbol | repos |
|---|---:|
| `z.string` | 46 |
| `z.object` | 35 |
| `z.infer` | 12 |
| `z.array` | 8 |
| `z.ZodError` | 6 |
| `z.coerce.number` | 3 |

The path deliberately stops at the first call — `.min(8)` in `z.string().min(8)` is
a method on the result, not an export of the package.

**2. Root fragmentation — found here, and CLOSED after this audit was written.**
`z.string` (named), `string` (namespace) and `default.string` (default) were the same
underlying symbol counted three times. True `string` usage across all roots is ~51
repos, not the 46 reported above. Canonicalising requires the package's own export
surface — pipeline step (e).

**3. Subpath flattening — found by the `date-fns` run, and CLOSED with it.**
`import { es } from 'date-fns/locale'` was counted in the same census as the
`date-fns` root. The attribution is *true* (`es` is a date-fns symbol) and the
`specifier` field did record `date-fns/locale`, but the rollup treated the root and
subpath export surfaces as one. For a publisher those are different surfaces — a
change to `date-fns/locale` does not necessarily affect root consumers. The census
must group by specifier, not just by symbol. Same family as defect 2.

> ### ⇒ STATUS OF DEFECTS 2 AND 3 AS SHIPPED TODAY: **BOTH CLOSED.**
> Step (e) exists and is wired. `src/surface.mjs` reads the real export surface from
> the published tarball; `src/census.mjs` (`canonicalize` / `canonicalCensus`)
> reconciles every attribution against it and keys the rollup **by entry point**,
> which is defect 3; `src/pipeline.mjs` passes the surface into the census on every
> run. Merging `default.x` into `x` happens **only** when the package publishes no
> default export — a per-package fact read from the artifact, never a hard-coded
> rule, which is why this is canonicalisation and not string normalisation.
>
> **So the sentence this section used to carry — *"until then every count is a lower
> bound and must be published as one"* — is retired, and retiring it is the point.**
> It was true when written and became false when step (e) shipped, and nothing
> connected the two. A limit that has stopped being true is not a conservative
> error: it is a false statement about the product that happens to read as honesty,
> which is exactly why it survived here while the `README.md` two directories up had
> already recorded both defects as closed. **A stated limit carries the same
> obligation to stay true as a headline number.**
>
> **The tables and counts above are deliberately NOT restated.** They are the
> pre-fix data the audit was actually scored on, and rewriting them would destroy
> the evidence for the 0/60 verdict in order to tidy a number. The `~51 vs 46`
> discrepancy above is the defect being described, not a live error in today's
> census.
>
> **Still true, and not closed by this:** counts remain a lower bound for a
> *different* and unrelated reason — the diff compares export **names** only, so a
> symbol that survives with an incompatible signature is not counted. That limit is
> live, is disclosed in every report, and is documented in `audit-surface-diff.md` §4.

## The methodological point — why one package was not enough

The zod run alone would have been written up as *"the product form is viable."*
That conclusion would have been drawn from the single friendliest instance of the
form, and the risk KT-A exists to retire — dynamic-language attribution misfiring —
is close to *absent* in zod's idiom. The claim was about the **form**; the evidence
covered one instance of it.

`date-fns` was chosen specifically because it inverts the idiom, and it produced the
strongest single piece of evidence in the audit (the `format`/`formatDate` collision
above). **Cost: one command, the harness already existed.**

⇒ **Transferable: when a test is meant to retire a risk, check that the sample
actually contains the risk.** A pre-registered threshold, a random sample and an
honest count can all be satisfied while the failure mode under test is not present
in the data. This is the same shape as the sampling-unit error in defect 3 above —
twice in one audit, the *frame* was the weak point, never the arithmetic.

## What this does NOT establish

- **Usefulness.** KT-A is a *precision* test — it measures the false-positive rate
  among the hits the tool found. It says nothing about recall, and nothing about
  whether the resulting census answers a question anyone needs answered.
- **Code search coverage bias.** The census covers what GitHub's code index
  returns; whether that index skews toward popular repositories is unmeasured.
  Every published report must disclose this rather than correct for it.
- **Cross-file resolution.** Bindings resolve within a single file. A symbol
  re-exported through a local barrel is not followed.

## Engineering note worth carrying forward

The first test run failed 6 of 14 in a way that only appeared **when more than one
file was scanned**: a shared virtual file path left stale language-service state, so
attributions silently returned the *previous* file's references. Spot-checking one
file at a time would never have surfaced it, and it would have corrupted every
multi-file census. Recorded because it is a general shape — *the bug that only
exists at N>1 is invisible to the N=1 check.*
