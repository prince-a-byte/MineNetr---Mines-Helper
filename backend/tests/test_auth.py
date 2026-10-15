from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.seed import seed

client = TestClient(app)

def setup_module(m):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal(); seed(db); db.close()

def login(email, pw, role=None):
    body = {"email": email, "password": pw}
    if role: body["role"] = role
    return client.post("/api/v1/auth/login", json=body)

def test_login_each_role():
    for em, pw, rl in [("dgms@minenetr.in","dgms123","dgms"),("inspector@minenetr.in","inspect123","inspector"),
                       ("operator@minenetr.in","operate123","operator"),("contractor@minenetr.in","contract123","contractor")]:
        r = login(em, pw, rl)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == rl

def test_invalid_credentials():
    assert login("dgms@minenetr.in","wrong").status_code == 401

def test_role_mismatch_blocked():
    r = login("contractor@minenetr.in","contract123","dgms")
    assert r.status_code == 403

def test_contractor_cannot_access_dgms_overview():
    t = login("contractor@minenetr.in","contract123").json()["access_token"]
    r = client.get("/api/v1/dgms/overview", headers={"Authorization": f"Bearer {t}"})
    assert r.status_code == 403

def test_operator_cannot_access_audit():
    t = login("operator@minenetr.in","operate123").json()["access_token"]
    assert client.get("/api/v1/audit", headers={"Authorization": f"Bearer {t}"}).status_code == 403

def test_role_overviews_and_scoping():
    for em, pw, rl in [("operator@minenetr.in","operate123","operator"),
                       ("contractor@minenetr.in","contract123","contractor"),
                       ("inspector@minenetr.in","inspect123","inspector")]:
        t = login(em, pw, rl).json()["access_token"]
        h = {"Authorization": f"Bearer {t}"}
        r = client.get("/api/v1/role/overview", headers=h)
        assert r.status_code == 200, (rl, r.text)
        assert r.json().get("demo") is True
    # contractor cannot see other org workers: all scoped
    tc = login("contractor@minenetr.in","contract123").json()["access_token"]
    hc = {"Authorization": f"Bearer {tc}"}
    w = client.get("/api/v1/workers?size=50", headers=hc).json()
    assert all(x["contractor"] == "ABC Mining Services" for x in w["items"])
    # contractor cannot approve own bill
    assert client.patch("/api/v1/bills/BILL-2026-031", json={"decision":"Approved"}, headers=hc).status_code == 403
    # operator can approve pending bill in own mine, contractor bill lifecycle works
    from app.database import SessionLocal as S
    from app import models as m
    sdb = S(); bb = sdb.query(m.Bill).filter(m.Bill.bill_id == "BILL-2026-031").first()
    bb.status = "Pending Approval"; sdb.commit(); sdb.close()
    to = login("operator@minenetr.in","operate123").json()["access_token"]
    ho = {"Authorization": f"Bearer {to}"}
    assert client.patch("/api/v1/bills/BILL-2026-031", json={"decision":"Approved","remarks":"ok"}, headers=ho).status_code == 200
    b = client.post("/api/v1/bills", json={"contract_id":"CT-002","period":"Oct 2026","amount_lakh":5.0}, headers=hc).json()
    assert b["status"] == "Pending Approval"

def test_ai_finding_needs_verification_before_resolve():
    from app.database import SessionLocal
    from app import models as m
    db = SessionLocal()
    f = db.query(m.Finding).filter(m.Finding.finding_id == "FND-2026-482").first()
    f.status = "Open"; f.ai_verified = False; db.commit(); db.close()
    t = login("dgms@minenetr.in","dgms123").json()["access_token"]
    h = {"Authorization": f"Bearer {t}"}
    items = client.get("/api/v1/findings", headers=h).json()["items"]
    ai = [f for f in items if f["finding_id"]=="FND-2026-482"][0]
    assert ai["source"] == "AI Detection"
    r = client.patch(f"/api/v1/findings/{ai['finding_id']}", json={"status":"Resolved"}, headers=h)
    assert r.status_code == 422  # must verify first
    r2 = client.patch(f"/api/v1/findings/{ai['finding_id']}", json={"status":"In Progress","ai_verified":True}, headers=h)
    assert r2.status_code == 200
