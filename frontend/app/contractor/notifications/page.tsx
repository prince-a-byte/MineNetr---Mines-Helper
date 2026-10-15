'use client';
import RoleShell, { LightBanner } from '../../../components/RoleShell';
import { contractorNav } from '../nav';
import { NotificationsPanel } from '../../../components/ops';
export default function P() {
  return (<RoleShell role="contractor" nav={contractorNav} orgTitle="Contractor Workspace" orgSub="ABC Mining Services" mineName="Bharat Coal Mine (BCM-01)"
    banner={<LightBanner title="Notifications" sub="Renewals, expiries, bill decisions and access alerts." />}><NotificationsPanel /></RoleShell>);
}
