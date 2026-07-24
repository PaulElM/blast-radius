# Blast Radius Report — `drizzle-orm` 0.45.2 → 1.0.0-rc.4

> Prepared with **blast-radius** — a symbol-level usage census of the public repositories that consume `drizzle-orm`.
> Corpus drawn 2026-07-24. Every number below is reproducible from the JSON companion to this file.

## The answer

**277 of the 2,786 public repositories we resolved import something that `1.0.0-rc.4` no longer provides at the address they use it from.**

- 243 of them break at **runtime or import time**, not just in `tsc`.
- 2 entry points they import **stop resolving entirely** — those fail at import, before a line runs.
- 28 exports they call are gone from the entry point they import them from.
- 1,404 removed exports are used by **nobody** we found — that part of the break is free.

Of those 28 exports, **17 appear nowhere in `1.0.0-rc.4`** — those are deletions and the consumer needs a rewrite. The other **11 still exist under the same name at a different entry point**, so those are likely moves or renames and the fix is a re-point. Same-name matching is a signal, not proof: a package can export the same name from two places meaning two different things, so each is marked "verify" rather than asserted.

Every affected repository is named below, with the file and line. This is a checklist, not an estimate.

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

Read from the **published npm artifacts** for `0.45.2` (published 2026-03-27) and `1.0.0-rc.4` (published 2026-06-27) — not from a changelog, a roadmap, or the git tree. The tarball is what your consumers install.

| | count |
|---|---:|
| entry points in 0.45.2 | 443 |
| entry points in 1.0.0-rc.4 | 718 |
| entry points **removed** | 76 |
| entry points added | 351 |
| exports **removed** | 1,434 |
| exports added | 3,539 |
| exports whose **name survives** | 3,800 |
| surviving exports that **lost a public member** | 917 |

> ⚠️ **"Name survives" is not "compatible."** This diff compares *export names*. It does not inspect signatures, type parameters, or runtime behaviour. A symbol can keep its name and still break every caller. In a hand-audit of 12 surviving symbols drawn from this package's core entry points, **7 had incompatible signatures**. That sample was deliberately drawn from where the refactor concentrates and is **not** extrapolated to the 3,800 above — the honest reading is that the true break count is materially higher than this report states, by an amount this method cannot measure.

Entry-point removals are the severest row in that table: when a subpath stops resolving, the consumer fails **at import time**, before a line of their code executes. No amount of call-site review on their side surfaces it in advance.

## What actually breaks, ranked by consumers affected

Three categories, kept apart because you triage them differently.

### A. Entry points that stop resolving — import-time breaks

The whole subpath is gone. These fail at import, before any of the consumer’s code runs, and no amount of call-site inspection on their side will find them in advance. Highest severity.

| entry point | repos affected | symbols they import from it | of those, still exported somewhere |
|---|---:|---:|---:|
| `drizzle-orm/sqlite-core/db` | 1 | 1 | 0 / 1 |
| `drizzle-orm/pg-core/db` | 1 | 1 | 0 / 1 |

### B. Removed exports that consumers actually use

The entry point still resolves; the symbol is gone. `type-only` rows break the build but not production — they are marked, not merged, because conflating them overstates the damage.

