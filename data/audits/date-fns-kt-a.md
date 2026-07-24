# KT-A precision audit — date-fns

- files parsed: **60** (0 parse errors)
- attributions in population: **154**
- distinct consuming repos: **56**
- sample drawn: **30** across **30** distinct repos (seed 3, reproducible, stratified by repo)

**Pass condition: false positives <= 20% of the sample (6 of 30).**

## Sample — judge each line: does this file really use this symbol of the package?

### 1. `setWeek` — navikt/helsesjekk-bot/seed/seed.ts:78
- binding: `setWeek` (named import from `date-fns`)
- usage: call
```ts
timestamp: setWeek(new Date(2023, 0, 1, 13, 37), week + 1),
```

### 2. `startOfToday` — uetchy/miobot/src/job.ts:63
- binding: `startOfToday` (named import from `date-fns`)
- usage: call
```ts
const sot = startOfToday()
```

### 3. `FormatOptions` — marnusw/date-fns-tz/src/index.ts:3
- binding: `FormatOptions` (named import from `date-fns`), type-only
- usage: type
```ts
export interface FormatOptionsWithTZ extends Omit<FormatOptions, 'locale'> {
```

### 4. `addWeeks` — stephy/beatmyweight/src/data.ts:52
- binding: `addWeeks` (named import from `date-fns`)
- usage: call
```ts
currentDate = addWeeks(currentDate, 1);
```

