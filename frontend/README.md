# MineNetr Frontend — DGMS, Operations & Contractor Portals

Next.js 14 App Router · React 18 · TypeScript (strict) · Tailwind CSS 3 · Recharts · lucide-react.
No additional runtime dependencies were added for any portal.

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

### Contractor Portal (fully implemented)
The contractor portal reuses the shared `RoleShell` layout, sidebar and header.
Every route is functional and backed by a centralized synthetic repository —
there are no live-backend dependencies and no placeholder stubs.

| Route | Page |
|---|---|
| `/contractor` | Dashboard (4 KPIs → deep links, Worker Distribution donut by mine that re-scopes the whole portal, Contract Overview, Attendance donut, Recent Activities, derived Pending Tasks, Quick Actions, 14-day trend) |
| `/contractor/contracts` | My Contracts (banner, 4 KPI cards, 6 status tabs, search, filters, contract cards, Contract Value Overview donut, Upcoming Milestones, Requests & Renewals, details drawer, multi-step request + renewal dialogs, CSV export) |
| `/contractor/workers` | Workers & Manpower (5 KPIs, 5 tabs, 482-worker table with combined filters/search/sort/pagination, Add Worker wizard, worker drawer with 7 sections, training verify/renew + certificate download, transfer requests) |
| `/contractor/attendance` | Attendance & Access (5 KPIs, 5 tabs, mark attendance with manual-entry labelling, gate decisions with audited reasons, leave + gate-pass registers, 30-day trend) |
| `/contractor/bills` | Bills & Transactions (4 KPIs, 5 tabs, 3-step bill wizard, Payment Summary donut, Recent Transactions) |
| `/contractor/documents` | Documents & Compliance (4 KPIs, 4 category tabs, Upcoming Expiries, upload dialog, per-contractor compliance) |
| `/contractor/reports` | Reports (4 KPIs, 6 category tabs, charts, Recent Reports with real CSV downloads, Generate dialog, Quick Downloads) |
| `/contractor/notifications` | Notifications (4 KPIs, 7 tabs, summary donut with click-to-filter, deep links, Mark All Read) |

The mine selector in the header is **permission-scoped and shared** — the
selection persists across navigation and reloads and every KPI, table, chart and
export re-derives from it.

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

### Contractor "My Contracts" portal
```
lib/contracts/
  types.ts          Typed domain models (enums for every status; fixed demo clock 2026-10-03)
  seed.ts           Deterministic synthetic dataset (9 contracts across 3 mines, milestones,
                    documents, activity, one pending request + one pending renewal)
  store.ts          Central store: state + audited actions + localStorage persistence + reset;
                    contract/request/renewal are SEPARATE collections
  format.ts         Crore/Lakh currency, date, days-until and due-label formatters
  export.ts         CSV / JSON download helpers (client-side)
  api.ts            HTTP adapter boundary (endpoint map, every contract route marked confirmed:false)
  repositories.ts   ContractsRepository interface + mock/http switch (NEXT_PUBLIC_CONTRACTS_DATA_MODE)
components/contracts/
  ui.tsx            Mining banner, contract card, status pill, milestone item, toasts, work-type icons
  drawer.tsx        Details drawer: Overview / Scope / Milestones / Documents / Activity History
  dialogs.tsx       New Contract Request (3-step), Renewal, Export, Filters
components/RoleShell.tsx  Extended with optional mineOptions/mineValue/onMineChange + profile dropdown
app/contractor/contracts/page.tsx   The My Contracts page (single store subscription)
scripts/test-contracts.ts           Executable data-layer verification (run with npx tsx)
```