| symbol | from | kind | repos | call sites | still exported elsewhere? |
|---|---|---|---:|---:|---|
| `relations` | `drizzle-orm` | function | 231 | 931 | same name in `drizzle-orm/_relations` — likely move/rename, verify |
| `BaseSQLiteDatabase` | `drizzle-orm/sqlite-core` | class | 8 | 9 | **no — deleted** |
| `BunSQLiteDatabase` | `drizzle-orm/bun-sqlite` | class _(type-only)_ | 7 | 10 | same name in `drizzle-orm/bun-sql/sqlite/driver` +1 — likely move/rename, verify |
| `PgTransaction` | `drizzle-orm/pg-core` | class _(type-only)_ | 6 | 20 | **no — deleted** |
| `PgDatabase` | `drizzle-orm/pg-core` | class | 6 | 10 | **no — deleted** |
| `relations` | `drizzle-orm/relations` | function | 4 | 24 | same name in `drizzle-orm/_relations` — likely move/rename, verify |
| `extractTablesRelationalConfig` | `drizzle-orm/relations` | function | 4 | 4 | same name in `drizzle-orm/_relations` — likely move/rename, verify |
| `RelationalSchemaConfig` | `drizzle-orm/relations` | interface _(type-only)_ | 3 | 6 | same name in `drizzle-orm/_relations` — likely move/rename, verify |
| `createTableRelationsHelpers` | `drizzle-orm/relations` | function | 3 | 3 | same name in `drizzle-orm/_relations` — likely move/rename, verify |
| `CasingCache` | `drizzle-orm/casing` | class | 3 | 4 | **no — deleted** |
| `QueryTypingsValue` | `drizzle-orm` | type _(type-only)_ | 2 | 5 | **no — deleted** |
| `PgArray` | `drizzle-orm/pg-core` | class _(type-only)_ | 2 | 2 | **no — deleted** |
| `SQLiteTransaction` | `drizzle-orm/sqlite-core` | class _(type-only)_ | 2 | 2 | **no — deleted** |
| `MySqlDatabase` | `drizzle-orm/mysql-core` | class | 2 | 7 | same name in `drizzle-orm/mysql2/driver` +1 — likely move/rename, verify |
| `Casing` | `drizzle-orm/utils` | type _(type-only)_ | 2 | 3 | same name in `drizzle-orm/casing` — likely move/rename, verify |
| `QueryWithTypings` | `drizzle-orm/sql/sql` | interface _(type-only)_ | 2 | 2 | **no — deleted** |
| `Relations` | `drizzle-orm` | class _(type-only)_ | 1 | 5 | same name in `drizzle-orm/_relations` — likely move/rename, verify |
| `Casing` | `drizzle-orm` | type _(type-only)_ | 1 | 1 | same name in `drizzle-orm/casing` — likely move/rename, verify |
| `QueryWithTypings` | `drizzle-orm` | interface _(type-only)_ | 1 | 1 | **no — deleted** |
| `AnyPgSelect` | `drizzle-orm/pg-core` | type _(type-only)_ | 1 | 2 | **no — deleted** |
| `SQLiteColumnBuilderBase` | `drizzle-orm/sqlite-core` | interface _(type-only)_ | 1 | 1 | **no — deleted** |
| `AnyMySqlSelect` | `drizzle-orm/mysql-core` | type _(type-only)_ | 1 | 2 | **no — deleted** |
| `MySqlTransaction` | `drizzle-orm/mysql-core` | class _(type-only)_ | 1 | 1 | **no — deleted** |
| `MySql2PreparedQuery` | `drizzle-orm/mysql2` | class _(type-only)_ | 1 | 6 | **no — deleted** |
| `MySql2PreparedQueryHKT` | `drizzle-orm/mysql2` | interface _(type-only)_ | 1 | 1 | **no — deleted** |
| `getOperators` | `drizzle-orm/relations` | function | 1 | 1 | same name in `drizzle-orm/_relations` — likely move/rename, verify |
| `QueryTypingsValue` | `drizzle-orm/sql/sql` | type _(type-only)_ | 1 | 1 | **no — deleted** |
| `SQLiteAsyncDialect` | `drizzle-orm/sqlite-core/dialect` | class | 1 | 1 | **no — deleted** |

### C. Removed members on exports that survive

The export is still there, so a changelog diff of export names misses these entirely. The narrowest category and the easiest to ship by accident.

_No consumer in the scanned corpus is affected in this category._

## The affected repositories, by name

All 277 are in the JSON companion, each with every break we found in it. The first 60 are listed here, with one file and line per repository so each row can be opened and checked.

> Read at each repository’s default branch on 2026-07-24. A row means *this code, as written today, imports something `1.0.0-rc.4` does not provide at that address* — it does not mean the project is broken, unmaintained, or has failed to act: they may pin an older version, may have migrated on another branch, and rows marked *verify* above are same-name matches rather than proven deletions. Check the line before acting on it.

