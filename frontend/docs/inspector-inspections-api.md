# Mine Inspector — My Inspections: data architecture & proposed API contract

> **Status:** the frontend module is complete and runs entirely on the
> centralized synthetic repository in `lib/inspections/`. Every inspector
> endpoint below is **PROPOSED** (`confirmed: false`) and must be agreed with
> the FastAPI backend before `NEXT_PUBLIC_INSPECTIONS_DATA_MODE=http` is
> enabled. Nothing here is a live DGMS integration.

- Demo clock: **03 Oct 2026** (shared with the contracts/workforce modules).
- Data mode: `NEXT_PUBLIC_INSPECTIONS_DATA_MODE` = `mock` (default) | `http`.
- Repository: `lib/inspections/repositories.ts` → `inspectionRepository`.
- Store: `lib/inspections/store.ts` → `useMockInspections()` + `actions`.

---

## 1. Feature structure

```
lib/inspections/
  types.ts          domain model, statuses, filters, permissions, seed snapshot
  seed.ts           deterministic synthetic dataset (the only data source)
  store.ts          repository: selectors + every mutation with validation
  format.ts         demo-clock dates, derived status, tones, month grid
  export.ts         watermarked DEMO text/CSV downloads
  api.ts            endpoint map + HTTP adapter (all inspector routes unconfirmed)
  repositories.ts   InspectionRepository interface, mock + http implementations

components/inspections/
  ui.tsx            shared kit (chips, PermBtn, toolbar, meters, stepper,
                    location preview, menus, empty/error states, toast host)
  main.tsx          My Inspections page (KPIs, tabs, table, details panel)
  detail.tsx        individual inspection workflow (4 steps, 6 tabs)
  schedule.tsx      Inspection Schedule (calendar + list, shared data)
  templates.tsx     Checklists & Forms (template library + preview)
  findings.tsx      Findings & Observations wired to the shared store
  evidence.tsx      Photos & Evidence library wired to the shared store
  reports.tsx       Reports list generated from submitted inspections

app/inspector/
  inspections/page.tsx            My Inspections (page 2 of the reference)
  inspections/[id]/page.tsx       individual inspection (page 3)
  schedule/page.tsx               Inspection Schedule (page 4)
  checklists/page.tsx             Checklists & Forms (page 5)
  findings/page.tsx               Findings & Observations
  evidence/page.tsx               Photos & Evidence
  reports/page.tsx                Reports
```

---

## 2. Proposed endpoints

`lib/inspections/api.ts` is the only place URLs are declared.

### Confirmed (already exist on the backend today)

| key | method | path |
|---|---|---|
| `login` | POST | `/auth/login` |
| `notifications` | GET | `/notifications` |
| `roleOverview` | GET | `/role/overview` |

### TODO — inspector routes (all `confirmed: false`)

| key | method | path |
|---|---|---|
| `inspector` | GET | `/inspector/me` |
| `inspectorMines` | GET | `/inspector/mines` |
| `inspections` | GET | `/inspector/inspections` |
| `inspectionById` | GET | `/inspector/inspections/{id}` |
| `createInspection` | POST | `/inspector/inspections` |
| `updateInspection` | PATCH | `/inspector/inspections/{id}` |
| `startInspection` | POST | `/inspector/inspections/{id}/start` |
| `saveDraft` | POST | `/inspector/inspections/{id}/draft` |
| `submitInspection` | POST | `/inspector/inspections/{id}/submit` |
| `cancelInspection` | POST | `/inspector/inspections/{id}/cancel` |
| `reschedule` | POST | `/inspector/inspections/{id}/reschedule` |
| `reassign` | POST | `/inspector/inspections/{id}/reassign` |
| `bulkCancel` | POST | `/inspector/inspections/bulk-cancel` |
| `workflowStep` | PATCH | `/inspector/inspections/{id}/workflow` |
| `checklist` | GET | `/inspector/inspections/{id}/checklist` |
| `checklistResponse` | PUT | `/inspector/inspections/{id}/checklist/{itemId}` |
| `siteDetails` | PUT | `/inspector/inspections/{id}/site-details` |
| `evidence` | GET | `/inspector/inspections/{id}/evidence` |
| `addEvidence` | POST | `/inspector/inspections/{id}/evidence` |
| `updateEvidence` | PATCH | `/inspector/evidence/{evidenceId}` |
| `removeEvidence` | DELETE | `/inspector/evidence/{evidenceId}` |
| `linkEvidence` | POST | `/inspector/evidence/{evidenceId}/link` |
| `findings` | GET | `/inspector/inspections/{id}/findings` |
| `allFindings` | GET | `/inspector/findings` |
| `createFinding` | POST | `/inspector/inspections/{id}/findings` |
| `updateFinding` | PATCH | `/inspector/findings/{findingId}/status` |
| `reports` | GET | `/inspector/reports` |
| `reportById` | GET | `/inspector/reports/{id}` |
| `previousReports` | GET | `/inspector/inspections/{id}/previous-reports` |
| `reportDownload` | GET | `/inspector/reports/{id}/download` |
| `notes` | GET/POST | `/inspector/inspections/{id}/notes` |
| `updateNote` / `deleteNote` | PATCH/DELETE | `/inspector/notes/{noteId}` |
| `documents` | GET/POST | `/inspector/inspections/{id}/documents` |
| `documentDownload` | GET | `/inspector/documents/{docId}/download` |
| `checklistTemplates` | GET | `/inspector/checklist-templates` |
| `templatePreview` | GET | `/inspector/checklist-templates/{id}` |
| `schedule` | GET | `/inspector/schedule` |
| `requests` | GET | `/inspector/requests` |
| `decideRequest` | POST | `/inspector/requests/{requestId}/decision` |
| `evidenceLibrary` | GET | `/inspector/evidence` |