### Contractor workforce & compliance portal (Dashboard, Workers, Attendance, Bills, Documents, Reports, Notifications)
```
lib/workforce/
  types.ts          Typed domain models, 12 status enums, controlled vocabularies,
                    filter shapes, 24-item Permission union (fixed demo clock 2026-10-03)
  seed.ts           Deterministic synthetic dataset — 482 workers / 8 contractors /
                    777 training / 482 attendance / 919 access / 128 documents /
                    24 incidents / 10 transfers / 24 notifications (no Math.random)
  store.ts          Central store: 30+ audited actions, 5 demo roles, permission checks
                    inside every action, localStorage persistence + reset
  format.ts         Formatters + tone() + trainingStatusOf() (status derived from dates)
  export.ts         Real CSV / JSON / text downloads + demo certificate generator
  api.ts            HTTP adapter boundary (endpoint map; every contractor route confirmed:false)
  repositories.ts   WorkforceRepository interface + mock/http switch (NEXT_PUBLIC_WORKFORCE_DATA_MODE)
components/workforce/
  ui.tsx            Pill, Avatar, PermBtn/PermIconBtn (disabled + reason), toasts, role switcher,
                    Reset Demo, PageToolbar (mine/period/export), KpiGrid, Stat
  shell.tsx         ContractorShell — shared sidebar/header, mine selector, nav badge, toasts
  dashboard.tsx  workers.tsx  attendance.tsx  bills.tsx  documents.tsx
  reports.tsx  notifications.tsx
app/contractor/nav.ts            Live unread-notification badge on the nav item
app/contractor/{page,workers,attendance,bills,documents,reports,notifications}/page.tsx
scripts/test-workforce.ts        Executable data-layer verification (121 assertions, npx tsx)
```

**All records are fictional.** Workers, attendance, gate logs, bills, payments,
documents, incidents and notifications are synthetic and generated from a fixed
demo clock (2026-10-03). KPIs, tables and charts all read the same collections,
so a mutation can never make two widgets disagree.

**Nothing is counted on a page.** Totals, donuts, trends and exports derive from
`computeKpis` / `filterWorkers` / `documentsInTab` / `attendanceTrend`. Statuses
are derived from dates, never stored — an expired certification or lapsed
document can never present as valid.

**Permissions are enforced in the action, not only the UI.** `can(perm)` disables
the control with an explanatory tooltip; the same check runs inside each action,
so calling it directly as Read-Only Viewer throws. Destructive actions confirm
first and never delete history.

`NEXT_PUBLIC_WORKFORCE_DATA_MODE` defaults to `mock`; `http` selects typed
adapters that throw named TODO errors for the proposed `/contractor/*` routes —
mock data is never substituted after an HTTP failure (see
`docs/contractor-workforce-api.md`).

