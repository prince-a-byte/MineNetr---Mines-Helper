from sqlalchemy.orm import Session
from app import models
from app.auth import hash_pw

DEMO_USERS = [
    dict(name="Amit Verma", email="dgms@minenetr.in", pw="dgms123", role="dgms", title="Main Administrator (DGMS)", org="DGMS"),
    dict(name="Rajesh Kumar", email="inspector@minenetr.in", pw="inspect123", role="inspector", title="Senior Mine Inspector (DGMS)", org="DGMS", mine_code="BCM-03"),
    dict(name="Vikram Singh", email="operator@minenetr.in", pw="operate123", role="operator", title="Mine Manager", org="BCCL", mine_code="BCM-03"),
    dict(name="Rakesh Kumar", email="contractor@minenetr.in", pw="contract123", role="contractor", title="Contractor Admin", org="ABC Mining Services", contractor_id="CTR-01"),
]

MINES = [
    ("BCM-01","North Karanpura Mine","Jharkhand","Ramgarh","CCL","Opencast","Active","Medium","8.5 MTPA","12 Sep 2026"),
    ("BCM-02","Block II Project","Chhattisgarh","Korba","SECL","Underground","Active","High","6.0 MTPA","08 Sep 2026"),
    ("BCM-03","Bharat Coal Mine","Jharkhand","Dhanbad","BCCL","Opencast","Active","Medium","12.5 MTPA","03 Oct 2026"),
    ("BCM-04","Gevra Mine","Chhattisgarh","Korba","SECL","Opencast","Active","High","52 MTPA","21 Sep 2026"),
    ("BCM-05","Kusmunda Mine","Chhattisgarh","Korba","SECL","Opencast","Active","High","50 MTPA","18 Sep 2026"),
    ("BCM-06","Talcher Mine","Odisha","Angul","MCL","Opencast","Active","Medium","20 MTPA","25 Sep 2026"),
    ("BCM-07","IB Valley Mine","Odisha","Jharsuguda","MCL","Opencast","Under Inspection","High","22 MTPA","02 Oct 2026"),
    ("BCM-08","Singrauli Mine","Madhya Pradesh","Singrauli","NCL","Opencast","Active","Medium","18 MTPA","15 Sep 2026"),
    ("BCM-09","Mand-Raigarh","Chhattisgarh","Raigarh","SECL","Opencast","Active","Low","15 MTPA","28 Sep 2026"),
    ("BCM-10","Sohagpur Mine","Madhya Pradesh","Shahdol","NCL","Underground","Inactive","Low","4 MTPA","10 Aug 2026"),
    ("BCM-11","Lakhanpur Mine","Odisha","Jharsuguda","MCL","Opencast","Active","Medium","20 MTPA","24 Sep 2026"),
    ("BCM-12","Korba West Mine","Chhattisgarh","Korba","SECL","Opencast","Active","Medium","12 MTPA","20 Sep 2026"),
]

INSPECTIONS = [
    ("INS-2026-214","BCM-03","Bharat Coal Mine","Jharkhand","Rajesh Kumar","inspector@minenetr.in","03 Oct 2026","Routine","Completed","Submitted","High"),
    ("INS-2026-213","BCM-04","Gevra Mine","Chhattisgarh","Sunil Prakash","","02 Oct 2026","Safety","In Progress","-","Critical"),
    ("INS-2026-212","BCM-06","Talcher Mine","Odisha","Amit Gupta","","01 Oct 2026","Environmental","Completed","Pending Review","Medium"),
    ("INS-2026-211","BCM-05","Kusmunda Mine","Chhattisgarh","Neha Patel","","30 Sep 2026","Routine","Overdue","Not Submitted","High"),
    ("INS-2026-210","BCM-07","IB Valley Mine","Odisha","Vivek Singh","","29 Sep 2026","Safety","Completed","Submitted","Critical"),
    ("INS-2026-209","BCM-09","Mand-Raigarh","Chhattisgarh","Rajesh Kumar","inspector@minenetr.in","28 Sep 2026","Routine","In Progress","-","Medium"),
    ("INS-2026-208","BCM-08","Singrauli Mine","Madhya Pradesh","Sunil Prakash","","27 Sep 2026","Environmental","Completed","Submitted","Medium"),
    ("INS-2026-207","BCM-01","North Karanpura","Jharkhand","Amit Gupta","","26 Sep 2026","Safety","Overdue","Not Submitted","High"),
    ("INS-2026-206","BCM-02","Block II Project","Chhattisgarh","Neha Patel","","25 Sep 2026","Routine","Completed","Submitted","Low"),
    ("INS-2026-205","BCM-11","Lakhanpur Mine","Madhya Pradesh","Vivek Singh","","24 Sep 2026","Special","In Progress","-","Medium"),
]

