# KT-A precision audit — zod

- files parsed: **60** (0 parse errors)
- attributions in population: **1070**
- distinct consuming repos: **54**
- sample drawn: **30** across **30** distinct repos (seed 7, reproducible, stratified by repo)

**Pass condition: false positives <= 20% of the sample (6 of 30).**

## Sample — judge each line: does this file really use this symbol of the package?

### 1. `z.string` — SonuKumar7668/Nextjs-demo/auth.ts:27
- binding: `z` (named import from `zod`)
- usage: call
```ts
.object({ email: z.string().email(), password: z.string().min(6) })
```

### 2. `z.enum` — kojiyamauchi/next-server-components-scaffold/env.ts:20
- binding: `z` (named import from `zod`)
- usage: call
```ts
NODE_ENV: z.enum(['development', 'production']).default('development'),
```

### 3. `z.infer` — ThatGuySam/shots-orger/main.ts:90
- binding: `z` (named import from `zod`)
- usage: type
```ts
type DestDirPath = z.infer<typeof DestDirPathSchema>
```

### 4. `z.string` — bon2362/book-club/env.ts:16
- binding: `z` (named import from `zod`)
- usage: call
```ts
NEON_API_KEY: z.string().min(1).optional(),
```

### 5. `z.enum` — rahulkumarpahwa/api-design-nodejs-v5-masterdotdev/env.ts:22
- binding: `z` (named import from `zod`)
- usage: call
```ts
APP_STAGE: z.enum(['dev', 'test', 'production']),
```

### 6. `object` — gauravb4875-ux/SP2.0/api.ts:121
- binding: `zod` (namespace import from `zod`)
- usage: call
```ts
export const CreateObjectionResponse = zod.object({
```

### 7. `z.string` — mpaulaos/emcode-backend/env.ts:33
- binding: `z` (named import from `zod`)
- usage: call
```ts
JWT_EXPIRES_IN: z.string().default('1h'),
```

### 8. `z.string` — MatthewDailey/hackathon-322-agent/say.ts:25
- binding: `z` (named import from `zod`)
- usage: call
```ts
text: z.string().describe('The text to be spoken'),
```

### 9. `z.string` — guillermoriv/dashboard-app-router/auth.ts:25
- binding: `z` (named import from `zod`)
- usage: call
```ts
.object({ email: z.string().email(), password: z.string().min(6) })
```

### 10. `parse` — victor-software-house/is-node-vulnerable/cli.ts:38
- binding: `z` (namespace import from `zod`)
- usage: call
```ts
const securityDb = z.parse(securityDatabaseSchema, securityData);
```

### 11. `z.string` — MukundVisavadiya/nextjs-dashboard/auth.ts:25
- binding: `z` (named import from `zod`)
- usage: call
```ts
.object({ email: z.string().email(), password: z.string().min(6) })
```

### 12. `z.object` — litosbla/prueba_carolina/auth.ts:25
- binding: `z` (named import from `zod`)
- usage: call
```ts
const parsedCredentials = z .object({ email: z.string().email(), password: z.string().min(6) })
```

### 13. `object` — Phala-Network/phat-frame-gateway/bun.ts:20
- binding: `z` (namespace import from `zod`)
- usage: call
```ts
const uploadSchema = z.object({
```

### 14. `z.string` — Santaval/http-resend-mcp/mcp.ts:49
- binding: `z` (named import from `zod`)
- usage: call
```ts
text: z.string().describe('Plain text email content'),
```

### 15. `z.string` — ilyakashitsyn/lodash-project/app.ts:12
- binding: `z` (named import from `zod`)
- usage: call
```ts
title: z.string(),
```

### 16. `z.string` — ProgrammerZamanNow/belajar-bun-dasar/zod.ts:5
- binding: `z` (named import from `zod`)
- usage: call
```ts
password: z.string().min(1).max(50)
```

### 17. `z.ZodError` — christopher-czaban/motion-mcp-server/main.ts:1914
- binding: `z` (named import from `zod`)
- usage: value
```ts
if (error instanceof z.ZodError) {
```

