# MineNetr Frontend — DGMS Administrative Portal

Next.js 14 App Router · React 18 · TypeScript (strict) · Tailwind CSS 3 · Recharts · lucide-react.
No additional runtime dependencies were added for the DGMS portal.

## Routes

| Route | Page |
|---|---|
| `/login` | Unified 4-role sign-in (real backend auth) |
| `/dgms` | 1 · DGMS Dashboard (executive overview) |
| `/dgms/registry` | 2 · Mine Registry |
| `/dgms/inspections` | 3 · Inspection Oversight |
| `/dgms/findings` | 4 · Findings & Violations |
| `/dgms/safety` | 5 · Safety & Environment |
| `/dgms/production` | 6 · Production & Dispatch |
| `/dgms/workforce` | 7 · Workers & Contractors |
| `/dgms/reports` | 8 · Reports & Analytics |
| `/dgms/notifications` | 9 · Notifications & Alerts |
| `/dgms/audit` | 10 · Audit Logs |
| `/dgms/settings` | 11 · Settings |
| `/operator`, `/contractor`, `/inspector` | Other role workspaces (untouched by this change) |

Deep links with presets: `/dgms/findings?category=Safety`, `/dgms/findings?focus=FND-2026-482`,
`/dgms/reports?type=Safety%20Report`.

## Data architecture (single source of truth)

```
lib/dgms/
  types.ts      Typed domain models (enums for every status)
  seed.ts       Deterministic synthetic dataset (fictional mines, demo coords)
  mockDb.ts     Central store: state + consistency-enforcing actions + audit + toasts
  services.ts   Typed service interfaces; mock impls (store-backed) + HTTP TODO stubs
  api.ts        Endpoint map: CONFIRMED (verified in backend/app/main.py) vs TODO
  format.ts     Date/number/relative-time formatters (fixed demo clock)
  export.ts     CSV export of filtered rows, JSON backup/restore with validation
components/dgms/ui.tsx
  KpiCard, SectionCard, FilterBar (Apply/Reset), SearchInput, DataTable
  (sort/paginate/page-size/row-select), DetailDrawer, ConfirmDialog,
  EmptyState, Toasts, DemoBadge
```

**Demo mode is explicit, never silent:** every DGMS page shows a `DEMO data ·
synthetic` badge. `NEXT_PUBLIC_DGMS_DATA_MODE` defaults to `mock`; `http`
mode selects typed adapters that throw named TODO errors — mock data is never
substituted after an HTTP failure. Real backend auth (`/api/v1/auth/login`)
is unchanged and still enforced by `Shell.tsx`.

**All records are fictional.** Mine coordinates are hardcoded demo values,
worker IDs are masked (`XXXX-XXXX-nnnn`), IPs are synthetic, sensor readings
are labeled `demo:true` and shown as "DEMO feed".

## Cross-page consistency (verified behaviors)

- Create a finding-linked corrective action → finding status, dashboard alerts,
  compliance summaries and reports all update (same store).
- Schedule an inspection → table row, inspector workload bars, dashboard
  donut and KPIs update.
- Resolve a finding → requires a resolved/verified corrective action first;
  finding registry, alert counts, compliance update.
- Acknowledge a sensor alert / notification → state + counts update; the
  underlying violation is untouched until its own workflow resolves it.
- Mark notification read (single/bulk/all) → bell state and lists update.
- Every mutation above appends an audit record visible on page 10.

## Environment

See `.env.example`. `NEXT_PUBLIC_API_BASE_URL` must be browser-reachable.
`NEXT_PUBLIC_DGMS_DATA_MODE=mock` (default) or `http` (only after confirming
every endpoint in `lib/dgms/api.ts` — currently most are TODO).

## Checks run (2026-10-17)

- `npx tsc --noEmit` — clean.
- `npm run build` — 49/49 static pages, no errors.
- Dev-server route smoke test: all 11 `/dgms*` routes return 200.
- Backend untouched: `git status` shows only `frontend/` changes (backend
  `minenetr.db` is gitignored/runtime data).