FINDINGS = [
    ("FND-2026-482","Bharat Coal Mine","BCM-03","Jharkhand","Safety (PPE)","Critical","Open","AI Detection","AI-detected: Missing PPE in loading area","Pit Area - Loading Point L3","03 Oct 2026","Mine Operator (Bharat Coking Coal Ltd.)","10 Oct 2026",0.94),
    ("FND-2026-481","Gevra Mine","BCM-04","Chhattisgarh","Environment","High","In Progress","Inspector","High dust level detected near haul road","Haul Road H2","02 Oct 2026","Mine Operator (SECL)","09 Oct 2026",0),
    ("FND-2026-480","Talcher Mine","BCM-06","Odisha","Equipment Safety","Medium","Open","Inspector","Conveyor guard missing in section B","Conveyor B","02 Oct 2026","Mine Operator (MCL)","12 Oct 2026",0),
    ("FND-2026-479","Kusmunda Mine","BCM-05","Chhattisgarh","Documentation","High","Open","AI Detection","Expired explosive storage license","Magazine Store","01 Oct 2026","Mine Operator (SECL)","08 Oct 2026",0.88),
    ("FND-2026-478","IB Valley Mine","BCM-07","Odisha","Safety (PPE)","Critical","In Progress","Inspector","Methane level above threshold in Panel 2","Panel 2","30 Sep 2026","Mine Operator (MCL)","07 Oct 2026",0),
    ("FND-2026-477","Mand-Raigarh","BCM-09","Chhattisgarh","Worker Welfare","Medium","Resolved","Inspector","Drinking water facility inadequate","Camp C1","28 Sep 2026","Contractor (ABC)","05 Oct 2026",0),
    ("FND-2026-476","North Karanpura","BCM-01","Jharkhand","Environment","High","Open","Sensor Alert","PM10 above threshold for 3 consecutive readings","Sensor S-12","26 Sep 2026","Mine Operator (CCL)","06 Oct 2026",0),
    ("FND-2026-475","Lakhanpur Mine","BCM-11","Madhya Pradesh","Equipment Safety","Medium","In Progress","AI Detection","Dumper without reverse horn detected","Pit Edge","24 Sep 2026","Mine Operator (MCL)","11 Oct 2026",0.81),
    ("FND-2026-474","Sohagpur Mine","BCM-10","Madhya Pradesh","Safety (PPE)","Low","Resolved","Inspector","First-aid kit expired in rest shelter","Shelter S2","22 Sep 2026","Mine Operator (NCL)","29 Sep 2026",0),
    ("FND-2026-473","Singrauli Mine","BCM-08","Madhya Pradesh","Documentation","High","Open","Inspector","Shift logbook incomplete for week 39","Control Room","20 Sep 2026","Mine Operator (NCL)","10 Oct 2026",0),
]

NOTIFS = [
    ("dgms","High dust level detected","BCM-03 | Underground Mine","Critical","5 mins ago"),
    ("dgms","Methane level above threshold","BCM-07 | Panel 2","Critical","28 mins ago"),
    ("dgms","Missing PPE detected (AI)","BCM-05 | Loading Area","High","1 hour ago"),
    ("dgms","Inspection report pending review","BCM-02 | Routine Inspection","Medium","3 hours ago"),
    ("dgms","Corrective action overdue","BCM-01 | Safety Compliance","Medium","5 hours ago"),
    ("operator","Gas level alert resolved","BCM-03 | CH4 0.9%","Medium","40 mins ago"),
    ("operator","DGMS inspection scheduled","BCM-03 | 06 Oct 2026","High","2 hours ago"),
    ("operator","Contract renewal due","Site Services (CT-003)","High","1 day ago"),
    ("contractor","Bill approved","Coal Transportation | Sep 2026","Medium","3 hours ago"),
    ("contractor","Training certificates expiring","12 workers | 6 days","High","1 day ago"),
    ("contractor","Contract ending soon","Equipment Maintenance | Feb 2026","High","2 days ago"),
    ("inspector","New inspection assigned","BCM-03 | Routine Safety","High","1 hour ago"),
    ("inspector","AI observation needs verification","BCM-03 | Missing PPE","Medium","3 hours ago"),
    ("inspector","Report returned for correction","INSP-2026-055 | BCM-05","Medium","1 day ago"),
]