The contractor portal is permission-scoped to the demo company **Eastern Mining
Services Pvt. Ltd.** (`DEMO-CONT-001`, user Rakesh Kumar) assigned to **Bharat
Coal Mine (BCM-01)**, **North Block Mine (NBM-02)** and **East Field Mine
(EFM-03)**. The header mine selector (and the chart's own selector) offer
`All Mines` plus only these three; the selection persists across navigation and
reload and drives the list, KPI cards, donut, milestones and filters.

**Requests are never contracts.** A submitted New Contract Request lands in a
separate `requests` collection (status `Pending Review`); a renewal lands in
`renewals` and does **not** change the parent contract's end date or value. The
contractor cannot approve, terminate or modify official contracts. A
`Requests & Renewals` panel makes the pending items visible so nothing looks
"stuck".

`RoleShell.tsx` was extended with **optional** props (`mineOptions`,
`mineValue`, `onMineChange`, `profileSub`) that render an interactive mine
dropdown and a profile menu **only when the contracts page passes them**. All
other contractor and inspector pages pass the old static `mineName` and render
exactly as before — verified by route smoke tests.

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

## Cross-page consistency (Contractor My Contracts, verified behaviors)

- **Mine selection** → header selector, list, 4 KPI cards, donut, milestones and filter options all update together and persist across navigation + reload.
- **Status tab / search / filters** → list, result counts and Export scope update together; every active filter is a removable chip.
- **Donut slice click** → sets the work-type filter and switches to the All Contracts tab.
- **New Contract Request (3-step)** → validated, stored in `requests` (Pending Review), audit + activity + notification appended, `Requests & Renewals` panel shows it, and the contract count/Active tab are **unchanged** (a request is not a contract).
- **Renewal request** → stored in `renewals` (Pending Review) linked to the contract; the parent contract's end date and value stay unchanged; renewal is only offered for eligible (Active/Expiring Soon) contracts.
- **Milestone submit / upload / clarify** → milestone status, document ref, activity history and audit update; the contractor can never set a milestone to "Approved".
- **Upload document** → appears in the contract's Documents tab and logs activity + audit (simulated local reference, no server).
- **Export CSV** → downloads a real file of the in-scope rows respecting mine, tab, search and filters.
- **Reset demo data** → restores the original deterministic dataset and clears localStorage.

## Environment

See `.env.example`. `NEXT_PUBLIC_API_BASE_URL` must be browser-reachable.
`NEXT_PUBLIC_DGMS_DATA_MODE=mock` (default) or `http` (only after confirming
every endpoint in `lib/dgms/api.ts`).
`NEXT_PUBLIC_OPS_DATA_MODE=mock` (default) or `http` (only after confirming
every endpoint in `lib/ops/api.ts` — currently most are TODO).
`NEXT_PUBLIC_CONTRACTS_DATA_MODE=mock` (default) or `http` (only after
confirming every proposed endpoint in `lib/contracts/api.ts` and
`docs/contractor-contracts-api.md`).
`NEXT_PUBLIC_WORKFORCE_DATA_MODE=mock` (default) or `http` (only after
confirming every proposed `/contractor/*` endpoint in `lib/workforce/api.ts`
and `docs/contractor-workforce-api.md` — none are confirmed yet; http mode
throws a named TODO error rather than falling back to mock data).

## Checks run (2026-10-19)

- `npx tsc --noEmit` — clean (whole project).
- `npm run build` — compiled successfully, lint + type check clean, **49/49
  static pages**, no errors. All 8 contractor routes emitted:
  `/contractor` 12.2 kB · `contracts` 20.5 kB · `workers` 24 kB ·
  `attendance` 15.3 kB · `bills` 17.5 kB · `documents` 16.1 kB ·
  `reports` 9.38 kB · `notifications` 4.73 kB.
- Production smoke test on a **fresh port** (`next start -p 3100` — never built
  into a live `.next`): all 8 contractor routes return **200** and each was
  checked for its required reference-page markers (KPI titles, tab labels,
  chart titles, action buttons); no `Application error`, no error boundary, no
  SSR exceptions in the server log.
- `npx tsx scripts/test-workforce.ts` — **121/121 assertions pass** against the
  real store (see `docs/contractor-workforce-implementation.md` for the full
  coverage list).
- `npx tsx scripts/test-contracts.ts` — **45/45 assertions pass** against the
  real store: status tabs, search, structured filters, mine scoping/permission,
  request-vs-contract separation, renewal non-mutation, milestone workflow,
  upcoming milestones, persistence and reset.
- Dead-control sweep: no `alert()`, no `href="#"`, no empty `onClick`, and no
  "coming soon" placeholder anywhere in `app/contractor/**` or
  `components/**` — every control performs a store action, a real file
  download, a real navigation, or is a `PermBtn` disabled with an explanatory
  tooltip.
- Backend untouched: only `frontend/` files changed.

## Implementation report

See `frontend/docs/ops-implementation-report.md` for the Operations portal details and `frontend/docs/contractor-contracts-api.md` for the proposed contractor backend contract. The My Contracts page-by-page implementation notes and remaining TODOs are in `frontend/docs/contractor-contracts-implementation.md`. The workforce/compliance portal (Dashboard, Workers, Attendance, Bills, Documents, Reports, Notifications) implementation notes are in `frontend/docs/contractor-workforce-implementation.md`, with its proposed backend contract in `frontend/docs/contractor-workforce-api.md`.
