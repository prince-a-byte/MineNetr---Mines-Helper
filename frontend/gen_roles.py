import os

def w(path, body):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(body)

OP = """'use client';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { operatorNav } from '../page';
import { %s } from '../../components/ops';
export default function P() {
  return (<RoleShell role="operator" nav={operatorNav} orgTitle="Mine Operations" orgSub="Bharat Coking Coal Ltd." mineName="Bharat Coal Mine (BCM-03)"
    banner={<LightBanner title="%s" sub="%s" />}>%s</RoleShell>);
}
"""
CT = """'use client';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { contractorNav } from '../page';
import { %s } from '../../components/ops';
export default function P() {
  return (<RoleShell role="contractor" nav={contractorNav} orgTitle="Contractor Workspace" orgSub="ABC Mining Services" mineName="Bharat Coal Mine (BCM-01)"
    banner={<LightBanner title="%s" sub="%s" />}>%s</RoleShell>);
}
"""
IN = """'use client';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { inspectorNav } from '../page';
import { %s } from '../../components/ops';
export default function P() {
  return (<RoleShell role="inspector" nav={inspectorNav} orgTitle="Mine Inspector (DGMS)" orgSub="Directorate General of Mines Safety" mineName="Bharat Coal Mine (BCM-01)"
    banner={<LightBanner title="%s" sub="%s" />}>%s</RoleShell>);
}
"""

ops_pages = [
    ('workers', 'WorkersTable', 'Workers & Manpower', 'Workforce directory, assignments, training and certification status.', '<WorkersTable canAdd />'),
    ('contractors', 'ContractsTable', 'Contractors', 'Contract directory, milestones, status and compliance.', '<ContractsTable />'),
    ('attendance', 'RoleStub', 'Attendance & Access', 'Daily attendance, gate access and eligibility.', '<RoleStub t="Attendance & Access" s="Daily present/absent/leave registers, entry-exit times and training-gated access. Manual submissions are labeled manual — never shown as biometric." />'),
    ('production', 'RoleStub', 'Production & Dispatch', 'Production records, dispatch, vehicles and weighbridge.', '<RoleStub t="Production & Dispatch" s="Shift production entries, dispatch challans, truck registry and weighbridge transactions with destination tracking." />'),
    ('stockpile', 'RoleStub', 'Stockpile Management', 'Stockpile registry, balances and reconciliation.', '<RoleStub t="Stockpile Management" s="Grade-wise opening/closing balances computed from persisted production inflow and dispatch outflow." />'),
    ('bills', 'BillsManager', 'Bills & Transactions', 'Review contractor bills, approve or reject with remarks.', '<BillsManager canDecide />'),
    ('documents', 'RoleStub', 'Documents & Compliance', 'Document registry, validity and expiry alerts.', '<RoleStub t="Documents & Compliance" s="Licenses, permits and certificates with issue/expiry dates and verification status." />'),
    ('reports', 'RoleStub', 'Reports', 'Operational reports from real query results.', '<RoleStub t="Reports" s="Date-ranged production, dispatch, attendance and compliance reports with CSV export." />'),
    ('inspections', 'InspectionsTable', 'Inspection & Audit', 'Submitted findings, corrective actions and audit timeline.', '<InspectionsTable />'),
    ('settings', 'RoleStub', 'Settings', 'Profile, security and notification preferences.', '<RoleStub t="Settings" s="Inspector profile, password change, notification preferences and session management." />'),
]
for slug, comp, title, sub, body in ops_pages:
    w(f'app/operator/{slug}/page.tsx', OP % (comp, title, sub, body))

ct_pages = [
    ('contracts', 'ContractsTable', 'My Contracts', 'Contracts, milestones and renewal requests.', '<ContractsTable allowRenewal />'),
    ('workers', 'WorkersTable', 'Workers & Manpower', 'Register and manage your deployed workforce.', '<WorkersTable canAdd />'),
    ('attendance', 'RoleStub', 'Attendance & Access', 'Submit and track attendance for your workers.', '<RoleStub t="Attendance & Access" s="Manual attendance submission for authorized workers. Manual entries are labeled manual — never biometric." />'),
    ('bills', 'BillsManager', 'Bills & Transactions', 'Submit bills and track approval and payment.', '<BillsManager canSubmit />'),
    ('documents', 'RoleStub', 'Documents & Compliance', 'Licenses, insurance and worker certificates.', '<RoleStub t="Documents & Compliance" s="Upload licenses, contracts, worker certificates and insurance with expiry tracking." />'),
    ('reports', 'RoleStub', 'Reports', 'Workforce, attendance, billing and compliance reports.', '<RoleStub t="Reports" s="Contractor-scoped reports with date filters and CSV export." />'),
    ('notifications', 'NotificationsPanel', 'Notifications', 'Renewals, expiries, bill decisions and access alerts.', '<NotificationsPanel />'),
]
for slug, comp, title, sub, body in ct_pages:
    w(f'app/contractor/{slug}/page.tsx', CT % (comp, title, sub, body))

in_pages = [
    ('schedule', 'InspectionsTable', 'Inspection Schedule', 'Calendar and list of assigned inspections.', '<InspectionsTable />'),
    ('safety', 'RoleStub', 'Safety & Environment', 'Gas, dust, temperature readings and thresholds.', '<RoleStub t="Safety & Environment" s="Demo sensor readings are labeled simulated with freshness timestamps. Not a certified real-time safety system." />'),
    ('production', 'RoleStub', 'Production & Dispatch', 'Verify production, stockpile and dispatch records.', '<RoleStub t="Production & Dispatch" s="Read-only verification view of operator-submitted production and dispatch." />'),
    ('workers', 'WorkersTable', 'Workers & Contractor', 'Workforce compliance for assigned mines.', '<WorkersTable />'),
    ('reports', 'RoleStub', 'Reports', 'Review, generate and submit inspection reports.', '<RoleStub t="Reports" s="Reports generated from saved inspection data with evidence attachments." />'),
    ('compliance', 'RoleStub', 'Compliance Status', 'Mine-wise compliance summary.', '<RoleStub t="Compliance Status" s="Compliance posture derived from verified findings and corrective actions." />'),
    ('communications', 'NotificationsPanel', 'Communications', 'Assignments, clarifications and finding updates.', '<NotificationsPanel />'),
    ('documents', 'RoleStub', 'Documents', 'Checklists, templates and safety procedures.', '<RoleStub t="Documents" s="Authorized checklist templates and statutory safety procedures." />'),
    ('settings', 'RoleStub', 'Settings', 'Profile, notifications and sync preferences.', '<RoleStub t="Settings" s="Inspector profile, notification preferences and offline sync settings." />'),
]
for slug, comp, title, sub, body in in_pages:
    w(f'app/inspector/{slug}/page.tsx', IN % (comp, title, sub, body))

print('generated')
