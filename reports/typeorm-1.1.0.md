# Blast Radius Report — `typeorm` 0.3.31 → 1.1.0

> Prepared with **blast-radius** — a symbol-level usage census of the public repositories that consume `typeorm`.
> Corpus drawn 2026-07-24. Every number below is reproducible from the JSON companion to this file.

## The answer

**441 of the 2,415 public repositories we resolved import something that `1.1.0` no longer provides at the address they use it from.**

- 343 of them break at **runtime or import time**, not just in `tsc`.
- 0 entry points they import **stop resolving entirely** — those fail at import, before a line runs.
- 23 exports they call are gone from the entry point they import them from.
- 725 removed exports are used by **nobody** we found — that part of the break is free.

Of those 23 exports, **23 appear nowhere in `1.1.0`** — those are deletions and the consumer needs a rewrite. The other **0 still exist under the same name at a different entry point**, so those are likely moves or renames and the fix is a re-point. Same-name matching is a signal, not proof: a package can export the same name from two places meaning two different things, so each is marked "verify" rather than asserted.

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

Read from the **published npm artifacts** for `0.3.31` (published 2026-07-13) and `1.1.0` (published 2026-07-13) — not from a changelog, a roadmap, or the git tree. The tarball is what your consumers install.

| | count |
|---|---:|
| entry points in 0.3.31 | 2 |
| entry points in 1.1.0 | 2 |
| entry points **removed** | 0 |
| entry points added | 0 |
| exports **removed** | 748 |
| exports added | 2 |
| exports whose **name survives** | 512 |
| surviving exports that **lost a public member** | 48 |

> ⚠️ **"Name survives" is not "compatible."** This diff compares *export names*. It does not inspect signatures, type parameters, or runtime behaviour. A symbol can keep its name and still break every caller. In this tool's surface-diff audit, a hand-check of 12 surviving symbols drawn from `drizzle-orm`'s core entry points found **7 with incompatible signatures** — that audit was run against `drizzle-orm`, not against `typeorm`, so it measures **this method's blind spot** rather than anything about this release. It was deliberately drawn from where a refactor concentrates and is **not** extrapolated to the 512 above — the honest reading is that the true break count is materially higher than this report states, by an amount this method cannot measure.

Entry-point removals are the severest row in that table: when a subpath stops resolving, the consumer fails **at import time**, before a line of their code executes. No amount of call-site review on their side surfaces it in advance.

## What actually breaks, ranked by consumers affected

Three categories, kept apart because you triage them differently.

### A. Entry points that stop resolving — import-time breaks

The whole subpath is gone. These fail at import, before any of the consumer’s code runs, and no amount of call-site inspection on their side will find them in advance. Highest severity.

_No consumer in the scanned corpus is affected in this category._

### B. Removed exports that consumers actually use

The entry point still resolves; the symbol is gone. `type-only` rows break the build but not production — they are marked, not merged, because conflating them overstates the damage.

