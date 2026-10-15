import uuid
from datetime import datetime
from sqlalchemy import (Column, String, Integer, Float, Boolean, DateTime, Date,
    Text, ForeignKey, Enum as SAEnum, JSON)
from sqlalchemy.orm import relationship
from app.database import Base
import enum

def uid(): return str(uuid.uuid4())

class RoleEnum(str, enum.Enum):
    OPERATOR = "operator"
    CONTRACTOR = "contractor"
    DGMS = "dgms"
    INSPECTOR = "inspector"

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, index=True)  # operator|contractor|dgms|inspector
    title = Column(String, default="")
    org = Column(String, default="")
    mine_code = Column(String, default="")  # scope for operator/inspector
    contractor_id = Column(String, default="")  # scope for contractor
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Mine(Base):
    __tablename__ = "mines"
    id = Column(String, primary_key=True, default=uid)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    state = Column(String, index=True)
    district = Column(String, default="")
    operator = Column(String, default="")
    mine_type = Column(String, default="Opencast")
    status = Column(String, default="Active")  # Active|Under Inspection|Inactive
    risk_level = Column(String, default="Medium")  # Low|Medium|High|Critical
    production_capacity = Column(String, default="")
    last_inspection = Column(String, default="")
    latitude = Column(Float, default=0)
    longitude = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class Inspection(Base):
    __tablename__ = "inspections"
    id = Column(String, primary_key=True, default=uid)
    inspection_id = Column(String, unique=True, index=True)  # INS-2026-214
    mine_code = Column(String, ForeignKey("mines.code"), index=True)
    mine_name = Column(String, default="")
    state = Column(String, default="")
    inspector = Column(String, default="")
    inspector_email = Column(String, default="")
    scheduled_date = Column(String, default="")
    inspection_type = Column(String, default="Routine")
    status = Column(String, default="Pending")  # Completed|In Progress|Pending|Overdue
    report_status = Column(String, default="-")  # Submitted|Pending Review|Not Submitted|-
    priority = Column(String, default="Medium")
    workflow_state = Column(String, default="DRAFT")
    created_at = Column(DateTime, default=datetime.utcnow)

class Finding(Base):
    __tablename__ = "findings"
    id = Column(String, primary_key=True, default=uid)
    finding_id = Column(String, unique=True, index=True)  # FND-2026-482
    mine_name = Column(String, default="")
    mine_code = Column(String, default="")
    state = Column(String, default="")
    category = Column(String, default="Safety (PPE)")
    severity = Column(String, default="Medium")  # Critical|High|Medium|Low
    status = Column(String, default="Open")  # Open|In Progress|Resolved
    source = Column(String, default="Inspector")  # Inspector|AI Detection|Sensor Alert
    description = Column(String, default="")
    location = Column(String, default="")
    date_detected = Column(String, default="")
    assigned_to = Column(String, default="")
    target_date = Column(String, default="")
    ai_verified = Column(Boolean, default=False)
    ai_confidence = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, default=uid)
    role = Column(String, index=True, default="dgms")
    title = Column(String, nullable=False)
    subtitle = Column(String, default="")
    severity = Column(String, default="Medium")  # Critical|High|Medium|Low
    time_ago = Column(String, default="")
    read = Column(Boolean, default=False)
    link = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True, default=uid)
    actor = Column(String, default="")
    role = Column(String, default="")
    action = Column(String, default="")
    target = Column(String, default="")
    timestamp = Column(DateTime, default=datetime.utcnow)
    outcome = Column(String, default="success")
    details = Column(Text, default="")

class Worker(Base):
    __tablename__ = "workers"
    id = Column(String, primary_key=True, default=uid)
    worker_id = Column(String, unique=True, index=True)  # W-1042
    name = Column(String, nullable=False)
    contractor = Column(String, default="")
    contractor_id = Column(String, index=True, default="")
    mine_code = Column(String, index=True, default="")
    mine_name = Column(String, default="")
    state = Column(String, default="")
    work_type = Column(String, default="General")
    compliance = Column(String, default="Compliant")  # Compliant|Expiring|Non-Compliant
    training_valid_till = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

class Contract(Base):
    __tablename__ = "contracts"
    id = Column(String, primary_key=True, default=uid)
    contract_id = Column(String, unique=True, index=True)  # CT-003
    name = Column(String, nullable=False)
    mine_code = Column(String, index=True, default="")
    mine_name = Column(String, default="")
    contractor = Column(String, default="")
    contractor_id = Column(String, index=True, default="")
    start_date = Column(String, default="")
    end_date = Column(String, default="")
    value_lakh = Column(Float, default=0)
    status = Column(String, default="Active")  # Active|Ending Soon|Pending Renewal|Expired
    progress = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class Bill(Base):
    __tablename__ = "bills"
    id = Column(String, primary_key=True, default=uid)
    bill_id = Column(String, unique=True, index=True)  # BILL-2026-031
    contract_id = Column(String, index=True, default="")
    contract_name = Column(String, default="")
    mine_code = Column(String, default="")
    mine_name = Column(String, default="")
    contractor_id = Column(String, index=True, default="")
    contractor = Column(String, default="")
    period = Column(String, default="")
    amount_lakh = Column(Float, default=0)
    status = Column(String, default="Draft")  # Draft|Pending Approval|Approved|Rejected|Paid
    submitted_on = Column(String, default="")
    remarks = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
