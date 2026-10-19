# Contractor Workforce & Compliance — Proposed Backend API Contract

> **Status: PROPOSED — not confirmed.** The MineNetr FastAPI backend today
> exposes only `POST /api/v1/auth/login`, `GET /api/v1/notifications` and
> `GET /api/v1/role/overview`. Every contractor workforce route below is a
> proposed mapping and is marked `confirmed: false` in
> `lib/workforce/api.ts`. Do **not** treat any path here as a live contract.
>
> The portal runs in **mock mode** by default
> (`NEXT_PUBLIC_WORKFORCE_DATA_MODE=mock`) against the centralized synthetic
> repository in `lib/workforce/store.ts`. Switching to `http` mode before these
> endpoints exist will throw a named `WorkforceHttpError` TODO for each
> unconfirmed route — it never falls back to mock data.

## Base URL & auth

- Base URL: `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`), path prefix `/api/v1`.
- Auth: `Authorization: Bearer <JWT>` on every request (same token as login).
- Contractor scoping: the backend must derive `contractor_id` from the token.
  The client never supplies an authoritative contractor id; every query is
  filtered server-side to the authenticated contractor's own records.
- Mine scoping: `selectedMineId` is a *view preference* only. A request may pass
  `?mine_id=M-01`, but the server must intersect it with the mines the
  contractor is actually authorised for.

## Confirmed vs proposed endpoints

| Status | Routes |
| --- | --- |
| **CONFIRMED** (exist today) | `POST /auth/login`, `GET /notifications`, `GET /role/overview` |
| **TODO / proposed** | every `/contractor/*` route in the table below |

`lib/workforce/api.ts` guards this: `workforceFetch()` refuses to call an
unconfirmed endpoint and throws
`WorkforceHttpError("TODO: endpoint … is not yet confirmed with the backend")`
so a misconfigured http mode fails loudly instead of silently serving mock data.

## Proposed endpoint map

| Key (`WORKFORCE_ENDPOINTS`) | Method + path | Purpose |
| --- | --- | --- |
| `mines` | `GET /contractor/mines` | Mines the contractor may deploy to |
| `contractors` | `GET /contractor/contractors` | Partner/self contractor records |
| `contractorById` | `GET /contractor/contractors/{id}` | Single contractor |
| `createContractor` | `POST /contractor/contractors` | Onboard partner contractor |
| `updateContractor` | `PATCH /contractor/contractors/{id}` | Edit contractor |
| `setContractorStatus` | `PATCH /contractor/contractors/{id}/status` | Suspend / reactivate |
| `workers` | `GET /contractor/workers` | Worker register (filters below) |
| `workerById` | `GET /contractor/workers/{id}` | Worker + drawer sections |
| `createWorker` | `POST /contractor/workers` | Add worker |
| `updateWorker` | `PATCH /contractor/workers/{id}` | Edit worker |
| `setWorkerStatus` | `PATCH /contractor/workers/{id}/status` | Deactivate / reactivate / block |
| `deployWorker` | `PATCH /contractor/workers/{id}/deployment` | Mine / department / shift / zone |
| `training` | `GET /contractor/training` | Certification register |
| `createTraining` | `POST /contractor/training` | Add certification |
| `updateTraining` | `PATCH /contractor/training/{id}` | Edit certification |
| `verifyTraining` | `POST /contractor/training/{id}/verify` | Verification (inspector/manager) |
| `renewTraining` | `POST /contractor/training/{id}/renew` | Renew expired/expiring certificate |
| `attendance` | `GET /contractor/attendance` | Today's attendance (filters below) |
| `attendanceTrend` | `GET /contractor/attendance/trend?days=&mine_id=` | Daily series |
| `markAttendance` | `PATCH /contractor/attendance/{workerId}` | Mark today's attendance |
| `accessLogs` | `GET /contractor/access` | Gate log |
| `decideAccess` | `POST /contractor/access/{id}/decision` | Allow / deny / block / revoke |
| `leaves` | `GET /contractor/leaves` | Leave register |
| `decideLeave` | `POST /contractor/leaves/{id}/decision` | Approve / reject / cancel |
| `gatePasses` | `GET /contractor/gate-passes` | Gate pass register |
| `issueGatePass` | `POST /contractor/gate-passes` | Issue a numbered pass |
| `setGatePassStatus` | `PATCH /contractor/gate-passes/{id}/status` | Use / revoke (expired is immutable) |
| `bills` | `GET /contractor/bills` | Bill register |
| `submitBill` | `POST /contractor/bills` | Submit bill (→ Pending) |
| `withdrawBill` | `POST /contractor/bills/{id}/withdraw` | Withdraw own pending bill |
| `acknowledgeBill` | `POST /contractor/bills/{id}/acknowledge` | Acknowledge mine decision |
| `payments` | `GET /contractor/payments` | Payment register |
| `documents` | `GET /contractor/documents` | Document register |
| `uploadDocument` | `POST /contractor/documents` | Upload (multipart) |
| `downloadDocument` | `GET /contractor/documents/{id}/download` | Fetch stored blob |
| `transfers` | `GET /contractor/transfers` | Transfer requests |
| `createTransfer` | `POST /contractor/transfers` | Raise transfer |
| `decideTransfer` | `POST /contractor/transfers/{id}/decision` | Approve / reject / cancel |
| `incidents` | `GET /contractor/incidents` | Non-compliance register |
| `createIncident` | `POST /contractor/incidents` | Raise incident |
| `commentIncident` | `POST /contractor/incidents/{id}/comments` | Timeline comment |
| `setIncidentStatus` | `PATCH /contractor/incidents/{id}/status` | Under review / resolved / dismissed |
| `assignInspector` | `POST /contractor/incidents/{id}/assign` | Assign inspector |
| `correctiveActions` | `GET /contractor/corrective-actions` | Corrective actions |
| `createCorrectiveAction` | `POST /contractor/corrective-actions` | Create + assign |
| `updateCorrectiveAction` | `PATCH /contractor/corrective-actions/{id}` | Progress + evidence |
| `reviewCorrectiveAction` | `POST /contractor/corrective-actions/{id}/review` | Inspector review |
| `reports` | `GET /contractor/reports` | Generated report list |
| `generateReport` | `POST /contractor/reports/generate` | Queue report |
| `downloadReport` | `GET /contractor/reports/{id}/download` | Report file |
| `portalNotifications` | `GET /contractor/notifications` | Workforce notifications |
| `markNotificationsRead` | `POST /contractor/notifications/read-all` | Bulk read |
| `kpis` | `GET /contractor/kpis` | Optional server-side KPI roll-up |