WORKERS = [
    ("W-1041","Ramesh Yadav","ABC Mining Services","CTR-01","BCM-03","Bharat Coal Mine","Jharkhand","Overburden","Compliant","15 Mar 2027"),
    ("W-1042","Suresh Mahto","ABC Mining Services","CTR-01","BCM-03","Bharat Coal Mine","Jharkhand","Dumper Operator","Compliant","22 Jan 2027"),
    ("W-1043","Anil Kumar","ABC Mining Services","CTR-01","BCM-04","Gevra Mine","Chhattisgarh","Haulage","Expiring","12 Oct 2026"),
    ("W-1044","Prakash Singh","XYZ Infra","CTR-02","BCM-03","Bharat Coal Mine","Jharkhand","Electrician","Compliant","30 Jun 2027"),
    ("W-1045","Manoj Verma","XYZ Infra","CTR-02","BCM-06","Talcher Mine","Odisha","Fitter","Non-Compliant","Expired"),
    ("W-1046","Dinesh Oraon","ABC Mining Services","CTR-01","BCM-05","Kusmunda Mine","Chhattisgarh","Driller","Compliant","11 Dec 2026"),
    ("W-1047","Sunita Devi","ABC Mining Services","CTR-01","BCM-03","Bharat Coal Mine","Jharkhand","General","Compliant","05 May 2027"),
    ("W-1048","Rajesh Tudu","PQR Services","CTR-03","BCM-07","IB Valley Mine","Odisha","Survey","Expiring","20 Oct 2026"),
    ("W-1049","Vikash Kumar","ABC Mining Services","CTR-01","BCM-09","Mand-Raigarh","Chhattisgarh","Dozer Operator","Compliant","18 Feb 2027"),
    ("W-1050","Amit Singh","XYZ Infra","CTR-02","BCM-03","Bharat Coal Mine","Jharkhand","Supervisor","Compliant","09 Apr 2027"),
    ("W-1051","Geeta Kumari","PQR Services","CTR-03","BCM-11","Lakhanpur Mine","Madhya Pradesh","General","Compliant","27 Jul 2027"),
    ("W-1052","Sanjay Mahto","ABC Mining Services","CTR-01","BCM-04","Gevra Mine","Chhattisgarh","Haulage","Non-Compliant","Expired"),
]

CONTRACTS = [
    ("CT-001","Overburden Removal","BCM-03","Bharat Coal Mine","ABC Mining Services","CTR-01","01 Jan 2025","31 Dec 2026",480.0,"Active",68),
    ("CT-002","Coal Transportation","BCM-03","Bharat Coal Mine","ABC Mining Services","CTR-01","15 Feb 2025","14 Feb 2027",620.0,"Active",54),
    ("CT-003","Site Services","BCM-09","Mand-Raigarh","ABC Mining Services","CTR-01","10 Apr 2025","09 Apr 2027",150.0,"Active",41),
    ("CT-004","Equipment Maintenance","BCM-04","Gevra Mine","ABC Mining Services","CTR-01","01 Mar 2025","28 Feb 2026",210.0,"Ending Soon",82),
    ("CT-005","Exploration Support","BCM-12","Korba West Mine","ABC Mining Services","CTR-01","01 Jun 2025","31 May 2026",95.0,"Ending Soon",70),
    ("CT-006","Electrical Maintenance","BCM-03","Bharat Coal Mine","XYZ Infra","CTR-02","01 Jul 2025","30 Jun 2027",180.0,"Active",35),
]

BILLS = [
    ("BILL-2026-031","CT-002","Coal Transportation","BCM-03","Bharat Coal Mine","CTR-01","ABC Mining Services","Sep 2026",12.4,"Pending Approval","01 Oct 2026",""),
    ("BILL-2026-030","CT-001","Overburden Removal","BCM-03","Bharat Coal Mine","CTR-01","ABC Mining Services","Sep 2026",9.8,"Pending Approval","01 Oct 2026",""),
    ("BILL-2026-029","CT-004","Equipment Maintenance","BCM-04","Gevra Mine","CTR-01","ABC Mining Services","Sep 2026",6.2,"Pending Approval","30 Sep 2026",""),
    ("BILL-2026-028","CT-002","Coal Transportation","BCM-03","Bharat Coal Mine","CTR-01","ABC Mining Services","Aug 2026",11.9,"Approved","02 Sep 2026","Verified against weighbridge"),
    ("BILL-2026-027","CT-001","Overburden Removal","BCM-03","Bharat Coal Mine","CTR-01","ABC Mining Services","Aug 2026",10.1,"Paid","20 Sep 2026","Released"),
    ("BILL-2026-026","CT-003","Site Services","BCM-09","Mand-Raigarh","CTR-01","ABC Mining Services","Aug 2026",4.4,"Rejected","05 Sep 2026","Supporting logbook missing"),
]

