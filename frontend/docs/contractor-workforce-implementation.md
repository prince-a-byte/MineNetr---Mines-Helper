# Contractor Workforce & Compliance Portal — Implementation Report

> Scope: making **every** contractor portal page functional off one centralized
> synthetic repository, matching the design reference
> `MineNetr Contractor Dashboard (1).pdf` (8 pages), with every visible control
> wired to a real action.
>
> Data layer + API contract were delivered first and verified independently of
> the UI (`npx tsx scripts/test-workforce.ts` → **121 passed, 0 failed**).

## What was built

| Layer | Files |
| --- | --- |
| Domain model | `lib/workforce/types.ts` |
| Deterministic seed | `lib/workforce/seed.ts` |
| Central store + actions | `lib/workforce/store.ts` |
| Formatters | `lib/workforce/format.ts` |
| Real file exports | `lib/workforce/export.ts` |
| HTTP adapter (unconfirmed endpoints) | `lib/workforce/api.ts` |
| Repository interface + mock/http switch | `lib/workforce/repositories.ts` |
| Shared UI kit | `components/workforce/ui.tsx` |
| Shared page shell | `components/workforce/shell.tsx` |
| Route bodies | `app/contractor/page.tsx`, `…/workers`, `…/attendance`, `…/bills`, `…/documents`, `…/reports`, `…/notifications` (My Contracts pre-exists, unchanged) |
| Executable verification | `scripts/test-workforce.ts` |

Pages are wrapped in `<ContractorShell title sub>` so the sidebar, header, the
**permission-scoped mine selector**, the live unread-notification badge and the
toast layer are wired identically everywhere — no page re-implements them and
the mine selection persists across navigation and reloads.

## Design fidelity (reference pages 1, 3–8)

Every reference page's structure is reproduced: KPI row → tab bar → filtered
table → charts/drawer → toolbar with Export.

| Route | Reference | Main elements |
| --- | --- | --- |
| `/contractor` | page 1 | 4 KPIs, Worker Distribution donut (by mine, click re-scopes portal), Contract Overview, Attendance donut, Recent Activities, Pending Tasks, Quick Actions |
| `/contractor/workers` | page 3 | 5 KPIs, 5 tabs (All / Deployed by Mine / Training Status / Expiring Documents / Transfer History), 482-row table, Add Worker wizard, worker drawer with 7 sections |
| `/contractor/attendance` | page 4 | 5 KPIs, 5 tabs (Daily / Access Logs / Training / Leave / Gate Passes), mark-attendance + gate decisions with reasons, trend chart |
| `/contractor/bills` | page 5 | 4 KPIs, 5 tabs (All/Pending/Approved/Rejected/Payments), 3-step bill wizard, Payment Summary donut, Recent Transactions |
| `/contractor/documents` | page 6 | 4 KPIs, 5 tabs (All + 4 categories), Upcoming Expiries, Quick Actions, Upload dialog, per-contractor compliance |
| `/contractor/reports` | page 7 | 4 KPIs, 6 category tabs, charts, Recent Reports, Generate dialog, Quick Downloads |
| `/contractor/notifications` | page 8 | 4 KPIs, 7 tabs, summary donut with click-to-filter, deep links, Mark All Read |

## Data model decisions

**One dataset, many views.** Nothing is counted locally on a page. KPIs,
tables, donuts and the trend chart all read the same collections through
`computeKpis` / `filterWorkers` / `documentsInTab` / `attendanceTrend`, so a
mutation can never make two widgets disagree.

**Volume** (all deterministic — no `Math.random()` anywhere):

```
482 workers · 8 contractors · 777 training records · 482 attendance records
919 access events · 23 leave records · 18 gate passes · 12 bills · 8 payments
128 documents · 10 transfer requests · 24 incidents (+13 corrective actions)
24 notifications · 14 report definitions
```