---

## 3. Key request / response shapes

### `POST /inspector/inspections/{id}/start`

Request: empty body. Server validates:
1. `assigned_to == current_user`,
2. `status == Upcoming`,
3. the checklist template resolves to ≥ 1 item.

Response `200`:
```json
{ "id": "INS-2026-014", "status": "In Progress", "started_at": "2026-10-03T09:12:04+05:30", "workflow_step": 0 }
```
Server side-effects: initialise one `Not Checked` response per checklist item,
append an activity row.

### `PUT /inspector/inspections/{id}/checklist/{itemId}`

```json
{ "response": "Non-Compliant", "remarks": "Berms washed out near chainage 1.2 km",
  "evidence_ids": ["EVD-004"] }
```
Server-side rules (`lib/inspections/store.ts` mirrors them today):
- item must belong to the inspection's template,
- inspection must not be Completed/Cancelled,
- `Non-Compliant` on an `evidence_required` item requires ≥ 1 evidence id,
- response recomputes section completion and may move the inspection
  `In Progress ↔ Pending Submission`.

### `POST /inspector/inspections/{id}/submit`

Request: empty body (the confirmation dialog is a UI concern).
Server must re-validate — **never trust the client**:

| rule | error message |
|---|---|
| not started | `Start the inspection before submitting it.` |
| any item `Not Checked` | `Complete all required checklist items before submitting this inspection — still unanswered: <section (n), …>.` |
| site details incomplete | `Complete the Site Details tab before submitting — missing: <field, …>.` |
| evidence below `required_evidence_count` | `Attach at least N evidence records before submitting (currently M).` |

Response `200`:
```json
{ "id": "INS-2026-014", "status": "Completed",
  "submitted_at": "2026-10-03T11:42:10+05:30",
  "report": { "id": "RPT-016", "status": "Submitted", "version": 1 } }
```
Server side-effects: set `Completed`, stamp `submitted_at`, generate/refresh the
report from live counts, append activity. The schedule, KPIs and the My
Inspections table all read the same row afterwards.

### `POST /inspector/inspections/{id}/reschedule`

```json
{ "to_date": "2026-10-14", "reason": "Blasting programme moved to the 13th" }
```
- supervisory role → applied immediately, response `200 { "applied": true }`,
- inspector role → creates `RescheduleRequest` with `status = "Pending Approval"`,
  response `201 { "applied": false, "request_id": "REQ-004" }`.
Same contract for `/reassign` and `/cancel`.

### `POST /inspector/requests/{requestId}/decision`

```json
{ "approved": true, "note": "Approved — revised blast schedule." }
```
Only supervisory roles; applying the decision mutates the shared inspection row
so the schedule updates without a second write path.

### Error contract

Every failure returns `4xx/5xx` with `{ "detail": "<human readable message>" }`.
`InspectionsHttpError` surfaces `detail` straight into the page's inline error
component. HTTP mode never falls back to mock data after a failure.

---

## 4. Repository interface

`lib/inspections/repositories.ts`:

```ts
interface InspectionRepository {
  getInspections(filters?): Promise<Inspection[]>;
  getInspectionById(id): Promise<Inspection | null>;
  createInspection(input): Promise<Inspection>;
  updateInspection(id, patch): Promise<Inspection>;
  startInspection(id): Promise<Inspection>;
  saveInspectionDraft(id, draft): Promise<Inspection>;
  submitInspection(id): Promise<Inspection>;
  getChecklistResponses(id): Promise<ChecklistResponse[]>;
  saveChecklistResponse(input): Promise<ChecklistResponse>;
  addEvidence(input): Promise<Evidence>;
  removeEvidence(id): Promise<void>;
  getFindings(id): Promise<InspectionFinding[]>;
  createFinding(input): Promise<InspectionFinding>;
  getReports(id): Promise<InspectionReport[]>;
}
```

Interactive pages subscribe reactively via `useMockInspections()` and mutate via
`actions`, which implement exactly these semantics. Switching to HTTP is a
matter of updating `httpInspectionRepository` + the endpoint map — **no page
changes**.

---

## 5. Persistence

| concern | implementation |
|---|---|
| storage key | `minenetr_inspector_inspections_v1` |
| schema version | `1` — a mismatch reseeds instead of hydrating stale shapes |
| what persists | statuses, checklist responses, site details, workflow step, notes, evidence, findings, documents, reschedule requests, activity, role, mine scope |
| what never persists | toasts (re-derived each session) |
| SSR safety | all `localStorage` access is guarded by `typeof window === 'undefined'` |
| reset | `actions.resetDemo()` behind a confirmation dialog (`ResetInspectionsBtn`) |

---

## 6. Rollout checklist for the backend

1. Agree the endpoint map above (or replace it) and set `confirmed: true`.
2. Implement server-side equivalents of the validation rules in
   `lib/inspections/store.ts` — client checks are a demo affordance only.
3. Keep `Overdue` derived (or store it with the same rule) so the tab counts
   stay stable.
4. Move reschedule/reassign/cancel behind an approval table (the
   `RescheduleRequest` shape is the proposed schema).
5. Serve checklist templates + items from one table so `/inspector/checklists`
   and the inspection workflow keep sharing definitions.
6. Add a real file store for evidence/documents; the demo writes
   `DEMO-FILE://…` references and plain-text sample downloads.
7. Re-enable `NEXT_PUBLIC_INSPECTIONS_DATA_MODE=http` in a staging environment
   and run `npx tsx scripts/test-inspections.ts` against the mock contract.
