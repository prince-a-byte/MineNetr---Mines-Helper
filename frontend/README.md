# MineNetr Frontend — DGMS & Operations Portals

Next.js 14 App Router · React 18 · TypeScript (strict) · Tailwind CSS 3 · Recharts · lucide-react.
No additional runtime dependencies were added for either portal.

## Routes

### DGMS Administrative Portal
| Route | Page |
|---|---|
| `/login` | Unified 4-role sign-in (real backend auth) |
| `/dgms` | 1 · DGMS Dashboard |
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

### Coal Mine Operations Portal (Operator)
| Route | Page |
|---|---|
| `/operator` | 1 · Operations Dashboard |
| `/operator/workers` | 2 · Workers & Manpower |
| `/operator/contractors` | 3 · Contractors |
| `/operator/attendance` | 4 · Attendance & Access |
| `/operator/production` | 5 · Production & Dispatch |
| `/operator/stockpile` | 6 · Stockpile Management |
| `/operator/bills` | 7 · Bills & Transactions |
| `/operator/documents` | 8 · Documents & Compliance |
| `/operator/reports` | 9 · Reports & Analytics |
| `/operator/inspections` | 10 · Inspection & Audit |
| `/operator/settings` | 11 · Settings |

Deep links with presets: `/operator/workers?tab=Worker%20List`, `/operator/bills?tab=Bill%20Verification`, `/operator/documents?tab=Submissions%20%26%20Approvals`.

## Data architecture (single source of truth)

### DGMS portal
```
lib/dgms/
  types.ts      Typed domain models (enums for every status)
  seed.ts       Deterministic synthetic dataset (fictional mines, demo coords)
  mockDb.ts     Central store: state + consistency-enforcing actions + audit + toasts
  services.ts   Typed service interfaces; mock impls (store-backed) + HTTP TODO stubs
  api.ts        Endpoint map: CONFIRMED vs TODO
  format.ts     Date/number/relative-time formatters (fixed demo clock)
  export.ts     CSV export of filtered rows, JSON backup/restore with validation
components/dgms/ui.tsx
```

### Operations portal
```
lib/ops/
  types.ts          Typed domain models (enums for every status)
  seed.ts           Deterministic synthetic dataset (5 mines, 132 workers, 12 contractors)
  store.ts          Central store: state + 50+ consistency-enforcing actions + audit + toasts
  format.ts         Date/number/currency formatters (fixed demo clock 2026-10-03)
  export.ts         CSV export of filtered rows
  api.ts            HTTP adapter boundary (endpoint map with TODO markers)
  repositories.ts   Data access boundary (mock/http switch via NEXT_PUBLIC_OPS_DATA_MODE)
components/operations/
  ui.tsx            UI kit: KpiCard, SectionCard, DataTable, DetailDrawer, ConfirmDialog, etc.
  charts.tsx        Shared Recharts primitives: Donut, VBars, HBarRows, TrendBars, StackedBars, TrendLine
  modals.tsx        Shared workflow modals: AddWorkerModal, RecordProductionModal, UploadDocModal
  OperationsShell.tsx  Navy sidebar, MineSelector, notification bell, profile menu, mobile drawer
  hooks.ts          useMineScope, useTab, usePageReady, byMine, hrefWithTab
```

**Demo mode is explicit, never silent:** every Operations page shows a
`DEMO MODE · SYNTHETIC DATA` badge. `NEXT_PUBLIC_OPS_DATA_MODE` defaults to
`mock`; `http` mode selects typed adapters that throw named TODO errors — mock
data is never substituted after an HTTP failure. Real backend auth
(`/api/v1/auth/login`) is unchanged and still enforced by `RoleShell.tsx`.

**All records are fictional.** Sensor readings, weighbridge data, CCTV feeds,
challans, payments, and password changes are all labeled as simulated.

## Cross-page consistency (Operations portal, verified behaviors)

- **Add worker** → worker list, contractor workforce, attendance log, KPIs and charts all update.
- **Check in worker** → attendance table, on-site count, gate activity feed and audit trail update together.
- **Record dispatch** → dispatch table, production-vs-dispatch chart, stockpile balance (via stockTx) and destination donut all update.
- **Approve bill** → bill status, pending/approved KPIs, status donut, payment summary and audit trail update.
- **Schedule/start/complete inspection** → inspection table, trend chart, type donut, KPIs and findings queue update.
- **Add finding + assign corrective action** → finding status changes to "Action Assigned", corrective actions list and compliance scores update.
- **Contract approval workflow** → new contractor starts as "Pending Approval"; approve/reject updates contractor list, KPIs, donut and workforce charts.
- **Work order approval** → pending work orders appear in Contractors page queue; approve activates the WO and logs audit.
- **Stock transfer/reconcile** → stockpile balances, transaction history and reconciliation variance KPI update.
- **Document submit/approve/reject** → document status, compliance KPIs, category tabs and timeline update.
- **Every mutation appends an audit record** visible on Dashboard "Recent Activities", Bills "Audit Trail" and Settings "Audit Logs".

## Environment

See `.env.example`. `NEXT_PUBLIC_API_BASE_URL` must be browser-reachable.
`NEXT_PUBLIC_DGMS_DATA_MODE=mock` (default) or `http` (only after confirming
every endpoint in `lib/dgms/api.ts`).
`NEXT_PUBLIC_OPS_DATA_MODE=mock` (default) or `http` (only after confirming
every endpoint in `lib/ops/api.ts` — currently most are TODO).

## Checks run (2026-10-18)

- `npx tsc --noEmit` — clean.
- `npm run build` — 49/49 static pages, no errors.
- Dev-server route smoke test: all 11 `/dgms*` routes return 200.
- All 11 `/operator*` routes compile and build successfully.
- Backend untouched: `git status` shows only `frontend/` changes.

## Implementation report

See `frontend/docs/ops-implementation-report.md` for the full per-page implementation details, workflow verification notes and adapter boundary documentation.
