# Contractor "My Contracts" — Implementation Report

Implements page 2 of `MineNetr Contractor Dashboard (1)(1).pdf` on the existing
contractor portal, reusing the shared `RoleShell` layout, sidebar, header and
branding. All contract data is synthetic, centralized and FastAPI-ready.

## What was built

| Area | Files |
|---|---|
| Data layer | `lib/contracts/{types,seed,store,format,export,api,repositories}.ts` |
| UI | `components/contracts/{ui,drawer,dialogs}.tsx` |
| Page | `app/contractor/contracts/page.tsx` (rewritten from the thin API wrapper) |
| Layout extension | `components/RoleShell.tsx` (optional mine selector + profile dropdown) |
| Env / docs | `.env.example`, `docs/contractor-contracts-api.md`, this report |
| Verification | `scripts/test-contracts.ts` (executable, 45 assertions) |

## Design fidelity (reference page 2)

- Mining banner: "My Contracts" (navy/blue split), subtitle, description, and a
  `+ New Contract Request` button on the right, over a pit-bench SVG scene.
- 4 KPI cards: Total / Active / Expiring Soon / Completed, each with icon tile,
  count and context line ("Across N Mines", "Currently Ongoing", "Within 60
  Days", "This Year"). All counts derive from the store.
- 6 status tabs with live counts: All Contracts, Active, Upcoming, Expiring
  Soon, Completed, Terminated.
- Search, Filters and Export in the tab bar; active filters render as removable
  chips.
- Contract cards: status pill, work-type icon tile, name, Contract ID, mine
  name (code), Start / End date, Contract Value, Progress with bar, View
  Details and a working 3-dot menu (View Details, View Milestones, Download,
  View Documents, View Activity, Request Renewal — disabled when ineligible).
- Right column: Contract Value Overview donut (per-mine selector, center total
  in ₹ Crore, clickable slices) and Upcoming Milestones with "Due in N days".
- `Requests & Renewals` panel (extra, required by the spec) surfaces submitted
  requests that are **not** contracts.

## Data model decisions

- **Statuses are explicit on the record** (matching the reference seed) and a
  derived `isExpiringSoon(c)` adds date-window logic on top: an `Active`
  contract ending within `EXPIRY_WINDOW_DAYS` (60) also counts as expiring.
  The two never contradict because the date check only *adds* to the explicit
  status.
- **Demo clock** is fixed at `2026-10-03` (matches the existing
  `LightBanner` date). Days-until labels compute honestly from it, so the
  Annual Audit milestone shows "Due in 89 days" (the PDF's "80" was a
  reference inconsistency; we compute from dates).
- **9 seed contracts** — the 5 from the spec plus 2 Upcoming and 2 Terminated
  so every tab is populated (per spec §8). Because KPIs are derived, Total is
  9 (not the reference's 5) and the donut total is ₹46.80 Cr. This is the
  honest consequence of the "add contracts to populate Upcoming/Terminated"
  requirement; nothing is hardcoded.
- **Donut groups by `category`** (5 groups matching the reference legend) while
  cards show the more specific `workType`. Extra contracts map into the
  existing categories so the chart stays at 5 slices.
- **Requests vs contracts** are separate collections. `createContractRequest`
  and `requestRenewal` append to `requests` / `renewals` with status
  `Pending Review`. Renewal never mutates the parent contract's end date or
  value. The contractor cannot approve anything.

## Permission model

- The demo contractor (`DEMO-CONT-001`) is assigned mines M-01/M-02/M-03.
- `allowedMines()` restricts the mine selector and the request form's mine
  dropdown to those three (+ All Mines).
- `setSelectedMine` rejects ids outside the assignment; `createContractRequest`
  throws for an unassigned mine; `requestRenewal` and document/milestone
  actions throw for records owned by another contractor.
- Repository queries scope by the authenticated contractor id.

## Persistence

- Runtime mutations are mirrored to `localStorage`
  (`minenetr_contractor_contracts_v1`) with a schema version; the store
  rehydrates on load and falls back to a clean seed if the version changes.
- The selected mine persists separately so it survives navigation and reload.
- `Reset demo data` (bottom of the page) clears storage and restores the
  deterministic seed.

## HTTP adapter boundary

- `lib/contracts/api.ts` declares the central endpoint map. Auth and
  notification routes are marked `confirmed: true`; every contractor-contract
  route is `confirmed: false` (proposed).
- `repositories.ts` exposes a `ContractsRepository` interface with a mock
  implementation (store-backed) and an HTTP implementation that throws named
  `ContractsHttpError` TODOs for unconfirmed endpoints. There is **no** silent
  mock fallback after an HTTP failure.
- `NEXT_PUBLIC_CONTRACTS_DATA_MODE` selects the mode (default `mock`).
- The full proposed request/response contract is in
  `docs/contractor-contracts-api.md`.

## RoleShell extension (backward compatible)

Added optional props — `mineOptions`, `mineValue`, `onMineChange`,
`profileSub`. When `mineOptions` is provided the header renders a working mine
`<select>`; otherwise the previous static `mineName` block renders unchanged.
The avatar area becomes a dropdown (Dashboard / Logout) only for pages that
pass the new props. All other contractor and inspector pages were smoke-tested
and return 200 with unchanged markup.

## Verification (actually executed)

- `npx tsc --noEmit` — clean.
- `npm run build` — 49/49 static pages, no errors.
- Route smoke tests — `/contractor/contracts` 200 with page markers; all other
  `/contractor/*`, `/inspector/*` and `/login` routes 200.
- `npx tsx scripts/test-contracts.ts` — **45/45 pass** against the real store:
  reference values, status tabs, search (incl. combined with tab), structured
  filters (date window, value range, category), mine scoping + permission
  rejection + persistence, request-vs-contract separation, renewal
  non-mutation + eligibility guard, milestone submit workflow (status,
  submittedAt, contract `updatedAt`, audit, activity), upcoming milestones, and
  localStorage persistence/reset.

## Remaining TODOs

1. **Confirm the backend contract.** Every route in `lib/contracts/api.ts` marked
   `confirmed: false` and `docs/contractor-contracts-api.md` must be agreed with
   the FastAPI backend before `NEXT_PUBLIC_CONTRACTS_DATA_MODE=http` can be
   enabled. In particular, enforce contractor scoping and "no self-approval"
   server-side.
2. **Real file upload/download.** Document upload stores local metadata and
   View/Download are simulated. Wire them to a real object store once routes
   #9/#10 are confirmed.
3. **Live notifications.** The header bell reads the existing
   `/api/v1/notifications`; contract-specific notifications currently update the
   in-page store only. Connect them to the real feed.
4. **Status-change subscriptions.** Requests stay `Pending Review` until a
   mine-office action exists. Add an operator-side approval flow (out of scope
   here) and refresh the contractor view on status change.
5. **Unit tests in CI.** `scripts/test-contracts.ts` is executable via `npx tsx`
   but not wired into a CI step or a test runner.
