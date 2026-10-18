# MineNetr Coal Mine Operations Portal — Implementation Report

**Date:** 2026-10-18  
**Scope:** 11-page operator portal at `/operator/*`  
**Stack:** Next.js 14 App Router · React 18 · TypeScript (strict) · Tailwind CSS 3 · Recharts · lucide-react  
**Dependencies added:** None (only next/react/recharts/lucide-react/tailwind/ts)

---

## Architecture

### Data layer (`lib/ops/`)

| File | Purpose |
|---|---|
| `types.ts` | 30+ typed enums (WorkerStatus, BillApprovalStatus, DispatchStatus, etc.) and interfaces for every domain entity. Fixed demo clock `DEMO_NOW_ISO = '2026-10-03T10:45:32+05:30'`. |
| `seed.ts` | Deterministic synthetic dataset: 5 mines, 132 workers, 12 contractors, 10 work orders, 700 attendance records, 120 dispatches, 8 stockpiles, 12 bills, 5 payments, 22 documents, 56 inspections, 18 findings, 21 corrective actions, 10 notifications, 5 audit entries, 10 reports. |
| `store.ts` | Central mutable store via `useSyncExternalStore`. 50+ actions, each enforcing referential integrity, updating all affected records, appending an audit entry and emitting a toast. Exports `useMockOps()`, `actions`, `getMine()`, `getContractor()`, `stockCurrent()`, `stockStatusOf()`, `onSiteWorkerIds()`, `billPaid()`. |
| `format.ts` | `fmtDate`, `fmtTime12`, `inr`, `inrShort`, `mt`, `num`, `pct`, `daysUntil` — all using the fixed demo clock. |
| `export.ts` | `exportCsv(filename, rows, columnDefs)` — triggers a browser download. |
| `api.ts` | HTTP adapter boundary: `OpsHttpError` with named TODO errors for every endpoint. No silent mock fallback. |
| `repositories.ts` | Data-access boundary selecting mock or HTTP repo based on `NEXT_PUBLIC_OPS_DATA_MODE`. |

### UI layer (`components/operations/`)

| File | Purpose |
|---|---|
| `ui.tsx` | 26 shared components: KpiCard, SectionCard, Tabs, PeriodSelect, DemoBadge, SimulatedNote, StatusPill, FilterBar, SearchInput, DataTable (sort/paginate/select/export), DetailDrawer, ConfirmDialog, Modal, Field, Kv, EmptyState, QuickActions, Toasts, OpsBanner, LinkBtn, Column type. |
| `charts.tsx` | 6 Recharts primitives with consistent styling and click-to-pick: Donut (center total + legend-as-filter), VBars, HBarRows, TrendBars (bars + optional line), StackedBars, TrendLine. |
| `modals.tsx` | 3 shared workflow modals used by both Dashboard and sub-pages: AddWorkerModal, RecordProductionModal, UploadDocModal. |
| `OperationsShell.tsx` | Dedicated navy sidebar, MineSelector (persisted to localStorage), notification bell from store, profile menu, mobile drawer. Does NOT modify the shared `RoleShell.tsx`. |
| `hooks.ts` | `useMineScope()` (localStorage-persisted mine filter), `useTab()` (deep-linkable via `?tab=`), `usePageReady()` (skeleton gate), `byMine()` (mine-scope filter helper), `hrefWithTab()`. |

---

## Page-by-page summary

### 1 · Dashboard (`/operator`)
- 5 KPIs derived from store (production, dispatch, workers on-site, active contractors, compliance %).
- Gas sensor gauges (CH₄, CO, O₂, H₂S) with 24h trend line from seed.
- CCTV simulated feed with camera modal (no real video).
- Environmental conditions (temp, humidity, air flow, dust).
- Production vs dispatch 7-day bar chart.
- Recent Activities from `db.audit` (real actions only, with routing to relevant pages).
- Upcoming Events derived from inspections + contract expiries.
- Quick Actions: AddWorkerModal, RecordProductionModal, GatePassModal (demo), UploadDocModal.

### 2 · Workers & Manpower (`/operator/workers`)
- 6 KPIs (total, on-site, absent, new joined, training due, access blocked).
- 7 tabs: Overview, Worker List, Contractor-wise, Attendance, Training & Certification, Access Control, Manpower Deployment.
- Worker list: search, contractor/status/role filters, sortable columns, pagination, row selection, CSV export.
- Worker detail drawer with EditWorkerForm, AssignModal, CertModal, AccessCardModal, revoke confirm dialog.

