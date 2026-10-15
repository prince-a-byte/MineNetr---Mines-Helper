# MineNetr — Intelligent Mine Safety, Operations & Regulatory Monitoring Platform

One platform, four role workspaces, one shared FastAPI backend + SQLite/PostgreSQL database.

## Status (this drop — DGMS-first)

- [x] Unified `/login` with 4 role cards, server-validated workspace, demo creds (dev only)
- [x] Backend JWT auth, RBAC, mine/inspection/finding scoping, audit log
- [x] DGMS: Dashboard, Mine Registry, Inspection Oversight, Findings & Violations (live API + search/pagination/verify-to-resolve)
- [x] DGMS: Safety, Production, Workforce, Reports, Notifications, Audit, Settings (connected shell, honest scoped stubs)
- [x] Operator / Contractor / Inspector: login-gated workspace placeholders (full builds next, after DGMS sign-off)
- [x] Tests: 4-role login, invalid creds, role-mismatch, RBAC, AI-verify gate — 6 passed

## Quick start

### Backend
```powershell
cd backend
copy .env.example .env   # or: cp .env.example .env
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
# seed demo data (dev only):
# POST http://localhost:8000/api/v1/seed  OR it auto-creates tables; seed via that endpoint once
```
Default DB is SQLite `./minenetr.db`. For Postgres set `DATABASE_URL` in `.env`.

### Frontend
```powershell
cd frontend
copy .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev     # http://localhost:3000  -> redirects to /login
npm run build   # production check
```

## Demo accounts (development only, same backend auth, distinct permissions)

| Workspace | Email | Password |
|---|---|---|
| DGMS Administrator | dgms@minenetr.in | dgms123 |
| Mine Inspector | inspector@minenetr.in | inspect123 |
| Mine Operator | operator@minenetr.in | operate123 |
| Contractor | contractor@minenetr.in | contract123 |

The `role` sent by the browser is **not trusted**: mismatched workspace requests are rejected (403).

## API (all under `/api/v1`, JWT Bearer)

- `POST /auth/login`, `GET /auth/me`, `GET /health`, `POST /seed` (dev)
- `GET /dgms/overview` (dgms) — headline KPIs + real counts
- `GET /mines`, `GET /mines/{code}` — search `q`, filters, pagination
- `GET /inspections`, `GET /findings` — search, severity filter, pagination
- `PATCH /findings/{id}` (dgms, operator) — AI findings must be human-verified before `Resolved`
- `GET /notifications`, `GET /audit` (dgms), `POST /audit`

## Design language (from `ui_reference/` PDFs)

Navy sidebar `#0a1628`, blue active nav, white content, mining banner, KPI cards, dense tables, right detail panels, Critical/High/Medium/Low badges. All `DEMO/simulated` labels are explicit; AI predictions are never auto-confirmed.

## Remaining work (prioritized, post DGMS review)

1. Operator full pages (workers, attendance, production/dispatch, stockpile, bills, docs, review queue)
2. Contractor full pages (contracts, workers, attendance submit, bill wizard, docs)
3. Inspector field app (checklists, camera evidence, IndexedDB offline queue, sync, AI review queue)
4. Postgres migrations (Alembic), refresh-token rotation, rate limiting, file storage adapter
5. Maps (registered coords + list fallback), MQTT/XGBoost/YOLO adapters with unavailable-state honesty
