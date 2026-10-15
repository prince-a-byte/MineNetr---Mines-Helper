'use client';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { inspectorNav } from '../page';
import { RoleStub } from '../../components/ops';
export default function P() {
  return (<RoleShell role="inspector" nav={inspectorNav} orgTitle="Mine Inspector (DGMS)" orgSub="Directorate General of Mines Safety" mineName="Bharat Coal Mine (BCM-01)"
    banner={<LightBanner title="Reports" sub="Review, generate and submit inspection reports." />}><RoleStub t="Reports" s="Reports generated from saved inspection data with evidence attachments." /></RoleShell>);
}