Mine split 245 / 156 / 81 across Bharat Coal Mine (BCM-01), North Block Mine
(NBM-02) and East Field Mine (EFM-03) — identical mine ids to `lib/contracts`,
which is *reused* (`import { mines } from '../contracts/seed'`) so the workforce
portal and My Contracts can never drift.

**Allocation instead of randomness.** `allocateIdx(n, portions)` distributes an
exact number of records into buckets with smooth interleaving. That is how the
dataset reproduces the reference figures *exactly* while still looking mixed:
482 = 415 Present + 52 Absent + 8 On Leave + 7 Not Marked; 447 Active +
35 Blocked/Inactive; bills partition into ₹20.6 L approved + ₹6.8 L pending +
₹1.0 L rejected = ₹28.4 L billed.

**Statuses are derived, never stored.** An expired certificate can never render
as Valid because `trainingStatusOf()` computes it from `expiryDate` vs the demo
clock (and unverified ⇒ Pending Verification). Document status is derived the
same way — the 102 Valid / 18 Expiring / 8 Expired split falls out of the seeded
expiry dates rather than being a flag on the row.

**Coherence constraints are enforced, not assumed:**
- a worker belongs to an existing contractor and an assigned mine;
- a blocked/inactive worker is *never* shown Present today (the test asserts it);
- today's attendance is constrained by worker status before it is written;
- approving a transfer is the only thing that moves a worker's mine;
- historical attendance for the last 30 days is computed on demand by
  `derivedAttendance(worker, date)` and cached — 14k rows of history cost
  nothing in storage but still agree with today's live records.

**Demo clock** is `2026-10-03`, shared with the contracts module.

## Permission model

Five demo roles (`Project Manager`, `Site Supervisor`, `Mine Admin`,
`Inspector`, `Read-Only Viewer`) with an explicit `Permission` union (24
actions). Two properties matter:

1. `can(perm)` drives every `PermBtn`/`PermIconBtn` — denied controls are
   disabled *with an explanatory tooltip* rather than hidden, so the UI never
   advertises an action that does nothing.
2. The check is **inside** each action (`requirePerm`), not only in the UI —
   the test calls `actions.createWorker(...)` directly as Read-Only Viewer and
   asserts it throws. This is a demo affordance, not production security, and
   the tooltip says so.

Separation of duties preserved on purpose:
- the contractor **cannot approve its own bill** (Acknowledge is disabled on
  Pending bills with that reason stated);
- the contractor **cannot resolve its own incident** (Inspector/Mine Admin only);
- the contractor **cannot suspend its own record**;
- verification of an uploaded certification requires inspector/manager.

Destructive actions require confirmation and never delete history: deactivating
a worker keeps its attendance, training and access records, and the confirm copy
says so.

## Persistence

- `minenetr_contractor_workforce_v1` in `localStorage`, schema-versioned;
  a version mismatch silently reseeds.
- Seed loads deterministically on first visit; mutations are mirrored on every
  commit (≈0.5 MB payload — well under the quota; a quota failure degrades to
  in-memory demo instead of crashing).
- `resetDemo()` clears the key, restores the original dataset, clears the mine
  selection and default role — behind a confirmation dialog in the toolbar.
- Toasts are excluded from persistence.

## HTTP adapter boundary

`lib/workforce/api.ts` declares the whole URL map in one place with a
`confirmed` flag per route; `workforceFetch()` throws a named
`WorkforceHttpError` TODO for any unconfirmed route instead of guessing, and
failures propagate to the page — http mode never falls back to mock data.
`repositories.ts` exposes a typed `WorkforceRepository` with `mockRepo`
(delegating to the store) and `httpRepo`, selected by
`NEXT_PUBLIC_WORKFORCE_DATA_MODE` (added to `.env.example`).

See `docs/contractor-workforce-api.md` for the full proposed contract.

## Verification (actually executed)

