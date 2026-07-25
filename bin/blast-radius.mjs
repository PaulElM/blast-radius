#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collect, buildAudit, renderAudit } from '../src/kt-a.mjs'
import { runReport } from '../src/pipeline.mjs'
import { renderReport, renderJson } from '../src/report.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const USAGE = `usage:
  blast-radius report <package> [--from latest] [--to next] [--languages typescript,javascript]
                                [--pages N] [--max-files N] [--max-queries N] [--out NAME] [--notes FILE]
  blast-radius kt-a   <package> [--pages N] [--max-files N] [--n N] [--seed N] [--language L]
`

function flag(args, name, fallback) {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args[i + 1]
}

const [cmd, ...rest] = process.argv.slice(2)
const positional = rest.filter((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--'))
const pkg = positional[0]

if (!cmd || !pkg || !['report', 'kt-a'].includes(cmd)) {
  process.stderr.write(USAGE)
  process.exit(1)
}

const slug = pkg.replace(/\W+/g, '-')
const log = (s) => process.stderr.write(`${s}\n`)

if (cmd === 'kt-a') {
  const corpus = await collect(pkg, {
    pages: Number(flag(rest, 'pages', 1)),
    maxFiles: Number(flag(rest, 'max-files', 120)),
    language: flag(rest, 'language', 'typescript'),
  })
  const audit = buildAudit(corpus, { n: Number(flag(rest, 'n', 30)), seed: Number(flag(rest, 'seed', 1)) })

  const outDir = join(ROOT, 'data', 'audits')
  await mkdir(outDir, { recursive: true })
  await writeFile(join(outDir, `${slug}-kt-a.json`), JSON.stringify({ audit, results }, null, 1))
  await writeFile(join(outDir, `${slug}-kt-a.md`), renderAudit(audit, pkg))
  log(`\nwrote ${outDir}/${slug}-kt-a.{md,json}`)
  process.stdout.write(renderAudit(audit, pkg))
} else {
  const maxQueries = flag(rest, 'max-queries', null)
  const run = await runReport(pkg, {
    fromSpec: flag(rest, 'from', 'latest'),
    toSpec: flag(rest, 'to', 'next'),
    languages: flag(rest, 'languages', 'typescript').split(','),
    pages: Number(flag(rest, 'pages', 10)),
    maxFiles: Number(flag(rest, 'max-files', 0)),
    maxQueries: maxQueries == null ? undefined : Number(maxQueries),
    onLog: log,
  })

  const notesPath = flag(rest, 'notes', null)
  const notes = notesPath ? await readFile(notesPath, 'utf8') : null

  const name = flag(rest, 'out', slug)
  const outDir = join(ROOT, 'reports')
  await mkdir(outDir, { recursive: true })
  await writeFile(join(outDir, `${name}.md`), renderReport(run, { notes }))
  await writeFile(join(outDir, `${name}.json`), JSON.stringify(renderJson(run), null, 1))
  log(`\nwrote ${outDir}/${name}.{md,json}`)
}
