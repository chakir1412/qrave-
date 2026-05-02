# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Next.js dev server (default port 3000)
- `npm run build` — production build; **must pass before any commit** (per project rules)
- `npm run lint` — ESLint via `eslint-config-next`
- No test runner is configured. Do not invent one.

The Supabase CLI is **not** installed. SQL migrations under `supabase/migrations/` are executed manually in the Supabase SQL editor; the file in the repo is the source of truth, the editor just runs it.

## Stack

- Next.js 16 App Router, React 19, TypeScript strict (`any` is forbidden — use precise types).
- Tailwind v4 (PostCSS plugin only — there is no `tailwind.config.js`, do not create one).
- Supabase (`@supabase/supabase-js` 2.98.x). The legacy `@supabase/auth-helpers-nextjs` package is in `package.json` but **must not be used** for new code (see Auth below).
- Path alias: `@/*` → repo root.
- `next.config.ts` sets `output: "standalone"`, externalizes `canvas` and `pdfjs-dist`, and whitelists Supabase storage (`lkaxapfvkjwfchiqaiee.supabase.co`) for `next/image`.

## Big-picture architecture

The app is a multi-tenant QR menu platform with three distinct surfaces, all served from one Next.js app:

1. **Public guest menu** — `app/[slug]/page.tsx` and `app/[slug]/[tischSegment]/page.tsx`.
   - `loadPublicSpeisekarteBySlug` (in `lib/load-public-speisekarte.ts`) loads restaurant + active menu items + categories + daily push using the anon client, ordered by `sort_order` with a fallback select for older DB columns.
   - The page picks a template component from a `templateMap` in the page file (`bar-soleil`, `kiosk-no7`, `compound-cafe`, `nami-sushi`, `da-mario`, `roots`) and renders it with shared `SpeisekarteProps`. Each template lives in `components/templates/<Brand>/` and composes the building blocks from `components/speisekarte/`.
   - `[tischSegment]` carries a per-table identifier (QR/NFC) which is used by `lib/tracking.ts` and the analytics events table.

2. **Restaurant operator dashboard** — `app/dashboard/page.tsx`, mounted via `components/dashboard/DashboardApp.tsx` with tabs (`HomeTab`, `KarteTab`, `TischeTab`) and overlays. This is the per-restaurant editor.

3. **Founder/admin dashboard** — `app/founder/page.tsx` + `components/founder/FounderDashboard.tsx` with tabs (Overview, Restaurants, Analytics, Kontakte, Todo). `lib/load-founder-dashboard.ts` hydrates it via parallel queries against `restaurants`, `scan_events`, `pipeline`, `founder_todos`, `restaurant_tables`, and a per-period KPI loader; `dedupe-scan-sessions` collapses sessions before counting.

### Component layering (load-bearing rule)

- `components/speisekarte/` — functional building blocks for the guest menu (Grid, Filter, ItemModal, Wishlist, DailyPush, etc.).
- `components/templates/<Brand>/` — visual/branding variants that consume those building blocks.
- `components/shared/` — hooks and types reused across both worlds (`useAnalytics`, `useDailyPush`, `useWishlist`, shared `types`).
- `components/dashboard/`, `components/founder/`, `components/legal/` — surface-specific UI.
- `app/` is **routing + composition only**. New business or UI logic goes in `components/` (or `lib/` for pure functions / data loaders), and the page just wires it up.

### `lib/` boundaries

- `lib/supabase.ts` — anon client + shared domain types (`Restaurant`, `MenuItem`, `OpeningHours`, `RestaurantTable`, `DailyPush`, …) and small helpers like `parseOpeningHours` / `fetchDailyPush`. **All Supabase domain types live here**; do not redefine them locally.
- `lib/supabase-service-role.ts` — `createServiceRoleClient()`. Server-only (route handlers / server actions), bypasses RLS, requires `SUPABASE_SERVICE_ROLE_KEY`.
- `lib/server/` — code that may only run on the server (e.g. `pdf-scan.ts`).
- `lib/load-*.ts` — page-level data loaders that do the multi-table fetches; pages call these instead of querying Supabase directly.
- `lib/parse-menu.ts`, `lib/claude-menu-from-text.ts`, `lib/html-to-text.ts` — AI menu import pipeline (see API routes).
- `lib/restaurant-analytics-aggregate.ts`, `lib/analytics-daily-aggregate.ts`, `lib/run-analytics-aggregation.ts`, `lib/founder-kpi-deltas.ts`, `lib/dedupe-scan-sessions.ts`, `lib/berlin-time.ts` — analytics pipeline (Berlin timezone is the canonical wall-clock).

### API routes

- `POST /api/parse-menu` — PDF (≤32 MB) or JPG/PNG → Claude (`ANTHROPIC_API_KEY`, model `claude-sonnet-4-20250514`). PDFs use the Anthropic beta header `pdfs-2024-09-25`. `vercel.json` raises this route's `maxDuration` to 120s.
- `POST /api/import-url` — `{ url, restaurantId? }`; fetches HTML, extracts text, runs the same Claude pipeline.
- `POST /api/track` — guest-side analytics ingestion (writes to `scan_events`).
- `app/api/founder/*` — founder dashboard server endpoints (refresh, restaurant analytics/heatmap/tables, Unsplash assignment, backfill).
- `GET /api/cron/aggregate-analytics` — daily Vercel cron (`vercel.json` → `0 0 * * *`) that rolls scan events into `restaurant_analytics_daily`.

## Auth (do not deviate)

The only allowed pattern in this repo:

```ts
import { supabase } from "@/lib/supabase";

const { data: { session } } = await supabase.auth.getSession();
if (!session) redirect("/login");          // server components / actions
// or, in "use client" pages: router.replace("/login")
```

Never use, even where it would compile: `@supabase/auth-helpers-nextjs`, `createServerComponentClient`, `createBrowserClient`, `createRouteHandlerClient`, `createMiddlewareClient`, or a second `createClient` import alongside `@/lib/supabase`. Login/logout go through the same exported `supabase` (`signInWithPassword`, `signOut`, …).

Server endpoints that legitimately need to bypass RLS use `createServiceRoleClient()` from `lib/supabase-service-role.ts`.

## Supabase / DB rules

- Every schema change is a new file in `supabase/migrations/` named `YYYYMMDDhhmmss_<purpose>.sql`. Do not edit the DB through the Supabase UI without committing the matching migration.
- Every new table **must** have RLS enabled with policies scoped by restaurant/user. Be additive when changing existing tables; prefer a new nullable column over a destructive change.
- After a schema change, update the corresponding types in `lib/supabase.ts` and any loader in `lib/load-*.ts`.

## Product constraints (will surprise you otherwise)

- Demo restaurant slug is `qrave-demo`. Supabase project ID is `lkaxapfvkjwfchiqaiee`. Admin email: `chakir.elhaji@gmail.com`.
- **Light mode only** — no dark mode toggles or `dark:` Tailwind variants unless the user explicitly asks for a design extension.
- **Allergens** are intentionally surfaced only as a disclaimer ("ask staff"). Do not build UI that suggests a structured allergen database, even if `MenuItem.allergen_ids` exists in the type.
- **No `alert()`** — use toasts/banners/inline UI states instead.

## Workflow

- Never push directly to `main`; use a feature/fix branch.
- Commit messages are in **German** (e.g. `feat: Speisekarten-Filter für Kategorien hinzufügen`).
- When the user asks for a refactor, do not change behavior or add/remove features — keep the public API of the touched module identical and split feature changes into separate steps.
- Read the file before editing it.