def seed(db: Session):
    out = {"seeded": False, "backfilled": []}
    if db.query(models.User).count() == 0:
        for u in DEMO_USERS:
            db.add(models.User(name=u["name"], email=u["email"], password_hash=hash_pw(u["pw"]),
                role=u["role"], title=u.get("title",""), org=u.get("org",""),
                mine_code=u.get("mine_code",""), contractor_id=u.get("contractor_id","")))
        out["seeded"] = True
    # keep demo display names/titles in sync with DEMO_USERS (dev only)
    for u in DEMO_USERS:
        ex = db.query(models.User).filter(models.User.email == u["email"]).first()
        if ex and (ex.name != u["name"] or ex.title != u.get("title", "")):
            ex.name, ex.title = u["name"], u.get("title", "")
            out["backfilled"].append(f"user:{u['email']}")
    # backfill any empty table so upgrades apply to existing dev DBs
    if db.query(models.Mine).count() == 0:
        for m in MINES:
            db.add(models.Mine(code=m[0], name=m[1], state=m[2], district=m[3], operator=m[4],
                mine_type=m[5], status=m[6], risk_level=m[7], production_capacity=m[8], last_inspection=m[9]))
        out["backfilled"].append("mines")
    if db.query(models.Inspection).count() == 0:
        for i in INSPECTIONS:
            db.add(models.Inspection(inspection_id=i[0], mine_code=i[1], mine_name=i[2], state=i[3],
                inspector=i[4], inspector_email=i[5], scheduled_date=i[6], inspection_type=i[7],
                status=i[8], report_status=i[9], priority=i[10], workflow_state="PENDING_ADMIN" if i[9]=="Pending Review" else ("APPROVED" if i[8]=="Completed" else "IN_PROGRESS")))
        out["backfilled"].append("inspections")
    if db.query(models.Finding).count() == 0:
        for f in FINDINGS:
            db.add(models.Finding(finding_id=f[0], mine_name=f[1], mine_code=f[2], state=f[3],
                category=f[4], severity=f[5], status=f[6], source=f[7], description=f[8],
                location=f[9], date_detected=f[10], assigned_to=f[11], target_date=f[12], ai_confidence=f[13],
                ai_verified=(f[7]!="AI Detection")))
        out["backfilled"].append("findings")
    if db.query(models.Notification).count() == 0:
        for n in NOTIFS:
            db.add(models.Notification(role=n[0], title=n[1], subtitle=n[2], severity=n[3], time_ago=n[4]))
        out["backfilled"].append("notifications")
    else:
        # upsert any missing demo notifications (e.g. new roles added later)
        have = {(n.role, n.title) for n in db.query(models.Notification).all()}
        added = 0
        for n in NOTIFS:
            if (n[0], n[1]) not in have:
                db.add(models.Notification(role=n[0], title=n[1], subtitle=n[2], severity=n[3], time_ago=n[4]))
                added += 1
        if added:
            out["backfilled"].append(f"notifications:+{added}")
    if db.query(models.Worker).count() == 0:
        for w in WORKERS:
            db.add(models.Worker(worker_id=w[0], name=w[1], contractor=w[2], contractor_id=w[3],
                mine_code=w[4], mine_name=w[5], state=w[6], work_type=w[7], compliance=w[8], training_valid_till=w[9]))
        out["backfilled"].append("workers")
    if db.query(models.Contract).count() == 0:
        for c in CONTRACTS:
            db.add(models.Contract(contract_id=c[0], name=c[1], mine_code=c[2], mine_name=c[3],
                contractor=c[4], contractor_id=c[5], start_date=c[6], end_date=c[7],
                value_lakh=c[8], status=c[9], progress=c[10]))
        out["backfilled"].append("contracts")
    if db.query(models.Bill).count() == 0:
        for b in BILLS:
            db.add(models.Bill(bill_id=b[0], contract_id=b[1], contract_name=b[2], mine_code=b[3],
                mine_name=b[4], contractor_id=b[5], contractor=b[6], period=b[7],
                amount_lakh=b[8], status=b[9], submitted_on=b[10], remarks=b[11]))
        out["backfilled"].append("bills")
    db.commit()
    return out
