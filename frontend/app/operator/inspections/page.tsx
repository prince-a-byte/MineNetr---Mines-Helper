'use client';
import RoleShell, { LightBanner } from '../../../components/RoleShell';
import { operatorNav } from '../nav';
import { InspectionsTable } from '../../../components/ops';
export default function P() {
  return (<RoleShell role="operator" nav={operatorNav} orgTitle="Mine Operations" orgSub="Bharat Coking Coal Ltd." mineName="Bharat Coal Mine (BCM-03)"
    banner={<LightBanner title="Inspection & Audit" sub="Submitted findings, corrective actions and audit timeline." />}><InspectionsTable /></RoleShell>);
}
