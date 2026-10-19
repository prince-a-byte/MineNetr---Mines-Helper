# Contractor "My Contracts" — Proposed Backend API Contract

> **Status: PROPOSED — not confirmed.** The MineNetr FastAPI backend today
> exposes only `POST /api/v1/auth/login`, `GET /api/v1/notifications` and
> `GET /api/v1/role/overview`. Every contractor-contract route below is a
> proposed mapping and is marked `confirmed: false` in
> `lib/contracts/api.ts`. Do **not** treat any path here as a live contract.
>
> The portal runs in **mock mode** by default
> (`NEXT_PUBLIC_CONTRACTS_DATA_MODE=mock`) against the centralized synthetic
> repository in `lib/contracts/store.ts`. Switching to `http` mode before these
> endpoints exist will throw a named `ContractsHttpError` TODO for each
> unconfirmed route — it never falls back to mock data.

## Base URL & auth

- Base URL: `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`), path prefix `/api/v1`.
- Auth: `Authorization: Bearer <JWT>` on every request (same token as login).
- Contractor scoping: the backend must derive `contractor_id` from the token.
  The client never supplies an authoritative contractor id; every query is
  filtered server-side to the authenticated contractor's own records.

## Data shapes

```ts
// Enumerations (mirror lib/contracts/types.ts)
ContractStatus   = "Active" | "Upcoming" | "Expiring Soon" | "Completed" | "Terminated"
MilestoneStatus  = "Pending" | "In Progress" | "Completed" | "Overdue"
RequestStatus    = "Pending Review" | "Under Review" | "Approved" | "Rejected"

Contract {
  id: string                 // "CT-BCM-001"
  contractorId: string       // derived server-side from the token
  mineId: string             // "M-01"
  name: string
  workType: string
  category: string           // donut grouping
  description: string
  scope: string
  startDate: string          // "YYYY-MM-DD"
  endDate: string
  contractValue: number      // INR rupees
  currency: "INR"
  progress: number           // 0-100
  status: ContractStatus
  workOrderNumber: string
  renewalEligible: boolean
  complianceStatus: "Compliant" | "Partially Compliant" | "Non-Compliant"
  createdAt: string          // ISO
  updatedAt: string
}

ContractMilestone {
  id: string
  contractId: string
  title: string
  description: string
  dueDate: string
  status: MilestoneStatus
  submittedAt?: string
  documentRef?: string
  clarificationRequested?: boolean
}

ContractDocument {
  id: string
  contractId: string
  name: string
  category: string
  sizeKb: number
  uploadedAt: string
  uploadedBy: string
}

ActivityEntry { id, contractId: string|null, kind, description, timestamp, user }

ContractRequest {
  id: string                 // "CR-2026-0001"
  contractorId: string
  mineId: string
  workType: string
  proposedTitle: string
  scopeOfWork: string
  proposedStartDate: string
  proposedEndDate: string
  estimatedValue: number
  currency: "INR"
  notes: string
  attachments: Attachment[]
  status: RequestStatus
  createdAt: string
  createdBy: string
}

RenewalRequest {
  id: string                 // "RR-2026-0001"
  contractId: string
  contractorId: string
  mineId: string
  currentEndDate: string
  proposedEndDate: string
  proposedValue: number
  currency: "INR"
  reason: string
  attachments: Attachment[]
  status: RequestStatus
  createdAt: string
  createdBy: string
}

Attachment { name: string; sizeKb: number; category: string }
```

## Endpoints

All routes below are **proposed** (`confirmed: false`). Query params use the
`?key=value` convention; list responses should return the filtered array (the
client applies no server-side pagination today).

| # | Method | Path | Purpose | Confirmed |
|---|--------|------|---------|-----------|
| 1 | GET | `/contractor/mines` | Mines the contractor is assigned to (permission-scoped). | ❌ proposed |
| 2 | GET | `/contractor/profile` | Contractor identity + assigned mine ids. | ❌ proposed |
| 3 | GET | `/contractor/contracts` | Assigned contracts. Query: `mineId`, `status`, `q`, `workType`, `startFrom`, `startTo`, `endFrom`, `endTo`, `minValue`, `maxValue`. | ❌ proposed |
| 4 | GET | `/contractor/contracts/{id}` | Single contract detail. | ❌ proposed |
| 5 | GET | `/contractor/contracts/value-summary` | Contract value grouped by category for the donut. Query: `mineId`. | ❌ proposed |
| 6 | GET | `/contractor/contracts/{id}/milestones` | Milestones for a contract. Query: `upcoming=true`, `mineId`. | ❌ proposed |
| 7 | PATCH | `/contractor/milestones/{id}` | Contractor milestone action. Body: `{ submit?, documentRef?, clarify? }`. **Must not** allow setting `status=Approved` — that is an operator action. | ❌ proposed |
| 8 | GET | `/contractor/contracts/{id}/documents` | Linked documents. | ❌ proposed |
| 9 | POST | `/contractor/contracts/{id}/documents` | Upload a supporting document (multipart). Store a real object; return `ContractDocument`. | ❌ proposed |
| 10 | GET | `/contractor/documents/{id}/download` | Stream the document file. | ❌ proposed |
| 11 | GET | `/contractor/contracts/{id}/activity` | Activity history for a contract. | ❌ proposed |
| 12 | POST | `/contractor/contract-requests` | Submit a new contract request → `Pending Review`. **Must not** create a `Contract`. | ❌ proposed |
| 13 | GET | `/contractor/contract-requests` | List the contractor's requests. | ❌ proposed |
| 14 | POST | `/contractor/renewal-requests` | Submit a renewal request → `Pending Review`. **Must not** mutate the parent contract's `endDate`/`value`. | ❌ proposed |
| 15 | GET | `/contractor/renewal-requests` | List the contractor's renewal requests. | ❌ proposed |
| 16 | GET | `/contractor/contracts/{id}/download` | Download the signed contract PDF. | ❌ proposed |

### Confirmed platform routes (already on the backend)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/login` | Obtain the JWT. |
| GET | `/notifications` | Global notification feed. |
| GET | `/role/overview` | Role-scoped dashboard overview. |

## Permission boundaries (must be enforced server-side)

The contractor **may**:
- view contracts, milestones, documents and activity belonging to their own company;
- submit supporting documents and milestone submissions;
- submit a new contract request and a renewal request;
- export their own authorized records.

The contractor **must not**:
- approve their own contract, renewal or milestone;
- modify official contract values, dates or approval status;
- terminate an official contract;
- read another contractor's records.

Mock authorization in `lib/contracts/store.ts` reflects these same boundaries
so the future backend can be dropped in without UI changes.

## Error handling

- Non-2xx responses throw `ContractsHttpError` with the FastAPI `detail`
  (or a status-based message). The page surfaces the message with a **Retry**
  action — it never silently shows synthetic data as if it came from the API.
- Uploads use `FormData` (`multipart/form-data`) once route #9 is confirmed.
