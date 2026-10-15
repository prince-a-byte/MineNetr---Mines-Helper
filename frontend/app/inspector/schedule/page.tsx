'use client';
import RoleShell, { LightBanner } from '../../../components/RoleShell';
import { inspectorNav } from '../nav';
import { InspectionsTable } from '../../../components/ops';
export default function P() {
  return (<RoleShell role="inspector" nav={inspectorNav} orgTitle="Mine Inspector (DGMS)" orgSub="Directorate General of Mines Safety" mineName="Bharat Coal Mine (BCM-01)"
    banner={<LightBanner title="Inspection Schedule" sub="Calendar and list of assigned inspections." />}><InspectionsTable /></RoleShell>);
}