## Data shapes

```ts
// Enumerations (mirror lib/workforce/types.ts)
WorkerStatus      = "Active" | "Inactive" | "Blocked"
AttendanceStatus  = "Present" | "Absent" | "On Leave" | "Not Marked"
TrainingStatus    = "Valid" | "Expiring Soon" | "Expired" | "Pending Verification"
AccessStatus      = "Allowed" | "Denied" | "Blocked" | "Revoked"
LeaveStatus       = "Pending" | "Approved" | "Rejected" | "Completed" | "Cancelled"
GatePassStatus    = "Issued" | "Used" | "Expired" | "Revoked"
BillStatus        = "Pending" | "Approved" | "Rejected"
DocumentStatus    = "Valid" | "Expiring Soon" | "Expired"      // derived from expiryDate
TransferStatus    = "Pending" | "Approved" | "Rejected" | "Cancelled"
IncidentStatus    = "Open" | "Under Review" | "Action Required" | "Resolved" | "Dismissed"
Severity          = "Low" | "Medium" | "High" | "Critical"
ContractorStatus  = "Active" | "Suspended" | "Completed" | "Pending"
CorrectiveStatus  = "Not Started" | "In Progress" | "Submitted" | "Approved" | "Rejected"

Worker {
  id: string                 // "WORK-0001"
  name: string
  contractorId: string       // FK → Contractor (server-validated)
  designation: string
  department: string
  mineId: string             // "M-01"
  contact: string            // 10-digit, ^[6-9]\d{9}$
  joiningDate: string        // "YYYY-MM-DD"
  emergencyContact: string
  gender: "Male" | "Female"
  status: WorkerStatus
  shift: "A" | "B" | "C"
  workZone: string
  supervisor: string
}

TrainingRecord {
  id: string                 // "CERT-0001"
  workerId: string           // FK → Worker
  type: string
  certificationNumber: string
  completionDate: string     // must be ≤ today
  expiryDate: string         // must be > completionDate
  provider: string
  mandatory: boolean
  verified: boolean
  // status is NOT stored: clients derive it from expiryDate + verified
}

AttendanceRecord {
  id: string; workerId: string; date: string
  status: AttendanceStatus
  inTime: string; outTime: string   // "HH:MM" | "—"
  gate: string; method: "Biometric" | "Manual"
}

AccessRecord {
  id: string; workerId: string; contractorId: string; mineId: string
  gate: string; status: AccessStatus; timestamp: string   // ISO
  reason: string; direction: "Entry" | "Exit"
}

LeaveRecord {
  id: string                 // "LV-0001"
  workerId: string; from: string; to: string
  type: "Casual Leave" | "Sick Leave" | "Earned Leave" | "Compensatory Off"
  reason: string
  status: "Pending" | "Approved" | "Rejected" | "Completed" | "Cancelled"
  appliedOn: string
}
// POST /contractor/leaves/{id}/decision  body: { decision: "approve"|"reject"|"cancel" }
// Server rules: approve/reject only from Pending; cancel only from Approved.

GatePass {
  id: string                 // "GP-0019" — issued by the server, never client-supplied
  workerId: string; vehicle: string   // stored upper-cased, e.g. "CG-12-AB-7788"
  purpose: string; issuedOn: string; validTill: string
  status: "Issued" | "Used" | "Expired" | "Revoked"
}
// POST /contractor/gate-passes  body: { workerId, vehicle, purpose, issuedOn?, validTill }
// Server rules: validTill >= issuedOn, issuedOn/validTill not in the past,
//               Expired passes are immutable (issue a new one instead).

Bill {
  id: string                 // "BILL-2026-007"
  contractId: string         // FK → Contract
  mineId: string
  invoiceNumber: string
  workPeriod: string; billDate: string
  amount: number             // INR rupees
  status: BillStatus
  submittedBy: string; description: string
  decidedOn?: string; decisionNote?: string
  acknowledged?: boolean
}

PortalDocument {
  id: string                 // "DOCX-0012"
  name: string
  category: "Contract Documents" | "Worker Documents" | "Equipment Documents" | "Statutory Compliance"
  relatedType: "contractor" | "worker" | "equipment" | "statutory"
  relatedId: string
  mineId: string
  issueDate: string; expiryDate: string
  sizeKb: number; uploadedBy: string; mockRef: string
}

Incident {
  id: string; workerId: string | null
  contractorId: string; mineId: string
  category: string           // one of INCIDENT_CATEGORIES
  severity: Severity; dateDetected: string
  description: string; inspector: string
  status: IncidentStatus
  evidence: string[]; timeline: { at, by, note }[]
  resolution?: string
}
```