- [`0xnyn/cruso`](https://github.com/0xnyn/cruso) — `relations (./relations)` at [`db/schema/exchange.ts:57`](https://github.com/0xnyn/cruso/blob/HEAD/db/schema/exchange.ts#L57)
- [`0xnyn/subsignal`](https://github.com/0xnyn/subsignal) — `relations (.)` at [`db/schema/relations.ts:10`](https://github.com/0xnyn/subsignal/blob/HEAD/db/schema/relations.ts#L10)
- [`2witstudios/PageSpace`](https://github.com/2witstudios/PageSpace) — `relations (.)` at [`packages/db/src/schema/credits.ts:126`](https://github.com/2witstudios/PageSpace/blob/HEAD/packages/db/src/schema/credits.ts#L126)
- [`AI-LLM-Bootcamp/from-saas-starter-to-crud`](https://github.com/AI-LLM-Bootcamp/from-saas-starter-to-crud) — `relations (.)` at [`lib/db/schema.ts:86`](https://github.com/AI-LLM-Bootcamp/from-saas-starter-to-crud/blob/HEAD/lib/db/schema.ts#L86)
- [`Ablasko32/Project-Shard`](https://github.com/Ablasko32/Project-Shard) — `relations (.)` at [`db/schema.ts:65`](https://github.com/Ablasko32/Project-Shard/blob/HEAD/db/schema.ts#L65)
- [`Adithya1617/automatic-funicular`](https://github.com/Adithya1617/automatic-funicular) — `BaseSQLiteDatabase (./sqlite-core)` at [`main/db/client.ts:19`](https://github.com/Adithya1617/automatic-funicular/blob/HEAD/main/db/client.ts#L19) _(type-only — their build breaks, their runtime does not)_
- [`Aksenod/Promtdesign`](https://github.com/Aksenod/Promtdesign) — `relations (.)` at [`packages/db/src/schema/domain/deployment.ts:36`](https://github.com/Aksenod/Promtdesign/blob/HEAD/packages/db/src/schema/domain/deployment.ts#L36)
- [`Artmann/code-monkey`](https://github.com/Artmann/code-monkey) — `BaseSQLiteDatabase (./sqlite-core)` at [`src/main/codex/provider-settings.ts:16`](https://github.com/Artmann/code-monkey/blob/HEAD/src/main/codex/provider-settings.ts#L16) _(type-only — their build breaks, their runtime does not)_
- [`AshutoshDM1/XContext`](https://github.com/AshutoshDM1/XContext) — `relations (.)` at [`apps/backend/src/db/schema.ts:38`](https://github.com/AshutoshDM1/XContext/blob/HEAD/apps/backend/src/db/schema.ts#L38)
- [`Atiwari330/ehrclone2`](https://github.com/Atiwari330/ehrclone2) — `relations (.)` at [`lib/db/schema/ai-audit.ts:126`](https://github.com/Atiwari330/ehrclone2/blob/HEAD/lib/db/schema/ai-audit.ts#L126)
- [`BEKI77/telegram-mini-app-to-manage-class-group-schedule`](https://github.com/BEKI77/telegram-mini-app-to-manage-class-group-schedule) — `relations (.)` at [`src/db/schema.ts:91`](https://github.com/BEKI77/telegram-mini-app-to-manage-class-group-schedule/blob/HEAD/src/db/schema.ts#L91)
- [`BabylonSocial/babylon`](https://github.com/BabylonSocial/babylon) — `relations (.)` at [`packages/db/src/schema/admin.ts:107`](https://github.com/BabylonSocial/babylon/blob/HEAD/packages/db/src/schema/admin.ts#L107)
- [`BambooXLotus/deren-parity`](https://github.com/BambooXLotus/deren-parity) — `relations (.)` at [`src/drizzle/schema.ts:41`](https://github.com/BambooXLotus/deren-parity/blob/HEAD/src/drizzle/schema.ts#L41)
- [`Barbapapazes/orion`](https://github.com/Barbapapazes/orion) — `relations (.)` at [`server/database/schema.ts:36`](https://github.com/Barbapapazes/orion/blob/HEAD/server/database/schema.ts#L36)
- [`BernardoQuina/queeker`](https://github.com/BernardoQuina/queeker) — `relations (.)` at [`src/db/schema.ts:26`](https://github.com/BernardoQuina/queeker/blob/HEAD/src/db/schema.ts#L26)
- [`Better-Tables/better-tables`](https://github.com/Better-Tables/better-tables) — `relations (.)` at [`packages/adapters/drizzle/examples/basic-usage.ts:56`](https://github.com/Better-Tables/better-tables/blob/HEAD/packages/adapters/drizzle/examples/basic-usage.ts#L56)
- [`Blue-Dots-Economy/aggregator-dpg`](https://github.com/Blue-Dots-Economy/aggregator-dpg) — `PgDatabase (./pg-core)` at [`packages/participants-writer/src/postgres.ts:33`](https://github.com/Blue-Dots-Economy/aggregator-dpg/blob/HEAD/packages/participants-writer/src/postgres.ts#L33) _(type-only — their build breaks, their runtime does not)_
- [`CREUP-DEV/web`](https://github.com/CREUP-DEV/web) — `relations (.)` at [`server/db/schema/auth.ts:107`](https://github.com/CREUP-DEV/web/blob/HEAD/server/db/schema/auth.ts#L107)
- [`ChainFundIt/chainfunditnew`](https://github.com/ChainFundIt/chainfunditnew) — `relations (.)` at [`lib/schema/charities.ts:126`](https://github.com/ChainFundIt/chainfunditnew/blob/HEAD/lib/schema/charities.ts#L126)
- [`Chiraagrah/DuoLingo`](https://github.com/Chiraagrah/DuoLingo) — `relations (.)` at [`db/schema.ts:12`](https://github.com/Chiraagrah/DuoLingo/blob/HEAD/db/schema.ts#L12)
- [`ComfyTavern/comfytavern`](https://github.com/ComfyTavern/comfytavern) — `BunSQLiteDatabase (./bun-sqlite)` at [`apps/backend/src/services/ApiConfigService.ts:12`](https://github.com/ComfyTavern/comfytavern/blob/HEAD/apps/backend/src/services/ApiConfigService.ts#L12) _(type-only — their build breaks, their runtime does not)_
- [`Cremacious/beehive-books`](https://github.com/Cremacious/beehive-books) — `relations (.)` at [`db/schema/social.ts:103`](https://github.com/Cremacious/beehive-books/blob/HEAD/db/schema/social.ts#L103)
- [`Daddyjohn63/crm-app-v2.1`](https://github.com/Daddyjohn63/crm-app-v2.1) — `relations (.)` at [`src/db/schema/projects.ts:62`](https://github.com/Daddyjohn63/crm-app-v2.1/blob/HEAD/src/db/schema/projects.ts#L62)
- [`Davie521/subshare`](https://github.com/Davie521/subshare) — `PgDatabase (./pg-core)` at [`src/lib/db-operations.ts:9`](https://github.com/Davie521/subshare/blob/HEAD/src/lib/db-operations.ts#L9) _(type-only — their build breaks, their runtime does not)_
- [`Deadlock-too/portfolio`](https://github.com/Deadlock-too/portfolio) — `relations (.)` at [`src/data/schema.ts:111`](https://github.com/Deadlock-too/portfolio/blob/HEAD/src/data/schema.ts#L111)
- [`Deivisan/PsyConnect`](https://github.com/Deivisan/PsyConnect) — `relations (.)` at [`legacy/lib/db/schema.ts:227`](https://github.com/Deivisan/PsyConnect/blob/HEAD/legacy/lib/db/schema.ts#L227)
- [`DevLoversTeam/devlovers.net`](https://github.com/DevLoversTeam/devlovers.net) — `relations (.)` at [`frontend/db/schema/blog.ts:144`](https://github.com/DevLoversTeam/devlovers.net/blob/HEAD/frontend/db/schema/blog.ts#L144)
- [`DoniLite/DoniLite`](https://github.com/DoniLite/DoniLite) — `relations (.)` at [`db/schema/article.schema.ts:125`](https://github.com/DoniLite/DoniLite/blob/HEAD/db/schema/article.schema.ts#L125)
- [`Dpehect/AnimafestExperience-Web-Application-Nux-next-saas`](https://github.com/Dpehect/AnimafestExperience-Web-Application-Nux-next-saas) — `relations (.)` at [`backend/src/db/schema.ts:52`](https://github.com/Dpehect/AnimafestExperience-Web-Application-Nux-next-saas/blob/HEAD/backend/src/db/schema.ts#L52)
- [`EgorVadik/Nekoyomi-app`](https://github.com/EgorVadik/Nekoyomi-app) — `relations (.)` at [`db/schema.ts:117`](https://github.com/EgorVadik/Nekoyomi-app/blob/HEAD/db/schema.ts#L117)
- [`ErcouldnT/futbol.erkut.dev`](https://github.com/ErcouldnT/futbol.erkut.dev) — `relations (.)` at [`src/lib/db/schema.ts:68`](https://github.com/ErcouldnT/futbol.erkut.dev/blob/HEAD/src/lib/db/schema.ts#L68)
- [`FilOzone/early-repair`](https://github.com/FilOzone/early-repair) — `relations (.)` at [`packages/repair-cli/src/local-schema.ts:77`](https://github.com/FilOzone/early-repair/blob/HEAD/packages/repair-cli/src/local-schema.ts#L77)
- [`FloB95/qrcodly`](https://github.com/FloB95/qrcodly) — `relations (.)` at [`packages/db/src/tables/qr-code.ts:40`](https://github.com/FloB95/qrcodly/blob/HEAD/packages/db/src/tables/qr-code.ts#L40)
- [`Fx64b/learn`](https://github.com/Fx64b/learn) — `relations (./relations)` at [`db/migrations/relations.ts:13`](https://github.com/Fx64b/learn/blob/HEAD/db/migrations/relations.ts#L13)
- [`Garblesnarff/ai-adventure-scribe-main`](https://github.com/Garblesnarff/ai-adventure-scribe-main) — `relations (.)` at [`db/schema/scenes.ts:97`](https://github.com/Garblesnarff/ai-adventure-scribe-main/blob/HEAD/db/schema/scenes.ts#L97)
- [`GauravKarakoti/BrainBytes`](https://github.com/GauravKarakoti/BrainBytes) — `relations (.)` at [`db/schema/quests.ts:45`](https://github.com/GauravKarakoti/BrainBytes/blob/HEAD/db/schema/quests.ts#L45)
- [`GuptaShubham-11/StoreBox`](https://github.com/GuptaShubham-11/StoreBox) — `relations (.)` at [`lib/db/schema.ts:32`](https://github.com/GuptaShubham-11/StoreBox/blob/HEAD/lib/db/schema.ts#L32)
- [`Handfish/drizzle-effect`](https://github.com/Handfish/drizzle-effect) — `PgArray (./pg-core)` at [`drizzle-valibot/src/column.ts:97`](https://github.com/Handfish/drizzle-effect/blob/HEAD/drizzle-valibot/src/column.ts#L97) _(type-only — their build breaks, their runtime does not)_
- [`Hayzedid/Mode-app`](https://github.com/Hayzedid/Mode-app) — `relations (.)` at [`db/schema.ts:34`](https://github.com/Hayzedid/Mode-app/blob/HEAD/db/schema.ts#L34)
- [`Houmeecl/notarypro`](https://github.com/Houmeecl/notarypro) — `relations (.)` at [`shared/schema-updates.ts:44`](https://github.com/Houmeecl/notarypro/blob/HEAD/shared/schema-updates.ts#L44)
- [`HouseOfBetterAuth/nuxt-better-auth-saas`](https://github.com/HouseOfBetterAuth/nuxt-better-auth-saas) — `relations (.)` at [`server/db/schema/auth.ts:178`](https://github.com/HouseOfBetterAuth/nuxt-better-auth-saas/blob/HEAD/server/db/schema/auth.ts#L178)
- [`HuuThongg/TKSocial`](https://github.com/HuuThongg/TKSocial) — `relations (.)` at [`db/a.ts:152`](https://github.com/HuuThongg/TKSocial/blob/HEAD/db/a.ts#L152)
- [`IbrahimDoba/QuillStash`](https://github.com/IbrahimDoba/QuillStash) — `relations (.)` at [`src/db/schema.ts:39`](https://github.com/IbrahimDoba/QuillStash/blob/HEAD/src/db/schema.ts#L39)
- [`Jason-Wang1245/grocery-app`](https://github.com/Jason-Wang1245/grocery-app) — `relations (.)` at [`db/schema.ts:36`](https://github.com/Jason-Wang1245/grocery-app/blob/HEAD/db/schema.ts#L36)
- [`JavascriptMick/supanuxt-saas-drizzle`](https://github.com/JavascriptMick/supanuxt-saas-drizzle) — `relations (.)` at [`drizzle/schema.ts:19`](https://github.com/JavascriptMick/supanuxt-saas-drizzle/blob/HEAD/drizzle/schema.ts#L19)
- [`Jeetch8/multi-vendor-furniture-ecommerce-app`](https://github.com/Jeetch8/multi-vendor-furniture-ecommerce-app) — `relations (.)` at [`src/lib/schema/product.schema.ts:47`](https://github.com/Jeetch8/multi-vendor-furniture-ecommerce-app/blob/HEAD/src/lib/schema/product.schema.ts#L47)
- [`Jhay1413/travana-backend`](https://github.com/Jhay1413/travana-backend) — `relations (.)` at [`src/schema/transactions-schema.ts:55`](https://github.com/Jhay1413/travana-backend/blob/HEAD/src/schema/transactions-schema.ts#L55)
- [`JonasMerxbauer/chat`](https://github.com/JonasMerxbauer/chat) — `relations (.)` at [`src/db/schema.ts:32`](https://github.com/JonasMerxbauer/chat/blob/HEAD/src/db/schema.ts#L32)
- [`Kamleshpaul/nextjs-role-and-permission`](https://github.com/Kamleshpaul/nextjs-role-and-permission) — `relations (.)` at [`server/database/index.ts:64`](https://github.com/Kamleshpaul/nextjs-role-and-permission/blob/HEAD/server/database/index.ts#L64)
- [`L-Mario564/drizzle-dbml-generator`](https://github.com/L-Mario564/drizzle-dbml-generator) — `CasingCache (./casing)` at [`src/generators/mysql.ts:16`](https://github.com/L-Mario564/drizzle-dbml-generator/blob/HEAD/src/generators/mysql.ts#L16)
- [`LemonTV-win/LemonTV`](https://github.com/LemonTV-win/LemonTV) — `relations (.)` at [`src/lib/server/db/schemas/game/player.ts:53`](https://github.com/LemonTV-win/LemonTV/blob/HEAD/src/lib/server/db/schemas/game/player.ts#L53)
- [`LoV432/next-openwrt-stats`](https://github.com/LoV432/next-openwrt-stats) — `relations (./relations)` at [`drizzle/schema/schema.ts:53`](https://github.com/LoV432/next-openwrt-stats/blob/HEAD/drizzle/schema/schema.ts#L53)
- [`LombokApp/lombok-web`](https://github.com/LombokApp/lombok-web) — `relations (.)` at [`packages/api/src/notification/entities/notification-delivery.entity.ts:65`](https://github.com/LombokApp/lombok-web/blob/HEAD/packages/api/src/notification/entities/notification-delivery.entity.ts#L65)
- [`LukaPatarcic/taskly`](https://github.com/LukaPatarcic/taskly) — `relations (.)` at [`api/src/db/schema.ts:34`](https://github.com/LukaPatarcic/taskly/blob/HEAD/api/src/db/schema.ts#L34)
- [`MGrin/scani-oss`](https://github.com/MGrin/scani-oss) — `relations (.)` at [`packages/infra/db/src/schema/users.ts:82`](https://github.com/MGrin/scani-oss/blob/HEAD/packages/infra/db/src/schema/users.ts#L82)
- [`ManrajSingh6/talk2sql`](https://github.com/ManrajSingh6/talk2sql) — `relations (.)` at [`api/src/db/schema.ts:131`](https://github.com/ManrajSingh6/talk2sql/blob/HEAD/api/src/db/schema.ts#L131)
- [`MariaRiojas/web-ubo163`](https://github.com/MariaRiojas/web-ubo163) — `relations (.)` at [`lib/db/schema/cgbvp.ts:29`](https://github.com/MariaRiojas/web-ubo163/blob/HEAD/lib/db/schema/cgbvp.ts#L29)
- [`Martinviald/EdTech`](https://github.com/Martinviald/EdTech) — `relations (.)` at [`packages/db/src/schema/files.ts:70`](https://github.com/Martinviald/EdTech/blob/HEAD/packages/db/src/schema/files.ts#L70)
- [`Meeting-BaaS/transcript-seeker`](https://github.com/Meeting-BaaS/transcript-seeker) — `relations (.)` at [`packages/db/src/schema.ts:81`](https://github.com/Meeting-BaaS/transcript-seeker/blob/HEAD/packages/db/src/schema.ts#L81)
- [`Michaecyber/postgres-ecom`](https://github.com/Michaecyber/postgres-ecom) — `relations (.)` at [`db/schema.ts:125`](https://github.com/Michaecyber/postgres-ecom/blob/HEAD/db/schema.ts#L125)

## Your most-used surface, for context

What consumers reach for most. Useful as a deprecation-order guide: the further down this list a symbol sits, the cheaper it is to remove.

| symbol | entry point | repos | call sites |
|---|---|---:|---:|
| `eq` | `drizzle-orm` | 1,574 | 15,368 |
| `and` | `drizzle-orm` | 831 | 4,119 |
| `sql` | `drizzle-orm` | 824 | 5,030 |
| `pgTable` | `drizzle-orm/pg-core` | 488 | 2,191 |
| `text` | `drizzle-orm/pg-core` | 464 | 6,486 |
| `desc` | `drizzle-orm` | 452 | 1,141 |
| `timestamp` | `drizzle-orm/pg-core` | 446 | 3,344 |
| `inArray` | `drizzle-orm` | 327 | 895 |
| `integer` | `drizzle-orm/pg-core` | 318 | 1,876 |
| `boolean` | `drizzle-orm/pg-core` | 269 | 763 |
| `relations` | `drizzle-orm` | 231 | 931 |
| `uuid` | `drizzle-orm/pg-core` | 226 | 1,881 |
| `asc` | `drizzle-orm` | 219 | 520 |
| `index` | `drizzle-orm/pg-core` | 215 | 1,551 |
| `varchar` | `drizzle-orm/pg-core` | 201 | 2,015 |
| `drizzle` | `drizzle-orm/postgres-js` | 195 | 241 |
| `text` | `drizzle-orm/sqlite-core` | 194 | 4,555 |
| `or` | `drizzle-orm` | 191 | 321 |
| `sqliteTable` | `drizzle-orm/sqlite-core` | 190 | 858 |
| `isNull` | `drizzle-orm` | 183 | 756 |
| `jsonb` | `drizzle-orm/pg-core` | 182 | 611 |
| `integer` | `drizzle-orm/sqlite-core` | 172 | 1,944 |
| `count` | `drizzle-orm` | 171 | 369 |
| `gte` | `drizzle-orm` | 142 | 317 |
| `drizzle` | `drizzle-orm/node-postgres` | 142 | 170 |

## Method

1. **Export surface.** `drizzle-orm@0.45.2` and `@1.0.0-rc.4` are installed from npm with `--ignore-scripts` and their `.d.ts` declarations read through the TypeScript compiler, following re-exports across module and package boundaries. Entry points come from the manifest’s `exports` map, so each subpath is a surface of its own.
2. **Consumer discovery.** GitHub code search, 19 queries, open-prefix forms so subpath imports are not missed, partitioned by file size when a query saturates the 1000-result ceiling. 16,603 candidate files across 10,294 repositories.
3. **Attribution.** 4,500 files fetched at `HEAD` and parsed. Every symbol is resolved from its import binding through the TypeScript language service; text matching is never used.
4. **Canonicalisation.** Symbols are reconciled against the package’s own export surface, keyed by entry point. 0 attributions arriving through CJS default-interop were merged into their real symbol; 34 referenced a name the published surface does not export (see limits).
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
| `"from 'drizzle-orm" language:typescript` | 4,088 | 1,000 |
| `"from 'drizzle-orm" language:typescript size:0..1000` | 6,568 | 110 |
| `"from 'drizzle-orm" language:typescript size:1001..2000` | 3,676 | 1,000 |
| `"from 'drizzle-orm" language:typescript size:2001..4000` | 3,448 | 1,000 |
| `"from 'drizzle-orm" language:typescript size:4001..8000` | 4,740 | 1,000 |
| `"from 'drizzle-orm" language:typescript size:8001..16000` | 4,284 | 1,000 |
| `"from 'drizzle-orm" language:typescript size:16001..32000` | 6,284 | 1,000 |
| `"from 'drizzle-orm" language:typescript size:32001..65000` | 4,344 | 1,000 |
| `"from 'drizzle-orm" language:typescript size:>65000` | 1,916 | 1,000 |
| `"from \"drizzle-orm" language:typescript` | 3,368 | 1,000 |
| `"from \"drizzle-orm" language:typescript size:0..1000` | 7,288 | 1,000 |
| `"from \"drizzle-orm" language:typescript size:1001..2000` | 3,468 | 1,000 |
| `"from \"drizzle-orm" language:typescript size:2001..4000` | 3,688 | 1,000 |
| `"from \"drizzle-orm" language:typescript size:4001..8000` | 6,728 | 1,000 |
| `"from \"drizzle-orm" language:typescript size:8001..16000` | 4,100 | 1,000 |
| `"from \"drizzle-orm" language:typescript size:16001..32000` | 3,028 | 1,000 |
| `"from \"drizzle-orm" language:typescript size:32001..65000` | 4,928 | 1,000 |
| `"from \"drizzle-orm" language:typescript size:>65000` | 1,880 | 1,000 |
| `"require('drizzle-orm" language:typescript` | 404 | 476 |

Also true, and bounded:

- **12,103 candidate files were found but not opened.** This run fetched 4,500 of the 16,603 files search returned, in the order search returned them, and stopped there. The unopened remainder is not a random sample of the corpus, so the affected-repository list is a floor and the *absence* of a repository from it is not evidence that it is safe.
- **Public code only, TypeScript only.** Private repositories are invisible, and this run scanned `language:typescript`. Your JavaScript consumers, your enterprise customers, and anything behind a VPN are not in these numbers — all of them push the real figure up, none down.
- **`HEAD`, not a release tag.** Files are read at each repository’s default branch as of the corpus date. A consumer may have already migrated on a branch, or pinned an old version in production.
- **Member analysis is one level deep.** `Client.method` is resolved; `Client.method.option` is not. Signature and type-parameter changes are out of scope entirely — a symbol that survives with an incompatible signature is counted here as *unchanged*, so category B is a floor as well.
- **Single-file resolution.** A symbol re-exported through a consumer’s own barrel file and used elsewhere is attributed at the barrel, not at the ultimate use site. This undercounts affected files; it does not misattribute them.
- **Names the surface does not export.** 34 attributions reference an identifier absent from the published surface. Those are consumers reaching past the public API, or gaps in our surface extraction; either way they are excluded from the break counts rather than guessed at.
- **Wildcard entry points are skipped.** A manifest that declares `"./plugins/*"` in its `exports` map exposes subpaths that cannot be enumerated from the manifest alone. Any break under such a subpath is invisible to this report. (This package declares none, so nothing is lost here — but the limitation is stated because it is a property of the method, not of this run.)

## Machine-readable

The JSON companion carries every affected repository, every call site with file and line, the full export diff, and the exact search queries used. Nothing in this document is a number you have to take on trust.
