'use client';
import RoleShell, { LightBanner } from '../../../components/RoleShell';
import { inspectorNav } from '../nav';
import { RoleStub } from '../../../components/ops';
export default function P() {
  return (<RoleShell role="inspector" nav={inspectorNav} orgTitle="Mine Inspector (DGMS)" orgSub="Directorate General of Mines Safety" mineName="Bharat Coal Mine (BCM-01)"
    banner={<LightBanner title="Documents" sub="Checklists, templates and safety procedures." />}><RoleStub t="Documents" s="Authorized checklist templates and statutory safety procedures." /></RoleShell>);
}