### 5. `distanceInWords` — stefanjudis/netlify-menubar/src/menus.ts:33
- binding: `distanceInWords` (named import from `date-fns`)
- usage: call
```ts
label: `${shortenString(incident.title, 60)} (${distanceInWords(
```

### 6. `format` — gregfrasco/yahoo-finance-api/src/yahoo.ts:10
- binding: `format` (named import from `date-fns`)
- usage: call
```ts
const reportDate = format(date, 'yyyy-MM-dd');
```

### 7. `formatRFC7231` — ryanmichaelhirst/modelers-rift-nextjs/lib/auth.ts:30
- binding: `formatRFC7231` (named import from `date-fns`)
- usage: call
```ts
const rfcDate = formatRFC7231(new Date(1999))
```

### 8. `format` — Panos68/pantrainer/lib/pmc.ts:35
- binding: `format` (named import from `date-fns`)
- usage: call
```ts
const cutoff = format(subDays(lastDate, windowDays), 'yyyy-MM-dd')
```

### 9. `differenceInDays` — jrmajor/jrmajor/src/gen.ts:47
- binding: `d` (namespace import from `date-fns`)
- usage: call
```ts
const days = d.differenceInDays(now, date);
```

### 10. `Locale` — JKc66/Misbar_system/types.ts:41
- binding: `Locale` (named import from `date-fns`), type-only
- usage: type
```ts
dateLocale: Locale;
```

### 11. `compareDesc` — bepyan/bepyan.me/libs/mdx.ts:16
- binding: `compareDesc` (named import from `date-fns`)
- usage: call
```ts
return compareDesc(new Date(a.date), new Date(b.date));
```

### 12. `differenceInSeconds` — lichess-org/pgn-mule/src/poll.ts:48
- binding: `differenceInSeconds` (named import from `date-fns`)
- usage: call
```ts
const secondsSinceUpdated = differenceInSeconds(
```

### 13. `format` — dfo-no/krb-webclient/src/i18n.ts:45
- binding: `formatDate` (named import from `date-fns`)
- usage: call
```ts
return formatDate(value, format, { locale });
```

### 14. `format` — IlusionDev/nextjs-sitemap-generator/src/core.ts:279
- binding: `format` (named import from `date-fns`)
- usage: call
```ts
const date = format(new Date(), 'yyyy-MM-dd')
```

### 15. `format` — ahmettulutas/aesthemedturkey-landing/lib/env.ts:4
- binding: `format` (named import from `date-fns`)
- usage: call
```ts
export const apiVersion = format(currentDate, 'yyyy-MM-dd') || '2023-12-30';
```

### 16. `formatDistanceToNow` — IshakuMN/portfolio/src/comic.ts:35
- binding: `formatDistanceToNow` (named import from `date-fns`)
- usage: call
```ts
const relativeTime = formatDistanceToNow(releaseDate);
```

### 17. `startOfDay` — Illyism/sidejot/lib/db.ts:143
- binding: `startOfDay` (named import from `date-fns`)
- usage: call
```ts
const normalizedDate = startOfDay(date)
```

### 18. `compareDesc` — Tomerz93/blog/lib/post.ts:15
- binding: `compareDesc` (named import from `date-fns`)
- usage: call
```ts
return compareDesc(new Date(a.createdAt), new Date(b.createdAt));
```

### 19. `parseISO` — hassankhanafer123/Solo-LVL/lib/time.ts:35
- binding: `parseISO` (named import from `date-fns`)
- usage: call
```ts
const d = parseISO(effectiveDate + 'T12:00:00Z');
```

### 20. `formatRFC3339` — hijiki51/wakatime-gcal-exporter/src/gcal.ts:25
- binding: `formatRFC3339` (named import from `date-fns`)
- usage: call
```ts
dateTime: formatRFC3339(start)
```

### 21. `format` — mohammadabuhanif/StockPilot/types.ts:20
- binding: `format` (named import from `date-fns`)
- usage: call
```ts
return format(date, pattern);
```

### 22. `format` — AlanDevOps/alanrae.cloud/lib/post.ts:51
- binding: `format` (named import from `date-fns`)
- usage: call
```ts
date: format(new Date(f.date), 'PPP'),
```

### 23. `add` — thephilgray/mew-app/src/data.ts:38
- binding: `add` (named import from `date-fns`)
- usage: call
```ts
start: add(new Date(), { weeks: -2 }),
```

### 24. `isAfter` — maxmechanic/hot-one/src/moon.ts:31
- binding: `isAfter` (named import from `date-fns`)
- usage: call
```ts
return (!times.set || isBefore(date, times.set)) && (!times.rise || isAfter(date, times.rise));
```

### 25. `subHours` — relaycorp/awala-gateway-internet/src/pki.ts:57
- binding: `subHours` (named import from `date-fns`)
- usage: call
```ts
validityStartDate: subHours(now, CERTIFICATE_START_OFFSET_HOURS),
```

### 26. `formatISO` — swdotcom/swdc-vscode-musictime/src/Util.ts:116
- binding: `formatISO` (named import from `date-fns`)
- usage: call
```ts
outputChannel.appendLine(`${formatISO(new Date())} ${getLogId()}: ${message}`);
```

### 27. `eachDay` — pveller/orolo/src/ner.ts:102
- binding: `eachDay` (named import from `date-fns`)
- usage: call
```ts
return eachDay(compute(left, today)[0], compute(right, today)[0]);
```

### 28. `compareDesc` — glennreyes/glennreyes.com/lib/posts.ts:53
- binding: `compareDesc` (named import from `date-fns`)
- usage: call
```ts
compareDesc(
```

### 29. `es` — rafaLino/monthly-control/src/i18n.ts:9
- binding: `es` (named import from `date-fns/locale`)
- usage: value
```ts
const locales: Record<string, Locale> = { en: enUS, br: ptBR, es: es };
```

### 30. `sub` — oleksandr-voronkov/monobank-balancer/lib/api.ts:18
- binding: `sub` (named import from `date-fns`)
- usage: call
```ts
const from = sub(new Date(), { days: 31 }).getTime();
```

## Top symbols by consuming repos

| symbol | repos | hits | type-only hits |
|---|---:|---:|---:|
| `format` | 22 | 29 | 0 |
| `parseISO` | 5 | 9 | 0 |
| `isAfter` | 4 | 8 | 0 |
| `subDays` | 4 | 5 | 0 |
| `addDays` | 3 | 5 | 0 |
| `addYears` | 3 | 4 | 0 |
| `Locale` | 3 | 3 | 3 |
| `compareDesc` | 3 | 3 | 0 |
| `add` | 2 | 8 | 0 |
| `differenceInMonths` | 2 | 3 | 0 |
| `differenceInYears` | 2 | 3 | 0 |
| `parse` | 2 | 3 | 0 |
| `startOfDay` | 2 | 3 | 0 |
| `isValid` | 2 | 2 | 0 |
| `subMonths` | 2 | 2 | 0 |
| `formatISO` | 2 | 2 | 0 |
| `formatRelative` | 2 | 2 | 0 |
| `enUS` | 2 | 2 | 0 |
| `formatDistanceToNow` | 2 | 2 | 0 |
| `isFuture` | 1 | 4 | 0 |
| `isToday` | 1 | 4 | 0 |
| `addMonths` | 1 | 3 | 0 |
| `isBefore` | 1 | 3 | 0 |
| `formatRFC7231` | 1 | 3 | 0 |
| `FormatOptions` | 1 | 2 | 2 |
