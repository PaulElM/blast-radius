### An entire dialect is removed, and no changelog says so

The largest single removal in this release is not mentioned in any of the
publisher's 22 official changelog entries for the 1.0 line.

**The whole Gel dialect is gone: 61 entry points, roughly 500 exported symbols.**
`drizzle-orm/gel-core`, `drizzle-orm/gel-core/columns`,
`drizzle-orm/gel-core/query-builders`, `drizzle-orm/gel-core/expressions` and 57
sibling subpaths are present in `0.45.2` and absent from `1.0.0-rc.4`. So are the
`knex`, `kysely` and `prisma` integration entry points.

This was checked for the obvious innocent explanations before being called a
removal, because "removed" and "moved" are not the same claim:

- **Not relocated inside the package** — no `gel` export survives anywhere in the
  `1.0.0-rc.4` manifest.
- **Not split into a companion package** — the plausible standalone names return
  `E404` on the npm registry.
- **Not a rename** — there is no `edgedb`-flavoured replacement export, and the
  source directories are absent at the release tag.

**The part that costs the publisher money:** the documentation page
`orm.drizzle.team/docs/get-started-gel` is still live and still instructs users to
run `npm i drizzle-orm@rc` and `import ... from 'drizzle-orm/gel'`. The `@rc` tag
resolves to `1.0.0-rc.4`, which has no such export. A developer following the
publisher's own current documentation fails at the first import.

That is the shape of finding this report exists to produce. It is not visible in
downloads, not visible in the dependents graph, and not visible in the changelog —
it is only visible by diffing the published artifacts and then asking who was
using the part that vanished.

_Verified against the installed tarballs for both versions and against the
publisher's live documentation and release notes on 2026-07-24. Independent audit:
[`docs/audit-surface-diff.md`](../docs/audit-surface-diff.md)._