| symbol | from | kind | repos | call sites | still exported elsewhere? |
|---|---|---|---:|---:|---|
| `createConnection` | `typeorm` | function | 146 | 155 | **no — deleted** |
| `Connection` | `typeorm` | class | 117 | 194 | **no — deleted** |
| `getRepository` | `typeorm` | function | 94 | 235 | **no — deleted** |
| `ConnectionOptions` | `typeorm` | type _(type-only)_ | 65 | 87 | **no — deleted** |
| `getConnection` | `typeorm` | function | 58 | 83 | **no — deleted** |
| `EntityRepository` | `typeorm` | function | 49 | 59 | **no — deleted** |
| `getCustomRepository` | `typeorm` | function | 24 | 90 | **no — deleted** |
| `getManager` | `typeorm` | function | 22 | 64 | **no — deleted** |
| `useContainer` | `typeorm` | function | 11 | 12 | **no — deleted** |
| `getMongoRepository` | `typeorm` | function | 9 | 25 | **no — deleted** |
| `getConnectionManager` | `typeorm` | function | 9 | 9 | **no — deleted** |
| `getConnectionOptions` | `typeorm` | function | 8 | 9 | **no — deleted** |
| `ConnectionManager` | `typeorm` | class | 7 | 8 | **no — deleted** |
| `Timestamp` | `typeorm` | class _(type-only)_ | 5 | 10 | **no — deleted** |
| `createConnections` | `typeorm` | function | 5 | 5 | **no — deleted** |
| `ObjectId` | `typeorm` | class | 2 | 4 | **no — deleted** |
| `WhereExpression` | `typeorm` | interface _(type-only)_ | 2 | 3 | **no — deleted** |
| `ContainedType` | `typeorm` | type _(type-only)_ | 1 | 1 | **no — deleted** |
| `ContainerInterface` | `typeorm` | interface _(type-only)_ | 1 | 1 | **no — deleted** |
| `Transaction` | `typeorm` | class | 1 | 1 | **no — deleted** |
| `createQueryBuilder` | `typeorm` | function | 1 | 1 | **no — deleted** |
| `FindOptionsRelationByString` | `typeorm` | type _(type-only)_ | 1 | 1 | **no — deleted** |
| `FindOptionsSelectByString` | `typeorm` | type _(type-only)_ | 1 | 1 | **no — deleted** |

### C. Removed members on exports that survive

The export is still there, so a changelog diff of export names misses these entirely. The narrowest category and the easiest to ship by accident.

_No consumer in the scanned corpus is affected in this category._

## The affected repositories, by name

All 441 are in the JSON companion, each with every break we found in it. The first 60 are listed here, with one file and line per repository so each row can be opened and checked.

> Read at each repository’s default branch on 2026-07-24. A row means *this code, as written today, imports something `1.1.0` does not provide at that address* — it does not mean the project is broken, unmaintained, or has failed to act: they may pin an older version, may have migrated on another branch, and rows marked *verify* above are same-name matches rather than proven deletions. Check the line before acting on it.

