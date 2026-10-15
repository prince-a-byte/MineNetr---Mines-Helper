'use client';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { contractorNav } from '../page';
import { RoleStub } from '../../components/ops';
export default function P() {
  return (<RoleShell role="contractor" nav={contractorNav} orgTitle="Contractor Workspace" orgSub="ABC Mining Services" mineName="Bharat Coal Mine (BCM-01)"
    banner={<LightBanner title="Attendance & Access" sub="Submit and track attendance for your workers." />}><RoleStub t="Attendance & Access" s="Manual attendance submission for authorized workers. Manual entries are labeled manual — never biometric." /></RoleShell>);
}
