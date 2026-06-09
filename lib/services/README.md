# Service layer (`lib/services/*`)

The **domain/service layer** of the modular monolith (architecture DR-1 / AR2). It holds all domain
logic and is the **only** layer that talks to external clients (Supabase, AI Gateway, storage, etc.).

## Rules

- **Framework-agnostic.** No `next/*` imports, no `Request`/`Response` handling, no React. A service
  must be callable from a Route Handler, a Server Action, a Cron job, or a future standalone API
  without modification.
- **Inbound only from the edges.** Route Handlers and Server Actions call services — never the reverse.
  Services never import from `app/`.
- **One concern per folder.** Group by domain: `lib/services/<domain>/<domain>.service.ts` (+ colocated
  `*.test.ts`). Export a small, typed surface; keep data-access details inside.
- **Extract-later guardrail.** Because services are decoupled from the Next.js runtime, the whole layer
  can be lifted into a standalone TypeScript API (Hono/NestJS) when mobile / public-API ships, with
  minimal rewrite. Keep that portability intact.

## Adding a service

1. Create `lib/services/<domain>/<domain>.service.ts` exporting pure, typed functions.
2. Colocate `lib/services/<domain>/<domain>.service.test.ts` (Vitest).
3. Call it from a Route Handler or Server Action — pass primitives/DTOs in, get typed values out.

`health/` is the reference example. `storage/` marks the abstraction seam for media (Supabase Storage
now, Cloudflare R2 fallback later — architecture DR-3).
