'use client';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { contractorNav } from '../page';
import { RoleStub } from '../../components/ops';
export default function P() {
  return (<RoleShell role="contractor" nav={contractorNav} orgTitle="Contractor Workspace" orgSub="ABC Mining Services" mineName="Bharat Coal Mine (BCM-01)"
    banner={<LightBanner title="Documents & Compliance" sub="Licenses, insurance and worker certificates." />}><RoleStub t="Documents & Compliance" s="Upload licenses, contracts, worker certificates and insurance with expiry tracking." /></RoleShell>);
}