## Query parameters (list endpoints)

```
?mine_id=M-01        // optional; intersected with authorised mines
&q=ram               // case-insensitive substring over id + name + contractor + department
&page=1&page_size=10
&sort=name&dir=asc
&status=Active&department=Mining&contractor_id=DEMO-CONT-001
&training_status=Expired&attendance=Present&access_status=Blocked
&tab=All Workers     // presentation-level grouping; server may ignore
```

Server responses must be consistent with the *combined* filter set — the
frontend resets pagination to page 1 whenever any filter changes.

## Mutations the contractor must NOT be able to perform

These stay privileged on the server even though the demo shows them as
permission-gated in the browser (frontend gating is a UX affordance, **not**
security):

- Approving / terminating / renewing an **official contract**.
- Approving **its own bill** (approval belongs to the mine commercial office).
- Marking its own corrective action **Resolved / Dismissed** (inspector duty).
- Verifying a certification it uploaded (needs an inspector/manager role).
- Suspending its own contractor record.

Server must re-check each of these against the token's role; a `403` must
surface as `WorkforceHttpError` in the page, never as silent success.

## Error contract

```jsonc
// 4xx / 5xx
{ "detail": "Certification has expired and cannot be verified. Renew it first." }
```

`workforceFetch()` maps `detail` → `WorkforceHttpError.message` with the HTTP
status and endpoint path, so pages can render the exact reason inline.

## Rollout checklist before enabling `NEXT_PUBLIC_WORKFORCE_DATA_MODE=http`

1. Agree every path above with the FastAPI backend and flip `confirmed: true`.
2. Confirm server-side contractor + mine scoping is enforced from the JWT.
3. Confirm validation parity (duplicate worker id, mobile format, date ordering,
   expired-certification verification, bill amount > 0).
4. Confirm the four "contractor must not be able to" rules above are enforced
   server-side.
5. Confirm list endpoints return total counts so the shared `DataTable`
   pagination still works.
6. Run `npx tsc --noEmit` and `npm run build`, then exercise every route with a
   real backend.