- [`2n-snails/nest-back`](https://github.com/2n-snails/nest-back) — `getRepository (.)` at [`src/app.service.ts:32`](https://github.com/2n-snails/nest-back/blob/HEAD/src/app.service.ts#L32) _(+1 more)_
- [`404jv/dev-landia`](https://github.com/404jv/dev-landia) — `Connection (.)` at [`backend/src/modules/accounts/useCases/AuthenticateUser/AuthenticateuserController.spec.ts:9`](https://github.com/404jv/dev-landia/blob/HEAD/backend/src/modules/accounts/useCases/AuthenticateUser/AuthenticateuserController.spec.ts#L9) _(type-only — their build breaks, their runtime does not)_
- [`4GeeksAcademy/AitorMoyano-Express-REST-API`](https://github.com/4GeeksAcademy/AitorMoyano-Express-REST-API) — `createConnection (.)` at [`src/app.ts:16`](https://github.com/4GeeksAcademy/AitorMoyano-Express-REST-API/blob/HEAD/src/app.ts#L16)
- [`4GeeksAcademy/Jhow_EndPoints_BD_StarW`](https://github.com/4GeeksAcademy/Jhow_EndPoints_BD_StarW) — `createConnection (.)` at [`src/app.ts:16`](https://github.com/4GeeksAcademy/Jhow_EndPoints_BD_StarW/blob/HEAD/src/app.ts#L16)
- [`4GeeksAcademy/expressjs-rest-hello`](https://github.com/4GeeksAcademy/expressjs-rest-hello) — `createConnection (.)` at [`src/app.ts:16`](https://github.com/4GeeksAcademy/expressjs-rest-hello/blob/HEAD/src/app.ts#L16)
- [`4GeeksAcademy/sistema_autenticacon_react_nodejs_lluisespert`](https://github.com/4GeeksAcademy/sistema_autenticacon_react_nodejs_lluisespert) — `createConnection (.)` at [`src/app.ts:16`](https://github.com/4GeeksAcademy/sistema_autenticacon_react_nodejs_lluisespert/blob/HEAD/src/app.ts#L16)
- [`7codeRO/nest-typeorm-rest-api-boilerplate`](https://github.com/7codeRO/nest-typeorm-rest-api-boilerplate) — `Connection (.)` at [`src/shared/validators/entity-exist.validator.ts:16`](https://github.com/7codeRO/nest-typeorm-rest-api-boilerplate/blob/HEAD/src/shared/validators/entity-exist.validator.ts#L16) _(type-only — their build breaks, their runtime does not)_
- [`Abubakar-Abdulwahab/smartforce-backend`](https://github.com/Abubakar-Abdulwahab/smartforce-backend) — `EntityRepository (.)` at [`src/services/salaryDetails.service.ts:7`](https://github.com/Abubakar-Abdulwahab/smartforce-backend/blob/HEAD/src/services/salaryDetails.service.ts#L7)
- [`AdrianArtiles/viral-waitlist-api`](https://github.com/AdrianArtiles/viral-waitlist-api) — `createConnection (.)` at [`src/app.ts:38`](https://github.com/AdrianArtiles/viral-waitlist-api/blob/HEAD/src/app.ts#L38)
- [`Alisson-Oliveira/entregas-cariri`](https://github.com/Alisson-Oliveira/entregas-cariri) — `getRepository (.)` at [`backend/src/controllers/UsersControllers.ts:21`](https://github.com/Alisson-Oliveira/entregas-cariri/blob/HEAD/backend/src/controllers/UsersControllers.ts#L21)
- [`AndresFelipe23/finanzas-api`](https://github.com/AndresFelipe23/finanzas-api) — `Connection (.)` at [`src/tarjetas-nfc/tarjetas-nfc.service.ts:9`](https://github.com/AndresFelipe23/finanzas-api/blob/HEAD/src/tarjetas-nfc/tarjetas-nfc.service.ts#L9) _(type-only — their build breaks, their runtime does not)_
- [`AndrewVetovitz/Intern-zone`](https://github.com/AndrewVetovitz/Intern-zone) — `createConnection (.)` at [`server/src/app.ts:58`](https://github.com/AndrewVetovitz/Intern-zone/blob/HEAD/server/src/app.ts#L58)
- [`AshameTheDestroyer/Engineers-Mathematical-Guide`](https://github.com/AshameTheDestroyer/Engineers-Mathematical-Guide) — `ObjectId (.)` at [`backend/src/auth/auth.controller.ts:89`](https://github.com/AshameTheDestroyer/Engineers-Mathematical-Guide/blob/HEAD/backend/src/auth/auth.controller.ts#L89) _(type-only — their build breaks, their runtime does not)_
- [`AshokLamaMoktanTamang/nestjs-gql`](https://github.com/AshokLamaMoktanTamang/nestjs-gql) — `getMongoRepository (.)` at [`src/resolvers/store.resolver.ts:12`](https://github.com/AshokLamaMoktanTamang/nestjs-gql/blob/HEAD/src/resolvers/store.resolver.ts#L12)
- [`Authing/misskey`](https://github.com/Authing/misskey) — `EntityRepository (.)` at [`src/models/repositories/follow-request.ts:6`](https://github.com/Authing/misskey/blob/HEAD/src/models/repositories/follow-request.ts#L6)
- [`BinaryStudioAcademy/bsa-2021-hypecrafter`](https://github.com/BinaryStudioAcademy/bsa-2021-hypecrafter) — `createConnection (.)` at [`backend/src/server.ts:22`](https://github.com/BinaryStudioAcademy/bsa-2021-hypecrafter/blob/HEAD/backend/src/server.ts#L22) _(+2 more)_
- [`BoussonKarel/KassAapje`](https://github.com/BoussonKarel/KassAapje) — `createConnection (.)` at [`backend/server/app.ts:48`](https://github.com/BoussonKarel/KassAapje/blob/HEAD/backend/server/app.ts#L48) _(+4 more)_
- [`BrounouSalah/tuniMillion-gql`](https://github.com/BrounouSalah/tuniMillion-gql) — `getConnection (.)` at [`src/main.ts:52`](https://github.com/BrounouSalah/tuniMillion-gql/blob/HEAD/src/main.ts#L52)
- [`BuildingBlockchains/panel-backend`](https://github.com/BuildingBlockchains/panel-backend) — `createConnection (.)` at [`src/bin/www.ts:15`](https://github.com/BuildingBlockchains/panel-backend/blob/HEAD/src/bin/www.ts#L15) _(+2 more)_
- [`CDEBase/fullstack-pro`](https://github.com/CDEBase/fullstack-pro) — `createConnection (.)` at [`portable-devices/desktop/src/main/utils/sqlite/connection.ts:29`](https://github.com/CDEBase/fullstack-pro/blob/HEAD/portable-devices/desktop/src/main/utils/sqlite/connection.ts#L29) _(+2 more)_
- [`Caballerog/devfestmalaga2017`](https://github.com/Caballerog/devfestmalaga2017) — `Connection (.)` at [`08-heroes-testing/src/modules/heroes/heroes.providers.ts:7`](https://github.com/Caballerog/devfestmalaga2017/blob/HEAD/08-heroes-testing/src/modules/heroes/heroes.providers.ts#L7) _(type-only — their build breaks, their runtime does not)_
- [`CalebLovell/ts-pg-backend-starter`](https://github.com/CalebLovell/ts-pg-backend-starter) — `createConnection (.)` at [`src/server.ts:13`](https://github.com/CalebLovell/ts-pg-backend-starter/blob/HEAD/src/server.ts#L13)
- [`Cataleenn/LicentaStoicaCatalin2024_2025`](https://github.com/Cataleenn/LicentaStoicaCatalin2024_2025) — `EntityRepository (.)` at [`backend/src/user/user.repository.ts:4`](https://github.com/Cataleenn/LicentaStoicaCatalin2024_2025/blob/HEAD/backend/src/user/user.repository.ts#L4)
- [`Codaisseur/game-starter-b15`](https://github.com/Codaisseur/game-starter-b15) — `createConnection (.)` at [`server/src/db.ts:28`](https://github.com/Codaisseur/game-starter-b15/blob/HEAD/server/src/db.ts#L28)
- [`CodelyTV/typescript-ddd-course`](https://github.com/CodelyTV/typescript-ddd-course) — `createConnection (.)` at [`13-backoffice-projections/2-create-courses/src/Contexts/Shared/infrastructure/persistence/typeorm/TypeOrmClientFactory.ts:7`](https://github.com/CodelyTV/typescript-ddd-course/blob/HEAD/13-backoffice-projections/2-create-courses/src/Contexts/Shared/infrastructure/persistence/typeorm/TypeOrmClientFactory.ts#L7) _(+2 more)_
- [`CodersCrew/coders-board`](https://github.com/CodersCrew/coders-board) — `EntityRepository (.)` at [`server/src/positions/position.repository.ts:5`](https://github.com/CodersCrew/coders-board/blob/HEAD/server/src/positions/position.repository.ts#L5)
- [`Codgic/codgic-api`](https://github.com/Codgic/codgic-api) — `getRepository (.)` at [`src/models/group.ts:19`](https://github.com/Codgic/codgic-api/blob/HEAD/src/models/group.ts#L19)
- [`Colgate13/Brohood-network-researches`](https://github.com/Colgate13/Brohood-network-researches) — `getCustomRepository (.)` at [`src/controllers/SurveyController.ts:14`](https://github.com/Colgate13/Brohood-network-researches/blob/HEAD/src/controllers/SurveyController.ts#L14)
- [`Colgate13/bank-fluffly-backend`](https://github.com/Colgate13/bank-fluffly-backend) — `getRepository (.)` at [`src/services/CreateUserService.ts:20`](https://github.com/Colgate13/bank-fluffly-backend/blob/HEAD/src/services/CreateUserService.ts#L20)
- [`Cornayy/dofus-scraper`](https://github.com/Cornayy/dofus-scraper) — `getRepository (.)` at [`src/utils/data.ts:88`](https://github.com/Cornayy/dofus-scraper/blob/HEAD/src/utils/data.ts#L88)
- [`CromwellCMS/Cromwell`](https://github.com/CromwellCMS/Cromwell) — `ConnectionOptions (.)` at [`system/core/backend/src/repositories/product-category.repository.ts:46`](https://github.com/CromwellCMS/Cromwell/blob/HEAD/system/core/backend/src/repositories/product-category.repository.ts#L46) _(type-only — their build breaks, their runtime does not)_ _(+4 more)_
- [`Daria61/OkyMongoliaHackathon`](https://github.com/Daria61/OkyMongoliaHackathon) — `getRepository (.)` at [`packages/cms/src/controller/UserController.ts:11`](https://github.com/Daria61/OkyMongoliaHackathon/blob/HEAD/packages/cms/src/controller/UserController.ts#L11)
- [`Data-Infuser/Loader`](https://github.com/Data-Infuser/Loader) — `ConnectionOptions (.)` at [`src/config/ormConfig.ts:9`](https://github.com/Data-Infuser/Loader/blob/HEAD/src/config/ormConfig.ts#L9) _(type-only — their build breaks, their runtime does not)_
- [`DavidSparker0417/temple-truthy-backend`](https://github.com/DavidSparker0417/temple-truthy-backend) — `Connection (.)` at [`src/database/seeds/create-user.seed.ts:9`](https://github.com/DavidSparker0417/temple-truthy-backend/blob/HEAD/src/database/seeds/create-user.seed.ts#L9) _(type-only — their build breaks, their runtime does not)_
- [`DeliriumProducts/luncher-box`](https://github.com/DeliriumProducts/luncher-box) — `createConnection (.)` at [`backend/src/connections/db.ts:27`](https://github.com/DeliriumProducts/luncher-box/blob/HEAD/backend/src/connections/db.ts#L27)
- [`DeliverBle/deliverble-backend-nestjs`](https://github.com/DeliverBle/deliverble-backend-nestjs) — `EntityRepository (.)` at [`src/tag/tag.repository.ts:7`](https://github.com/DeliverBle/deliverble-backend-nestjs/blob/HEAD/src/tag/tag.repository.ts#L7)
- [`DevWars/devwars-api`](https://github.com/DevWars/devwars-api) — `Connection (.)` at [`cli/seeder.ts:23`](https://github.com/DevWars/devwars-api/blob/HEAD/cli/seeder.ts#L23) _(type-only — their build breaks, their runtime does not)_ _(+2 more)_
- [`DiogoAbu/how-much-server`](https://github.com/DiogoAbu/how-much-server) — `Connection (.)` at [`global.d.ts:10`](https://github.com/DiogoAbu/how-much-server/blob/HEAD/global.d.ts#L10) _(type-only — their build breaks, their runtime does not)_
- [`DiscordFactory/storage`](https://github.com/DiscordFactory/storage) — `Connection (.)` at [`src/Connect.ts:12`](https://github.com/DiscordFactory/storage/blob/HEAD/src/Connect.ts#L12) _(type-only — their build breaks, their runtime does not)_
- [`Dlame/Graduation_project_backend`](https://github.com/Dlame/Graduation_project_backend) — `Connection (.)` at [`src/app.module.ts:47`](https://github.com/Dlame/Graduation_project_backend/blob/HEAD/src/app.module.ts#L47) _(type-only — their build breaks, their runtime does not)_ _(+1 more)_
- [`Dwigth/sistema-monitoreo`](https://github.com/Dwigth/sistema-monitoreo) — `createConnection (.)` at [`init.ts:16`](https://github.com/Dwigth/sistema-monitoreo/blob/HEAD/init.ts#L16) _(+1 more)_
- [`Eccoar/2020.2-Eccoar_Complaint`](https://github.com/Eccoar/2020.2-Eccoar_Complaint) — `createConnection (.)` at [`src/db.ts:7`](https://github.com/Eccoar/2020.2-Eccoar_Complaint/blob/HEAD/src/db.ts#L7)
- [`EliasGcf/nlw-05-nodejs`](https://github.com/EliasGcf/nlw-05-nodejs) — `getCustomRepository (.)` at [`src/services/SettingsService.ts:15`](https://github.com/EliasGcf/nlw-05-nodejs/blob/HEAD/src/services/SettingsService.ts#L15)
- [`Emacdyz/Memory-Card-Game`](https://github.com/Emacdyz/Memory-Card-Game) — `createConnection (.)` at [`server/src/db.ts:28`](https://github.com/Emacdyz/Memory-Card-Game/blob/HEAD/server/src/db.ts#L28)
- [`FearMichael/health-tracker`](https://github.com/FearMichael/health-tracker) — `getRepository (.)` at [`api/src/modules/Charts/charts.service.ts:19`](https://github.com/FearMichael/health-tracker/blob/HEAD/api/src/modules/Charts/charts.service.ts#L19)
- [`Find-A-Musician/findAMusicianBackend`](https://github.com/Find-A-Musician/findAMusicianBackend) — `getRepository (.)` at [`api/controllers/genres/genres.ts:18`](https://github.com/Find-A-Musician/findAMusicianBackend/blob/HEAD/api/controllers/genres/genres.ts#L18)
- [`GamesProSeif/portfolio-server`](https://github.com/GamesProSeif/portfolio-server) — `ConnectionManager (.)` at [`src/structures/Database.ts:5`](https://github.com/GamesProSeif/portfolio-server/blob/HEAD/src/structures/Database.ts#L5)
- [`GreatLaboratory/nest-postgresql-example`](https://github.com/GreatLaboratory/nest-postgresql-example) — `Connection (.)` at [`src/user/user.subscriber.ts:6`](https://github.com/GreatLaboratory/nest-postgresql-example/blob/HEAD/src/user/user.subscriber.ts#L6) _(type-only — their build breaks, their runtime does not)_
- [`Guardians-DSC/GitRadar`](https://github.com/Guardians-DSC/GitRadar) — `getRepository (.)` at [`backend/src/services/Manager/SetGithubTokenService.ts:15`](https://github.com/Guardians-DSC/GitRadar/blob/HEAD/backend/src/services/Manager/SetGithubTokenService.ts#L15)
- [`HETIC-W3-G12/node-api`](https://github.com/HETIC-W3-G12/node-api) — `createConnection (.)` at [`repl.ts:19`](https://github.com/HETIC-W3-G12/node-api/blob/HEAD/repl.ts#L19)
- [`HackGT/ballot`](https://github.com/HackGT/ballot) — `getRepository (.)` at [`server/src/controllers/UserController.ts:13`](https://github.com/HackGT/ballot/blob/HEAD/server/src/controllers/UserController.ts#L13)
- [`Hasebul12/EcommerceProject`](https://github.com/Hasebul12/EcommerceProject) — `Timestamp (.)` at [`src/users/entities/user.entity.ts:30`](https://github.com/Hasebul12/EcommerceProject/blob/HEAD/src/users/entities/user.entity.ts#L30) _(type-only — their build breaks, their runtime does not)_
- [`IbbPress/nestjs-blog-server`](https://github.com/IbbPress/nestjs-blog-server) — `Connection (.)` at [`src/app.module.ts:31`](https://github.com/IbbPress/nestjs-blog-server/blob/HEAD/src/app.module.ts#L31) _(type-only — their build breaks, their runtime does not)_
- [`Ignition-Space/ignition`](https://github.com/Ignition-Space/ignition) — `ObjectId (.)` at [`apps/userServer/src/resource/resource.mongo.entity.ts:19`](https://github.com/Ignition-Space/ignition/blob/HEAD/apps/userServer/src/resource/resource.mongo.entity.ts#L19)
- [`Integrify-Team-4/Tindev`](https://github.com/Integrify-Team-4/Tindev) — `ConnectionOptions (.)` at [`src/util/secrets.ts:47`](https://github.com/Integrify-Team-4/Tindev/blob/HEAD/src/util/secrets.ts#L47) _(type-only — their build breaks, their runtime does not)_
- [`Ionaru/MarketBot`](https://github.com/Ionaru/MarketBot) — `createConnection (.)` at [`src/market-bot.ts:44`](https://github.com/Ionaru/MarketBot/blob/HEAD/src/market-bot.ts#L44)
- [`JacobRyzy/NeuroNest`](https://github.com/JacobRyzy/NeuroNest) — `getRepository (.)` at [`backend/src/routes/client.ts:11`](https://github.com/JacobRyzy/NeuroNest/blob/HEAD/backend/src/routes/client.ts#L11)
- [`JeongHoJeong/type-graph-orm`](https://github.com/JeongHoJeong/type-graph-orm) — `getConnection (.)` at [`src/util.ts:19`](https://github.com/JeongHoJeong/type-graph-orm/blob/HEAD/src/util.ts#L19)
- [`KRochaS/NextLevelWeek3`](https://github.com/KRochaS/NextLevelWeek3) — `getRepository (.)` at [`backend/src/controllers/OrphanagesController.ts:12`](https://github.com/KRochaS/NextLevelWeek3/blob/HEAD/backend/src/controllers/OrphanagesController.ts#L12)
- [`LISTEN-moe/discord-bot`](https://github.com/LISTEN-moe/discord-bot) — `Connection (.)` at [`src/bot/client/ListenClient.ts:14`](https://github.com/LISTEN-moe/discord-bot/blob/HEAD/src/bot/client/ListenClient.ts#L14) _(type-only — their build breaks, their runtime does not)_

## Your most-used surface, for context

What consumers reach for most. Useful as a deprecation-order guide: the further down this list a symbol sits, the cheaper it is to remove.

| symbol | entry point | repos | call sites |
|---|---|---:|---:|
| `Column` | `typeorm` | 930 | 7,425 |
| `Entity` | `typeorm` | 930 | 1,250 |
| `Repository` | `typeorm` | 746 | 1,119 |
| `PrimaryGeneratedColumn` | `typeorm` | 630 | 782 |
| `ManyToOne` | `typeorm` | 419 | 798 |
| `DataSource` | `typeorm` | 390 | 548 |
| `CreateDateColumn` | `typeorm` | 359 | 427 |
| `JoinColumn` | `typeorm` | 299 | 601 |
| `UpdateDateColumn` | `typeorm` | 290 | 343 |
| `OneToMany` | `typeorm` | 261 | 513 |
| `Index` | `typeorm` | 213 | 630 |
| `QueryRunner` | `typeorm` | 184 | 676 |
| `MigrationInterface` | `typeorm` | 159 | 287 |
| `PrimaryColumn` | `typeorm` | 154 | 258 |
| `createConnection` | `typeorm` | 146 | 155 |
| `BaseEntity` | `typeorm` | 134 | 189 |
| `Connection` | `typeorm` | 117 | 194 |
| `OneToOne` | `typeorm` | 96 | 120 |
| `getRepository` | `typeorm` | 94 | 235 |
| `EntityManager` | `typeorm` | 91 | 212 |
| `ManyToMany` | `typeorm` | 76 | 104 |
| `In` | `typeorm` | 73 | 102 |
| `DataSourceOptions` | `typeorm` | 67 | 79 |
| `ConnectionOptions` | `typeorm` | 65 | 87 |
| `JoinTable` | `typeorm` | 63 | 85 |

## Analyst notes

_The findings above are generated mechanically and reproducible from the JSON companion. This section is not: it is human cross-checking against the publisher’s own published material, and it is marked so you can weigh it differently._

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

## Method

1. **Export surface.** `typeorm@0.3.31` and `@1.1.0` are installed from npm with `--ignore-scripts` and their `.d.ts` declarations read through the TypeScript compiler, following re-exports across module and package boundaries. Entry points come from the manifest’s `exports` map, so each subpath is a surface of its own.
2. **Consumer discovery.** GitHub code search, 19 queries, open-prefix forms so subpath imports are not missed, partitioned by file size when a query saturates the 1000-result ceiling. 17,216 candidate files across 9,790 repositories.
3. **Attribution.** 3,696 files fetched at `HEAD` and parsed. Every symbol is resolved from its import binding through the TypeScript language service; text matching is never used.
4. **Canonicalisation.** Symbols are reconciled against the package’s own export surface, keyed by entry point. 1 attributions arriving through CJS default-interop were merged into their real symbol; 51 referenced a name the published surface does not export (see limits).
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
| `"from 'typeorm" language:typescript` | 8,168 | 1,000 |
| `"from 'typeorm" language:typescript size:0..1000` | 4,456 | 1,000 |
| `"from 'typeorm" language:typescript size:1001..2000` | 4,188 | 1,000 |
| `"from 'typeorm" language:typescript size:2001..4000` | 8,352 | 1,000 |
| `"from 'typeorm" language:typescript size:4001..8000` | 8,936 | 1,000 |
| `"from 'typeorm" language:typescript size:8001..16000` | 5,867 | 1,000 |
| `"from 'typeorm" language:typescript size:16001..32000` | 3,248 | 1,000 |
| `"from 'typeorm" language:typescript size:32001..65000` | 2,380 | 1,000 |
| `"from 'typeorm" language:typescript size:>65000` | 1,576 | 1,000 |
| `"from \"typeorm" language:typescript` | 5,048 | 1,000 |
| `"from \"typeorm" language:typescript size:0..1000` | 3,200 | 1,000 |
| `"from \"typeorm" language:typescript size:1001..2000` | 2,440 | 1,000 |
| `"from \"typeorm" language:typescript size:2001..4000` | 2,512 | 1,000 |
| `"from \"typeorm" language:typescript size:4001..8000` | 4,440 | 1,000 |
| `"from \"typeorm" language:typescript size:8001..16000` | 4,660 | 1,000 |
| `"from \"typeorm" language:typescript size:16001..32000` | 2,864 | 1,000 |
| `"from \"typeorm" language:typescript size:32001..65000` | 1,458 | 1,000 |
| `"from \"typeorm" language:typescript size:>65000` | 560 | 576 |
| `"require('typeorm" language:typescript` | 471 | 472 |

Also true, and bounded:

- **13,520 candidate files were found but not opened.** This run fetched 3,696 of the 17,216 files search returned, in the order search returned them, and stopped there. The unopened remainder is not a random sample of the corpus, so the affected-repository list is a floor and the *absence* of a repository from it is not evidence that it is safe.
- **Public code only, TypeScript only.** Private repositories are invisible, and this run scanned `language:typescript`. Your JavaScript consumers, your enterprise customers, and anything behind a VPN are not in these numbers — all of them push the real figure up, none down.
- **`HEAD`, not a release tag.** Files are read at each repository’s default branch as of the corpus date. A consumer may have already migrated on a branch, or pinned an old version in production.
- **Member analysis is one level deep.** `Client.method` is resolved; `Client.method.option` is not. Signature and type-parameter changes are out of scope entirely — a symbol that survives with an incompatible signature is counted here as *unchanged*, so category B is a floor as well.
- **Single-file resolution.** A symbol re-exported through a consumer’s own barrel file and used elsewhere is attributed at the barrel, not at the ultimate use site. This undercounts affected files; it does not misattribute them.
- **Names the surface does not export.** 51 attributions reference an identifier absent from the published surface. Those are consumers reaching past the public API, or gaps in our surface extraction; either way they are excluded from the break counts rather than guessed at.
- **⚠️ Wildcard entry points are skipped, and this package declares 2: `./*`, `./*.js`.** A wildcard subpath cannot be enumerated from the manifest alone, so it is absent from the 2 entry points this report diffed. `typeorm` therefore exposes reachable import paths that were **never compared between the two versions**, and any break under one of them is invisible here. This is the largest single coverage hole in this report and it is not quantifiable from the manifest.

## Machine-readable

The JSON companion carries every affected repository, every call site with file and line, the full export diff, and the exact search queries used. Nothing in this document is a number you have to take on trust.