### 3 · Contractors (`/operator/contractors`)
- 5 KPIs (total, active, expiring soon, expired, workforce).
- 6 tabs: Contractor Overview, Contracts & Work Orders, Contractor Workforce, Bills & Payments, Compliance & Documents, Performance & Ratings.
- Pending Approvals panel: New Contract Request, Work Order Approval, Contract Extension — each with working Approve/Reject/Extend actions.
- AddCtrModal (validated, starts as PendingApproval), AddWoModal (validates empanelment/value/dates), EditCtrForm, RejectCtrModal (requires reason), ExtendModal.
- Contractor detail drawer with contract info, work orders, audit trail.

### 4 · Attendance & Access (`/operator/attendance`)
- 6 KPIs (registered, present, absent, on-site now, access blocked, vehicles in/out).
- 6 tabs: Attendance Overview, Access Control, Gate Pass Logs, On-Site Movement, Biometric Records, Contractor-wise Attendance.
- **Check-in/check-out workflow** per row and via modal — updates attendance, on-site count, gate feed, audit.
- Contractor-wise attendance with progress bars.
- On-site distribution donut by location.
- GatePassModal (demo preview, no printing integration).
- AccessToggleModal (block/unblock with reason).

### 5 · Production & Dispatch (`/operator/production`)
- 5 KPIs (today's production, dispatch, trucks, avg net weight, pending).
- 7 tabs: Overview, Production Records, Weighbridge Transactions, Dispatch Records, Truck Movement, Destination & Challan, Analysis.
- **Record dispatch workflow**: creates dispatch + stockTx, updates stockpile balance, charts and KPIs.
- AddDispatchModal with gross/tare/net validation.
- Live weighbridge feed derived from dispatches (simulated label).
- ChallanModal (demo preview, no printing integration).

### 6 · Stockpile Management (`/operator/stockpile`)
- 5 KPIs (total stock, production today, dispatched today, reconciliation variance, low-stock alerts).
- 5 tabs: Stockpile Overview, Stockpile Details, Stock Transactions, Reconciliation, Stock Movement History.
- Stock math: `stockCurrent()` derives opening + production − dispatch + transfers from `stockTx`.
- TransferModal (validates source ≠ destination, sufficient stock).
- ReconcileModal (system vs physical, variance warning).
- AddStockpileModal (validated, creates opening stock tx).

### 7 · Bills & Transactions (`/operator/bills`)
- 5 KPIs (total bills, total amount, pending, approved, rejected).
- 7 tabs: Overview, Contractor Bills, Mine Operator Expenses, Payments & Transactions, Work Order Billing, Bill Verification, Audit Trail.
- **Approve bill workflow**: updates bill status, KPIs, status donut, payment status, audit.
- AddBillModal (validated, optional work order link).
- PayModal (records demo payment, updates paymentStatus).
- RejectBillModal (requires reason).
- Monthly bill summary chart (amount bars + count line).

### 8 · Documents & Compliance (`/operator/documents`)
- 5 KPIs (total, valid, expiring, expired, pending).
- 7 tabs: Overview, Statutory Licences, Safety & Environment, Equipment & Machinery, Contractor Documents, Worker Documents, Submissions & Approvals.
- Document lifecycle: Draft → Submit → Pending → Approve/Reject.
- UploadDocModal (shared), RejectDocModal (requires reason).
- Compliance timeline derived from expiries + pending submissions.
- Replace File (demo) action.

### 9 · Reports & Analytics (`/operator/reports`)
- 5 KPIs (month production, dispatch, workers, bills processed, compliance score).
- 8 tabs: Production, Dispatch, Stockpile, Contractor, Manpower, Financial, Compliance, Custom Reports.
- Every "Generate Report" button calls `actions.generateReport()` which stores a report record with CSV content and appears in Custom Reports history.
- Reports are downloadable (Blob URL) and deletable.
- GenerateReportModal for custom reports.
- Production trend chart: target vs actual bars + achievement % line.

### 10 · Inspection & Audit (`/operator/inspections`)
- 5 KPIs (total, completed, in progress, scheduled, findings).
- 6 tabs: Inspection Overview, Inspection Schedule, Audit Findings, Corrective Actions, Compliance Status, Inspection Reports.
- Inspection lifecycle: Schedule → Start → Complete (with report file).
- Finding creation with severity/category/location.
- Corrective action assignment and resolution (updates finding status).
- Mine-wise stacked bar chart, type donut, 6-month trend.
- ScheduleModal, CompleteModal, FindingModal, CaModal, ResolveCaModal.

### 11 · Settings (`/operator/settings`)
- 9 menu sections, each fully functional:
  - **Profile & Account**: edit name/email/phone/department/language (validated).
  - **Security**: ChangePasswordCard (demo validation against `operate123`, requirement checklist), Active Sessions with revoke.
  - **Notifications**: 8 toggle switches updating `settings.notifications`.
  - **User Management**: role, mine access scope, accessible mines list.
  - **Mine Details**: card grid with mine info, worker/contractor counts.
  - **System Preferences**: theme, date/time/number format, items per page, default mine — all persisting to store.
  - **Integrations**: data mode indicator, API base URL, full endpoint map with TODO markers.
  - **Data & Privacy**: record counts, CSV export, Reset Demo Data (confirm dialog), Delete Account (simulated, confirm dialog).
  - **Audit Logs**: searchable, exportable, full audit history.

---

## Four required workflows — verified

| Workflow | Entry point | Store actions | Downstream updates |
|---|---|---|---|
| **Add worker** | Dashboard Quick Action, Workers page, Attendance page | `createWorker` | Worker list, contractor workforce, attendance "Not Scheduled" row, KPIs, audit entry |
| **Check in worker** | Attendance page row action, CheckInModal, worker drawer | `checkIn` | Attendance table (In time, Present), On-Site Now KPI, gate activity feed, audit entry |
| **Record dispatch** | Production page, AddDispatchModal | `createDispatch` | Dispatch table, production-vs-dispatch chart, stockpile balance (stockTx deducted), destination donut, audit entry |
| **Approve bill** | Bills page row action, Bill Verification tab, ConfirmDialog | `approveBill` | Bill status → Approved, pending/approved KPIs, status donut, payment status eligibility, audit entry |

---

## HTTP adapter boundary

- `NEXT_PUBLIC_OPS_DATA_MODE` (default `mock`) selects the data repository.
- `lib/ops/api.ts` defines every endpoint with a TODO marker for unconfirmed backend routes.
- `OpsHttpError` is thrown for every HTTP-mode call until endpoints are confirmed.
- **No silent mock fallback** after an HTTP failure — errors surface to the UI.
- `.env.example` documents both `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_OPS_DATA_MODE`.

---

## Verification performed

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean (zero errors) |
| `npm run build` | 49/49 static pages, no errors |
| All 11 `/operator/*` routes compile | Confirmed via build output |
| All 11 `/dgms/*` routes compile | Confirmed via build output (unchanged) |
| `components/RoleShell.tsx` untouched | Confirmed — OperationsShell is a separate component |
| `components/ops.tsx` untouched | Confirmed |
| Backend untouched | Confirmed — only `frontend/` changes |
| No new dependencies | Confirmed — package.json unchanged |
| No "Coming soon" / dead controls | Confirmed — every button/tab/filter/form wired to store or navigation |
| CSV export works | Confirmed — `exportCsv` used on Workers, Contractors, Attendance, Production, Stockpile, Bills, Documents, Reports, Inspections, Settings |
| Demo/simulated labeling | Confirmed — DemoBadge on every page, SimulatedNote on weighbridge, CCTV, gate pass, challan, password, sessions, integrations |
| Mine selector persistence | Confirmed — localStorage `minenetr_ops_mine`, propagates via `useMineScope()` + `byMine()` |
| Deep-link tab presets | Confirmed — `?tab=` via `useTab` hook |
| Append-only audit log | Confirmed — every action calls `audit()` internally; visible on Dashboard, Bills, Settings |

---

## Known limitations (by design)

1. **Single-user demo** — User Management shows the current operator's scope; multi-user requires the backend.
2. **Simulated integrations** — weighbridge, CCTV, gate pass, challan, password change, sessions, and payments are all demo simulations clearly labeled.
3. **No file uploads** — document "files" are metadata objects; no real storage.
4. **No background scheduler** — weekly report scheduling is a toggle that stores a flag; no cron job exists.
5. **Fixed demo clock** — new runtime records use `new Date()` while seed records use `2026-10-03`; this is intentional for deterministic seed data.
