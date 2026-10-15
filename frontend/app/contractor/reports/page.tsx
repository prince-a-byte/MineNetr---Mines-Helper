'use client';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { contractorNav } from '../page';
import { RoleStub } from '../../components/ops';
export default function P() {
  return (<RoleShell role="contractor" nav={contractorNav} orgTitle="Contractor Workspace" orgSub="ABC Mining Services" mineName="Bharat Coal Mine (BCM-01)"
    banner={<LightBanner title="Reports" sub="Workforce, attendance, billing and compliance reports." />}><RoleStub t="Reports" s="Contractor-scoped reports with date filters and CSV export." /></RoleShell>);
}