### 18. `z.string` — noabouskila/Dashboard-Next/auth.ts:34
- binding: `z` (named import from `zod`)
- usage: call
```ts
password : z.string().min(6)}).safeParse(credentials);
```

### 19. `z.infer` — utftu/desy/a.ts:16
- binding: `z` (named import from `zod`)
- usage: type
```ts
type Z = z.infer<typeof zSchema>;
```

### 20. `z.ZodError` — josefaidt/avm/avm.ts:103
- binding: `z` (named import from `zod`)
- usage: value
```ts
if (error instanceof z.ZodError) {
```

### 21. `z.string` — thedashpuntsag/typescript-serverless-template/env.ts:4
- binding: `z` (named import from `zod`)
- usage: call
```ts
AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
```

### 22. `z.object` — Jake177/nextjs-dashboard/auth.ts:26
- binding: `z` (named import from `zod`)
- usage: call
```ts
const parsedCredentials = z .object({ email: z.string().email(), password: z.string().min(6) })
```

### 23. `z.string` — dohaicuong/cf-vite/env.ts:7
- binding: `z` (named import from `zod`)
- usage: call
```ts
VITE_CLERK_PUBLISHABLE_KEY: z.string()
```

### 24. `z.string` — Natchii59/memo/env.ts:14
- binding: `z` (named import from `zod`)
- usage: call
```ts
EMAIL_SERVER_PORT: z.string().min(1),
```

### 25. `z.string` — YongTaoo/toDoList/auth.ts:25
- binding: `z` (named import from `zod`)
- usage: call
```ts
.object({ email: z.string().email(), password: z.string().min(6) })
```

### 26. `z.object` — JohnMwendwa/nextjs-dashboard/auth.ts:24
- binding: `z` (named import from `zod`)
- usage: call
```ts
const parsedCredentials = z .object({ email: z.string().email(), password: z.string().min(6) })
```

### 27. `z.string` — netblaiz/nextjs-tutorial/auth.ts:26
- binding: `z` (named import from `zod`)
- usage: call
```ts
.object({ email: z.string().email(), password: z.string().min(6) })
```

### 28. `z.string` — rkanik/deno/zod.ts:5
- binding: `z` (named import from `zod`)
- usage: call
```ts
export const zPassword = z.string().min(8, 'Password must be at least 8 characters long')
```

### 29. `z.object` — joeytitanium/magic-redact/env.ts:3
- binding: `z` (named import from `zod`)
- usage: call
```ts
const ENV_SCHEMA = z.object({
```

### 30. `z.object` — native-land-digital/next-nld/auth.ts:64
- binding: `z` (named import from `zod`)
- usage: call
```ts
const parsedCredentials = z .object({ email: z.string().email(), password: z.string().min(4) })
```

## Top symbols by consuming repos

| symbol | repos | hits | type-only hits |
|---|---:|---:|---:|
| `z.string` | 46 | 359 | 0 |
| `z.object` | 35 | 80 | 0 |
| `z.infer` | 12 | 17 | 17 |
| `z.array` | 8 | 31 | 0 |
| `z.enum` | 8 | 13 | 0 |
| `z.ZodError` | 6 | 24 | 0 |
| `z.number` | 6 | 16 | 0 |
| `object` | 3 | 87 | 0 |
| `default.string` | 3 | 18 | 0 |
| `z.coerce.number` | 3 | 8 | 0 |
| `default.object` | 3 | 3 | 0 |
| `z.union` | 3 | 3 | 0 |
| `string` | 2 | 194 | 0 |
| `number` | 2 | 90 | 0 |
| `array` | 2 | 24 | 0 |
| `coerce.number` | 2 | 22 | 0 |
| `coerce.string` | 2 | 7 | 0 |
| `default.infer` | 2 | 6 | 6 |
| `z.record` | 2 | 3 | 0 |
| `z.boolean` | 2 | 3 | 0 |
| `default.enum` | 2 | 2 | 0 |
| `default.number` | 2 | 2 | 0 |
| `default.boolean` | 2 | 2 | 0 |
| `boolean` | 1 | 14 | 0 |
| `enum` | 1 | 14 | 0 |
