'use client';
import RoleShell, { LightBanner } from '../../../components/RoleShell';
import { inspectorNav } from '../nav';
import { RoleStub } from '../../../components/ops';
export default function P() {
  return (<RoleShell role="inspector" nav={inspectorNav} orgTitle="Mine Inspector (DGMS)" orgSub="Directorate General of Mines Safety" mineName="Bharat Coal Mine (BCM-01)"
    banner={<LightBanner title="Settings" sub="Profile, notifications and sync preferences." />}><RoleStub t="Settings" s="Inspector profile, notification preferences and offline sync settings." /></RoleShell>);
}
