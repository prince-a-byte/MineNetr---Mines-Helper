# MineNetr Contractor App — Future HTTP API Contract (TODO)

The app runs in `DATA_MODE=mock` today. When the FastAPI backend is ready,
implement the contracts below in `src/services/http/*` and set
`EXPO_PUBLIC_DATA_MODE=http`. Never fall back to mock data on HTTP failure.

Conventions: base `EXPO_PUBLIC_API_BASE_URL`, Bearer session token,
JSON bodies (multipart for uploads), `{ data, page, total }` envelopes.

| Service method | Method + path (proposed) | Notes |
|---|---|---|
| `auth.login` | `POST /api/v1/auth/login` | `{ identifier, password, role }` → session + token |
| `auth.loginWithOtp` | `POST /api/v1/auth/otp/request` | rate-limited server-side |
| `auth.verifyOtp` | `POST /api/v1/auth/otp/verify` | `{ identifier, code }` |
| `auth.requestPasswordReset` | `POST /api/v1/auth/password-reset` | never enumerate accounts |
| `workers.listWorkers` | `GET /api/v1/contractor/workers` | `?q=&status=&mineId=&role=&page=` |
| `workers.createWorker` | `POST /api/v1/contractor/workers` | server generates worker ID |
| `workers.updateWorkerStatus` | `PATCH /api/v1/contractor/workers/{id}/status` | audit-logged |
| `workers.transferWorker` | `POST /api/v1/contractor/workers/{id}/transfer` | `{ mineId }`, history preserved |
| `mines.listAssignedMines` | `GET /api/v1/contractor/mines` | scoped to company server-side |
| `documents.*` | `GET/POST /api/v1/contractor/documents` | upload = multipart; verification is operator-only |
| `bills.createBill` | `POST /api/v1/contractor/bills` | always created `Pending`; approval separate |
| `dashboard.summary` | `GET /api/v1/contractor/dashboard` | server-aggregated |
| `profile.*` | `GET/PATCH /api/v1/contractor/profile` | — |
| `notifications.*` | `GET /api/v1/contractor/notifications` | push provider later |

None of these paths are assumed to exist on the current backend — verify each
against the FastAPI OpenAPI docs before implementing.