```
npx tsc --noEmit                        → clean (whole project)
npx tsx scripts/test-workforce.ts       → 121 passed, 0 failed
npx tsx scripts/test-contracts.ts       → 45 passed, 0 failed
npm run build                           → compiled, lint + types clean, 49/49 static pages
http://localhost:3100/<route> smoke     → all 8 contractor routes 200 with real content
```

Route smoke test (production server, fresh port — never built into a live `.next`):

```
/                  200    /contractor              200    /contractor/contracts   200
/contractor/workers  200  /contractor/attendance   200    /contractor/bills       200
/contractor/documents 200 /contractor/reports      200    /contractor/notifications 200
```

Each route was additionally checked for its required reference-page markers
(KPI titles, tab labels, chart titles, action buttons) and for
`Application error` / `Internal Server Error` text — every marker present, no
error boundary hit, and the server log stayed free of SSR exceptions.

`scripts/test-workforce.ts` covers, against the real store (no mocked
internals): dataset shape · id uniqueness · relational coherence ·
status-vs-date derivation · exact KPI values · bill partition arithmetic ·
mine scoping · combined filters and search · permission enforcement inside
actions · worker create/update/deactivate · suspended-contractor and
inactive-worker deployment guards · transfer request→approve side-effects ·
expired-certification verify refusal + renew · bill submit/withdraw +
acknowledge-refusal · incident resolution rules + corrective-action evidence
requirement · document upload KPI impact · attendance/access decisions ·
30-day trend agreement with the live KPI · full demo reset ·
**leave approve → cancel (store-persisted, audited, notification deep-link
raised) · leave rejection refused on non-pending rows · gate pass issue → use ·
vehicle normalization · impossible validity window refused · read-only viewer
refused inside both actions.**

## Cross-page deep links (all verified against the target tab vocabulary)

Every notification, dashboard task and report "Open" link resolves to a real
tab on the destination page — none is ignored:

| Source | Link | Resolved by |
| --- | --- | --- |
| Store notification | `/contractor/workers?tab=All%20Workers` · `?tab=Transfer%20History` · `?tab=Training%20Status` | `workers.tsx` mount effect |
| Dashboard "Add Worker" | `/contractor/workers?new=1` | opens the Add Worker wizard on mount |
| Store notification | `/contractor/attendance?tab=Access%20Logs` · `?tab=Leave%20Management` | `attendance.tsx` mount effect |
| Store notification | `/contractor/bills?tab=Pending%20Bills` | `bills.tsx` `TAB_PARAM_MAP` (accepts `Pending`, `Pending Bills`, `All Bills`, `Approved (Bills)`, `Rejected (Bills)`, `Payments`) |
| Store notification | `/contractor/documents?tab=Contract%20Documents` · `?tab=Statutory%20Compliance` | `documents.tsx` mount effect against `TABS` |
| Reports / notifications | `/contractor/reports` and the links above | `useRouter().push` |

## Remaining TODOs

1. **Backend contract** is proposed only — every `/contractor/*` route must be
   agreed with FastAPI before `NEXT_PUBLIC_WORKFORCE_DATA_MODE=http` (checklist
   in `docs/contractor-workforce-api.md`).
2. **Certificate download** is a plain-text DEMO file because the project has no
   PDF library; it carries an explicit "not a statutory certificate" watermark.
   The **contract download** behaves the same way and its file states plainly
   that the official PDF comes from a still-proposed endpoint.
3. **Bulk Upload** (design reference, Workers page) was deliberately omitted —
   there is no upload backend, and a control that could not complete would be a
   dead affordance.
4. **RoleShell bell** still calls `GET /api/v1/notifications`; in mock mode the
   badge comes from the nav instead (live unread count from the store).
5. **`lib/workforce/api.ts`** exposes leave/gate-pass *reads* only; the new
   `decideLeave` / `issueGatePass` / `setGatePassStatus` mutations need
   matching proposed endpoints added to the endpoint map before `http` mode.
