'use client';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { contractorNav } from '../page';
import { BillsManager } from '../../components/ops';
export default function P() {
  return (<RoleShell role="contractor" nav={contractorNav} orgTitle="Contractor Workspace" orgSub="ABC Mining Services" mineName="Bharat Coal Mine (BCM-01)"
    banner={<LightBanner title="Bills & Transactions" sub="Submit bills and track approval and payment." />}><BillsManager canSubmit /></RoleShell>);
}
