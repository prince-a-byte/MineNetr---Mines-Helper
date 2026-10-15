from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.config import settings
from app.database import Base, engine, get_db
from app import models
from app.auth import verify_pw, make_token
from app.deps import current_user, require_roles
from app.seed import seed

Base.metadata.create_all(bind=engine)

app = FastAPI(title="MineNetr API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.ENVIRONMENT=="development" else settings.CORS_ORIGINS,
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# ---------- schemas ----------
class LoginIn(BaseModel):
    email: str
    password: str
    role: Optional[str] = None  # requested workspace; server validates

class FindingUpdate(BaseModel):
    status: Optional[str] = None
    ai_verified: Optional[bool] = None

class AuditIn(BaseModel):
    action: str
    target: str = ""
    details: str = ""

# ---------- helpers ----------
def err(msg, code=400):
    raise HTTPException(status_code=code, detail=msg)

def paginate(q, page: int, size: int):
    total = q.count()
    items = q.offset((page-1)*size).limit(size).all()
    return {"total": total, "page": page, "size": size, "items": items}

# ---------- public ----------
@app.get("/api/v1/health")
def health(): return {"ok": True, "env": settings.ENVIRONMENT, "demo": settings.DEMO_MODE}

@app.get("/health")
def health_root(): return {"ok": True, "env": settings.ENVIRONMENT, "demo": settings.DEMO_MODE}

@app.post("/api/v1/seed")
def seed_db(db: Session = Depends(get_db)):
    if settings.ENVIRONMENT != "development": err("Seed only in development", 403)
    return seed(db)

@app.post("/api/v1/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    u = db.query(models.User).filter(models.User.email == email).first()
    # rate-limit friendly generic error
    if not u or not verify_pw(body.password, u.password_hash):
        err("Invalid email or password.", 401)
    if not u.is_active: err("Account is disabled. Contact administrator.", 403)
    # server is authority: if client requested a workspace role, it must match assigned role
    # dgms admins may also hold inspector rights? No - strict: must match.
    if body.role and body.role != u.role:
        err(f"This account is registered as '{u.role}'. Please use the {u.role} workspace.", 403)
    token = make_token(u.id, u.role)
    # audit
    db.add(models.AuditLog(actor=u.email, role=u.role, action="login", target="auth", outcome="success"))
    db.commit()
    return {"access_token": token, "token_type": "bearer",
        "user": {"id": u.id, "name": u.name, "email": u.email, "role": u.role,
                 "title": u.title, "org": u.org, "mine_code": u.mine_code}}

@app.get("/api/v1/auth/me")
def me(u: models.User = Depends(current_user)):
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role,
            "title": u.title, "org": u.org, "mine_code": u.mine_code}

# ---------- DGMS dashboard ----------
@app.get("/api/v1/dgms/overview")
def dgms_overview(u: models.User = Depends(require_roles("dgms")) , db: Session = Depends(get_db)):
    total_mines = db.query(models.Mine).count() or 213
    # scale demo constants to match PDF while using real counts where present
    mines = db.query(models.Mine).all()
    inspections = db.query(models.Inspection).all()
    findings = db.query(models.Finding).all()
    completed = len([i for i in inspections if i.status=="Completed"])
    inprog = len([i for i in inspections if i.status=="In Progress"])
    overdue = len([i for i in inspections if i.status=="Overdue"])
    critical = len([f for f in findings if f.severity=="Critical"])
    # match PDF headline numbers when seed small: extrapolate label as demo
    return {
        "kpis": [
            {"label":"Total Registered Mines","value":213,"delta":"+2%","sub":"Across 12 States","demo":True},
            {"label":"Inspections Completed","value":158,"delta":"+12%","sub":"Out of 214 Scheduled","demo":True},
            {"label":"Critical Violations","value":26,"delta":"+4","sub":"Require Immediate Attention","demo":True},
            {"label":"Overdue Actions","value":41,"delta":"-6","sub":"Across 29 Mines","demo":True},
            {"label":"Reports Pending Review","value":18,"delta":"+5","sub":"Inspector Submitted","demo":True},
        ],
        "real_counts": {"mines": len(mines), "inspections": len(inspections), "findings": len(findings),
                        "completed": completed, "in_progress": inprog, "overdue": overdue, "critical": critical},
        "mines_by_status": {"Normal Operation":142,"Requires Attention":38,"Critical Risk":18,"No Recent Data":15},
        "inspection_status": {"Completed":158,"In Progress":28,"Pending":20,"Overdue":8,"total":214},
        "findings_by_category": [
            {"name":"Safety (PPE, HSE)","value":98},{"name":"Environment","value":54},
            {"name":"Equipment Safety","value":36},{"name":"Documentation","value":28},
            {"name":"Worker Welfare","value":22},{"name":"Others","value":12}],
        "mines_by_state": [
            {"state":"Jharkhand","count":36},{"state":"Chhattisgarh","count":28},{"state":"Odisha","count":24},
            {"state":"Madhya Pradesh","count":22},{"state":"Maharashtra","count":18},{"state":"Gujarat","count":14},
            {"state":"Telangana","count":12},{"state":"West Bengal","count":10},{"state":"Uttar Pradesh","count":8},
            {"state":"Rajasthan","count":6},{"state":"Assam","count":5},{"state":"Others","count":4}],
    }

@app.get("/api/v1/mines")
def list_mines(q: str = "", state: str = "", status: str = "",
    page: int = 1, size: int = 10,
    u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    query = db.query(models.Mine)
    if u.role=="contractor": query = query.filter(models.Mine.code.like("%BCM%"))  # scoped demo
    if q: query = query.filter(or_(models.Mine.name.ilike(f"%{q}%"), models.Mine.code.ilike(f"%{q}%"), models.Mine.operator.ilike(f"%{q}%")))
    if state and state!="All States": query = query.filter(models.Mine.state==state)
    if status and status!="All Mine Status": query = query.filter(models.Mine.status==status)
    query = query.order_by(models.Mine.code)
    total = query.count()
    items = query.offset((page-1)*size).limit(size).all()
    return {"total":213 if total<=12 else total, "page":page,"size":size,
        "items":[{"code":m.code,"name":m.name,"state":m.state,"district":m.district,"operator":m.operator,
                  "status":m.status,"risk":m.risk_level,"last_inspection":m.last_inspection,
                  "type":m.mine_type,"capacity":m.production_capacity} for m in items]}

@app.get("/api/v1/mines/{code}")
def mine_detail(code: str, u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    m = db.query(models.Mine).filter(models.Mine.code==code).first()
    if not m: err("Mine not found",404)
    return {"code":m.code,"name":m.name,"state":m.state,"district":m.district,"operator":m.operator,
        "status":m.status,"risk":m.risk_level,"last_inspection":m.last_inspection,
        "type":m.mine_type,"capacity":m.production_capacity,"lat":m.latitude,"lng":m.longitude}

@app.get("/api/v1/inspections")
def list_inspections(q: str = "", status: str = "", page: int = 1, size: int = 10,
    u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    query = db.query(models.Inspection)
    if u.role=="inspector": query = query.filter(models.Inspection.inspector_email==u.email)
    if q: query = query.filter(or_(models.Inspection.mine_name.ilike(f"%{q}%"), models.Inspection.inspection_id.ilike(f"%{q}%"), models.Inspection.inspector.ilike(f"%{q}%")))
    if status and status!="All": query = query.filter(models.Inspection.status==status)
    query = query.order_by(models.Inspection.inspection_id.desc())
    total = query.count()
    items = query.offset((page-1)*size).limit(size).all()
    return {"total":214 if total<=10 else total,"page":page,"size":size,
        "items":[{"inspection_id":i.inspection_id,"mine":i.mine_name,"mine_code":i.mine_code,"state":i.state,
                  "inspector":i.inspector,"date":i.scheduled_date,"type":i.inspection_type,
                  "status":i.status,"report":i.report_status,"priority":i.priority} for i in items]}

@app.get("/api/v1/findings")
def list_findings(q: str = "", severity: str = "", status: str = "", page: int = 1, size: int = 10,
    u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    query = db.query(models.Finding)
    if q: query = query.filter(or_(models.Finding.finding_id.ilike(f"%{q}%"), models.Finding.mine_name.ilike(f"%{q}%"), models.Finding.description.ilike(f"%{q}%"), models.Finding.category.ilike(f"%{q}%")))
    if severity and severity!="All Severities": query = query.filter(models.Finding.severity==severity)
    if status and status!="All Status": query = query.filter(models.Finding.status==status)
    query = query.order_by(models.Finding.finding_id.desc())
    total = query.count()
    items = query.offset((page-1)*size).limit(size).all()
    return {"total":482 if total<=10 else total,"page":page,"size":size,
        "items":[{"finding_id":f.finding_id,"mine":f.mine_name,"mine_code":f.mine_code,"state":f.state,
                  "category":f.category,"severity":f.severity,"status":f.status,"source":f.source,
                  "description":f.description,"location":f.location,"date":f.date_detected,
                  "assigned":f.assigned_to,"target":f.target_date,"ai_conf":f.ai_confidence,"ai_verified":f.ai_verified} for f in items]}

@app.patch("/api/v1/findings/{fid}")
def update_finding(fid: str, body: FindingUpdate,
    u: models.User = Depends(require_roles("dgms","operator")), db: Session = Depends(get_db)):
    f = db.query(models.Finding).filter(models.Finding.finding_id==fid).first()
    if not f: err("Finding not found",404)
    if body.status:
        if body.status not in ("Open","In Progress","Resolved"): err("Invalid status transition",422)
        # DGMS/operator review: resolving AI finding requires verification
        if body.status=="Resolved" and f.source=="AI Detection" and not (f.ai_verified or body.ai_verified):
            err("AI-detected finding must be human-verified before resolution.",422)
        f.status = body.status
    if body.ai_verified is not None:
        f.ai_verified = body.ai_verified
    db.add(models.AuditLog(actor=u.email, role=u.role, action=f"finding:{body.status or 'verify'}", target=fid, outcome="success"))
    db.commit()
    return {"ok": True, "finding_id": fid, "status": f.status, "ai_verified": f.ai_verified}

@app.get("/api/v1/notifications")
def notifs(u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    items = db.query(models.Notification).filter(models.Notification.role==u.role).order_by(models.Notification.created_at.desc()).all()
    if not items:  # fallback to dgms set for demo
        items = db.query(models.Notification).filter(models.Notification.role=="dgms").all()
    return {"items":[{"id":n.id,"title":n.title,"subtitle":n.subtitle,"severity":n.severity,"time":n.time_ago,"read":n.read} for n in items]}

@app.get("/api/v1/audit")
def audit(u: models.User = Depends(require_roles("dgms")), db: Session = Depends(get_db), page: int=1, size:int=20):
    q = db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc())
    total=q.count(); items=q.offset((page-1)*size).limit(size).all()
    return {"total":total,"items":[{"actor":a.actor,"role":a.role,"action":a.action,"target":a.target,"time":str(a.timestamp),"outcome":a.outcome,"details":a.details} for a in items]}

@app.post("/api/v1/audit")
def add_audit(body: AuditIn, u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    db.add(models.AuditLog(actor=u.email, role=u.role, action=body.action, target=body.target, details=body.details))
    db.commit(); return {"ok": True}

# ---------- role overviews ----------
def _scope_mine(u: models.User):
    return u.mine_code or "BCM-03"

@app.get("/api/v1/role/overview")
def role_overview(u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    mine = _scope_mine(u)
    workers = db.query(models.Worker)
    contracts = db.query(models.Contract)
    bills = db.query(models.Bill)
    inspections = db.query(models.Inspection)
    findings = db.query(models.Finding)
    if u.role == "operator":
        workers = workers.filter(models.Worker.mine_code == mine)
        bills_mine = bills.filter(models.Bill.mine_code == mine).all()
        mine_ins = inspections.filter(models.Inspection.mine_code == mine).all()
        return {
            "mine": mine, "demo": True,
            "kpis": [
                {"label": "Total Production", "value": "5,620 MT", "delta": "+8%", "sub": "Target: 5,000 MT"},
                {"label": "Total Dispatch", "value": "4,980 MT", "delta": "+6%", "sub": "Target: 4,500 MT"},
                {"label": "Total Workers On-Site", "value": 1248, "delta": "+5%", "sub": f"{workers.count()} in registry · 1,102 Present"},
                {"label": "Active Contractors", "value": 12, "delta": "+2", "sub": "2 New This Month"},
                {"label": "Compliance Status", "value": "92%", "delta": "+4%", "sub": "14/15 Compliant"},
            ],
            "gas": [
                {"name": "CH4", "full": "Methane", "value": "0.8%", "limit": "Limit: < 1%", "pct": 80, "ok": True},
                {"name": "CO", "full": "Carbon Monoxide", "value": "12 ppm", "limit": "Limit: < 25 ppm", "pct": 48, "ok": True},
                {"name": "O2", "full": "Oxygen", "value": "20.6%", "limit": "Limit: 19.5 – 23.5%", "pct": 72, "ok": True},
                {"name": "H2S", "full": "Hydrogen Sulphide", "value": "2 ppm", "limit": "Limit: < 10 ppm", "pct": 20, "ok": True},
            ],
            "production_7d": [
                {"day": "27 Sep", "prod": 5100, "disp": 3700}, {"day": "28 Sep", "prod": 5300, "disp": 4400},
                {"day": "29 Sep", "prod": 5450, "disp": 4100}, {"day": "30 Sep", "prod": 5560, "disp": 4450},
                {"day": "01 Oct", "prod": 5300, "disp": 4200}, {"day": "02 Oct", "prod": 5750, "disp": 4700},
                {"day": "03 Oct", "prod": 5620, "disp": 4980}],
            "activities": [
                {"t": "5,620 MT Production Recorded", "time": "08:30 AM", "status": "Completed"},
                {"t": "Worker Attendance Updated", "time": "09:00 AM", "status": "Updated"},
                {"t": "Gas Level Alert (CH4 0.9%)", "time": "10:12 AM", "status": "Resolved"},
                {"t": "Dispatch to NTPC (2,500 MT)", "time": "10:30 AM", "status": "In Progress"},
                {"t": "DGMS Inspection Scheduled", "time": "11:00 AM", "status": "Upcoming"}],
            "events": [
                {"d": "06", "m": "OCT", "t": "DGMS Inspection", "s": "BCM-03", "tag": "Upcoming"},
                {"d": "10", "m": "OCT", "t": "Contract Renewal", "s": "Site Services (CT-003)", "tag": "Due Soon"},
                {"d": "12", "m": "OCT", "t": "Safety Training Batch", "s": "For 45 Workers", "tag": "Scheduled"}],
            "pending_bills": len([b for b in bills_mine if b.status == "Pending Approval"]),
            "open_findings": len([f for f in findings.filter(models.Finding.mine_code == mine).all() if f.status != "Resolved"]),
            "inspections": [{"id": i.inspection_id, "type": i.inspection_type, "status": i.status, "date": i.scheduled_date} for i in mine_ins[:5]],
        }
    if u.role == "contractor":
        cid = u.contractor_id or "CTR-01"
        w = workers.filter(models.Worker.contractor_id == cid).all()
        c = contracts.filter(models.Contract.contractor_id == cid).all()
        b = bills.filter(models.Bill.contractor_id == cid).all()
        pending = [x for x in b if x.status == "Pending Approval"]
        mines = {}
        for x in w: mines[x.mine_name] = mines.get(x.mine_name, 0) + 1
        return {
            "demo": True,
            "kpis": [
                {"label": "Total Deployed Workers", "value": 482, "delta": "+12%", "sub": f"Across 3 Mines · {len(w)} in registry"},
                {"label": "Active Contracts", "value": len([x for x in c if x.status == 'Active']), "delta": "", "sub": f"{len([x for x in c if x.status=='Ending Soon'])} Ending Soon"},
                {"label": "Pending Bills", "value": f"₹ {sum(x.amount_lakh for x in pending):.1f} Lakh", "delta": "", "sub": f"{len(pending)} Bills Awaiting Approval"},
                {"label": "Compliance Status", "value": "92%", "delta": "", "sub": "Good Standing"},
            ],
            "distribution": [{"name": k, "value": v} for k, v in mines.items()] or [{"name": "Bharat Coal Mine", "value": 180}, {"name": "North Block Mine", "value": 145}],
            "contracts": [{"id": x.contract_id, "name": x.name, "mine": x.mine_code, "start": x.start_date, "end": x.end_date, "status": x.status} for x in c],
            "attendance": {"pct": 86, "present": 415, "absent": 52, "leave": 8, "unmarked": 7},
            "tasks": [
                {"t": "Submit monthly attendance", "s": "Bharat Coal Mine", "due": "Due in 2 days"},
                {"t": "Upload equipment maintenance bill", "s": "Equipment Maintenance", "due": "Due in 4 days"},
                {"t": "Renew worker training certificates", "s": "12 workers", "due": "Due in 6 days"},
                {"t": "Update insurance documents", "s": "Contract Compliance", "due": "Due in 7 days"},
                {"t": "Submit statutory compliance report", "s": "Q3 2026", "due": "Due in 10 days"}],
            "activities": [
                {"t": "Attendance uploaded", "s": "Bharat Coal Mine · 2 hours ago"},
                {"t": "Bill submitted for approval", "s": "Coal Transportation · 5 hours ago"},
                {"t": "Worker transferred", "s": "Ramesh Yadav (BCM-03 → NBM-02) · 1 day ago"},
                {"t": "Document renewed", "s": "Contractor License · 2 days ago"}],
        }
    if u.role == "inspector":
        mine_ins = inspections.filter(models.Inspection.inspector_email == u.email).all()
        if not mine_ins: mine_ins = inspections.all()
        ai = [f for f in findings.all() if f.source == "AI Detection"]
        crit = [f for f in findings.all() if f.severity == "Critical"]
        return {
            "demo": True,
            "kpis": [
                {"label": "Inspections Assigned", "value": 12, "delta": "+20%", "sub": "This Month"},
                {"label": "Completed Inspections", "value": 8, "delta": "+60%", "sub": "This Month"},
                {"label": "Pending Inspections", "value": 3, "delta": "-25%", "sub": "This Month"},
                {"label": "Overdue Inspections", "value": 1, "delta": "", "sub": "This Month"},
                {"label": "Critical Findings", "value": len(crit) or 5, "delta": "+2", "sub": "This Month"},
                {"label": "Reports Submitted", "value": 7, "delta": "+40%", "sub": "This Month"},
            ],
            "today": [
                {"time": "09:00 AM – 12:00 PM", "mine": "BCM-03", "type": "Routine Safety Inspection", "pri": "High Priority"},
                {"time": "01:00 PM – 03:00 PM", "mine": "BCM-05", "type": "Environmental Compliance", "pri": "Normal"},
                {"time": "04:00 PM – 05:00 PM", "mine": "BCM-01", "type": "Stockpile & Dispatch Verification", "pri": "Medium"}],
            "progress": {"total": 12, "completed": 8, "inprog": 2, "pending": 1, "overdue": 1},
            "mines": [{"code": "BCM-01", "st": "Completed"}, {"code": "BCM-02", "st": "In Progress"}, {"code": "BCM-03", "st": "Inspection Today"}, {"code": "BCM-04", "st": "Scheduled"}, {"code": "BCM-05", "st": "Scheduled"}],
            "env": [
                {"n": "Methane (CH4)", "v": "0.8 %"}, {"n": "Respirable Dust (PM10)", "v": "62 µg/m³"},
                {"n": "CO Level", "v": "12 ppm"}, {"n": "Temperature", "v": "28 °C"}],
            "ai_queue": [{"id": f.finding_id, "t": f.description[:60], "mine": f.mine_code, "sev": f.severity, "verified": f.ai_verified} for f in ai[:4]],
            "recent_findings": [{"id": f.finding_id, "date": f.date_detected, "mine": f.mine_code, "cat": f.category, "sev": f.severity, "st": f.status} for f in findings.all()[:5]],
            "my_inspections": [{"id": i.inspection_id, "mine": i.mine_code, "type": i.inspection_type, "date": i.scheduled_date, "status": i.status, "report": i.report_status} for i in mine_ins[:6]],
        }
    # dgms falls back to dedicated overview
    err("Use /api/v1/dgms/overview for DGMS role", 400)

# ---------- workers / contracts / bills ----------
def _scope(q, model, u: models.User, mine_field="mine_code"):
    if u.role == "contractor":
        return q.filter(model.contractor_id == (u.contractor_id or "CTR-01"))
    if u.role in ("operator", "inspector") and hasattr(model, mine_field):
        mc = u.mine_code or "BCM-03"
        if u.role == "operator":
            return q.filter(getattr(model, mine_field) == mc)
    return q

@app.get("/api/v1/workers")
def list_workers(q: str = "", page: int = 1, size: int = 10,
    u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    query = _scope(db.query(models.Worker), models.Worker, u)
    if q: query = query.filter(or_(models.Worker.name.ilike(f"%{q}%"), models.Worker.worker_id.ilike(f"%{q}%")))
    total = query.count(); items = query.order_by(models.Worker.worker_id).offset((page-1)*size).limit(size).all()
    return {"total": total, "page": page, "size": size, "items": [
        {"id": w.worker_id, "name": w.name, "contractor": w.contractor, "mine": w.mine_name, "mine_code": w.mine_code,
         "state": w.state, "work": w.work_type, "compliance": w.compliance, "training_till": w.training_valid_till} for w in items]}

class WorkerIn(BaseModel):
    name: str; contractor: str = ""; mine_code: str = ""; work_type: str = "General"

@app.post("/api/v1/workers")
def add_worker(body: WorkerIn, u: models.User = Depends(require_roles("contractor", "operator", "dgms")), db: Session = Depends(get_db)):
    if not body.name.strip(): err("Worker name required", 422)
    last = db.query(models.Worker).order_by(models.Worker.worker_id.desc()).first()
    nxt = f"W-{int((last.worker_id if last else 'W-1052').split('-')[1]) + 1}"
    m = db.query(models.Mine).filter(models.Mine.code == (body.mine_code or u.mine_code or "BCM-03")).first()
    w = models.Worker(worker_id=nxt, name=body.name.strip(),
        contractor=body.contractor or u.org, contractor_id=u.contractor_id if u.role == "contractor" else "",
        mine_code=m.code if m else "BCM-03", mine_name=m.name if m else "", state=m.state if m else "",
        work_type=body.work_type)
    db.add(w)
    db.add(models.AuditLog(actor=u.email, role=u.role, action="worker:create", target=nxt, outcome="success"))
    db.commit()
    return {"ok": True, "worker_id": nxt}

@app.get("/api/v1/contracts")
def list_contracts(q: str = "", page: int = 1, size: int = 10,
    u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    query = _scope(db.query(models.Contract), models.Contract, u)
    if q: query = query.filter(or_(models.Contract.name.ilike(f"%{q}%"), models.Contract.contract_id.ilike(f"%{q}%")))
    total = query.count(); items = query.order_by(models.Contract.contract_id).offset((page-1)*size).limit(size).all()
    return {"total": total, "page": page, "size": size, "items": [
        {"id": c.contract_id, "name": c.name, "mine": c.mine_name, "mine_code": c.mine_code, "contractor": c.contractor,
         "start": c.start_date, "end": c.end_date, "value_lakh": c.value_lakh, "status": c.status, "progress": c.progress} for c in items]}

@app.post("/api/v1/contracts/{cid}/renewal-request")
def renewal_request(cid: str, u: models.User = Depends(require_roles("contractor")), db: Session = Depends(get_db)):
    c = db.query(models.Contract).filter(models.Contract.contract_id == cid, models.Contract.contractor_id == (u.contractor_id or "CTR-01")).first()
    if not c: err("Contract not found in your organization", 404)
    if c.status == "Pending Renewal": err("Renewal already requested", 409)
    c.status = "Pending Renewal"
    db.add(models.AuditLog(actor=u.email, role=u.role, action="contract:renewal-request", target=cid, outcome="success"))
    db.commit(); return {"ok": True, "status": c.status}

@app.get("/api/v1/bills")
def list_bills(status: str = "", page: int = 1, size: int = 10,
    u: models.User = Depends(current_user), db: Session = Depends(get_db)):
    query = db.query(models.Bill)
    if u.role == "contractor": query = query.filter(models.Bill.contractor_id == (u.contractor_id or "CTR-01"))
    if u.role == "operator": query = query.filter(models.Bill.mine_code == (u.mine_code or "BCM-03"))
    if status and status != "All": query = query.filter(models.Bill.status == status)
    total = query.count(); items = query.order_by(models.Bill.bill_id.desc()).offset((page-1)*size).limit(size).all()
    return {"total": total, "page": page, "size": size, "items": [
        {"id": b.bill_id, "contract": b.contract_name, "contract_id": b.contract_id, "mine": b.mine_name,
         "period": b.period, "amount_lakh": b.amount_lakh, "status": b.status, "submitted": b.submitted_on, "remarks": b.remarks} for b in items]}

class BillIn(BaseModel):
    contract_id: str; period: str; amount_lakh: float; notes: str = ""

@app.post("/api/v1/bills")
def submit_bill(body: BillIn, u: models.User = Depends(require_roles("contractor")), db: Session = Depends(get_db)):
    c = db.query(models.Contract).filter(models.Contract.contract_id == body.contract_id, models.Contract.contractor_id == (u.contractor_id or "CTR-01")).first()
    if not c: err("Contract not found in your organization", 404)
    if body.amount_lakh <= 0: err("Amount must be positive", 422)
    if not body.period.strip(): err("Billing period required", 422)
    last = db.query(models.Bill).order_by(models.Bill.bill_id.desc()).first()
    nxt = f"BILL-2026-{int((last.bill_id if last else 'BILL-2026-031').split('-')[2]) + 1:03d}"
    b = models.Bill(bill_id=nxt, contract_id=c.contract_id, contract_name=c.name, mine_code=c.mine_code,
        mine_name=c.mine_name, contractor_id=c.contractor_id, contractor=c.contractor,
        period=body.period.strip(), amount_lakh=body.amount_lakh, status="Pending Approval", submitted_on="03 Oct 2026", remarks=body.notes)
    db.add(b)
    db.add(models.AuditLog(actor=u.email, role=u.role, action="bill:submit", target=nxt, outcome="success"))
    db.commit(); return {"ok": True, "bill_id": nxt, "status": "Pending Approval"}

class BillDecision(BaseModel):
    decision: str  # Approved|Rejected|Paid
    remarks: str = ""

@app.patch("/api/v1/bills/{bid}")
def decide_bill(bid: str, body: BillDecision, u: models.User = Depends(require_roles("operator", "dgms")), db: Session = Depends(get_db)):
    b = db.query(models.Bill).filter(models.Bill.bill_id == bid).first()
    if not b: err("Bill not found", 404)
    if u.role == "operator" and b.mine_code != (u.mine_code or "BCM-03"): err("Bill is outside your mine", 403)
    if body.decision not in ("Approved", "Rejected", "Paid"): err("Invalid decision", 422)
    if b.status not in ("Pending Approval", "Approved") and body.decision == "Paid": err("Only approved bills can be marked paid", 422)
    if b.status != "Pending Approval" and body.decision in ("Approved", "Rejected"): err(f"Bill is already {b.status}", 409)
    b.status = body.decision; b.remarks = body.remarks or b.remarks
    db.add(models.AuditLog(actor=u.email, role=u.role, action=f"bill:{body.decision.lower()}", target=bid, details=body.remarks, outcome="success"))
    db.commit(); return {"ok": True, "status": b.status}

class InspectionPatch(BaseModel):
    status: Optional[str] = None  # In Progress|Completed
    report_status: Optional[str] = None

@app.patch("/api/v1/inspections/{iid}")
def patch_inspection(iid: str, body: InspectionPatch,
    u: models.User = Depends(require_roles("inspector", "dgms")), db: Session = Depends(get_db)):
    i = db.query(models.Inspection).filter(models.Inspection.inspection_id == iid).first()
    if not i: err("Inspection not found", 404)
    if u.role == "inspector" and i.inspector_email and i.inspector_email != u.email:
        err("Inspection assigned to another inspector", 403)
    if body.status:
        if body.status not in ("In Progress", "Completed"): err("Invalid status", 422)
        i.status = body.status
        if body.status == "Completed": i.report_status = "Submitted"
        i.workflow_state = "PENDING_OPERATOR" if body.status == "Completed" else "IN_PROGRESS"
    if body.report_status and u.role == "dgms":
        if body.report_status not in ("Submitted", "Pending Review", "Approved", "Rejected"): err("Invalid report status", 422)
        i.report_status = body.report_status
    db.add(models.AuditLog(actor=u.email, role=u.role, action=f"inspection:{body.status or body.report_status}", target=iid, outcome="success"))
    db.commit(); return {"ok": True, "status": i.status, "report": i.report_status}

class FindingIn(BaseModel):
    mine_code: str; category: str = "Safety (PPE)"; severity: str = "Medium"
    description: str; location: str = ""; inspection_id: str = ""

@app.post("/api/v1/findings")
def create_finding(body: FindingIn, u: models.User = Depends(require_roles("inspector", "operator", "dgms")), db: Session = Depends(get_db)):
    if not body.description.strip(): err("Description required", 422)
    if body.severity not in ("Critical", "High", "Medium", "Low"): err("Invalid severity", 422)
    m = db.query(models.Mine).filter(models.Mine.code == body.mine_code).first()
    if not m: err("Unknown mine code", 404)
    last = db.query(models.Finding).order_by(models.Finding.finding_id.desc()).first()
    nxt = f"FND-2026-{int((last.finding_id if last else 'FND-2026-482').split('-')[2]) + 1}"
    f = models.Finding(finding_id=nxt, mine_name=m.name, mine_code=m.code, state=m.state,
        category=body.category, severity=body.severity, status="Open", source="Inspector",
        description=body.description.strip(), location=body.location, date_detected="03 Oct 2026",
        assigned_to=f"Mine Operator ({m.operator})", target_date="10 Oct 2026", ai_verified=True)
    db.add(f)
    db.add(models.AuditLog(actor=u.email, role=u.role, action="finding:create", target=nxt, outcome="success"))
    db.commit(); return {"ok": True, "finding_id": nxt}
