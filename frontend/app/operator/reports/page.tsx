'use client';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { operatorNav } from '../page';
import { RoleStub } from '../../components/ops';
export default function P() {
  return (<RoleShell role="operator" nav={operatorNav} orgTitle="Mine Operations" orgSub="Bharat Coking Coal Ltd." mineName="Bharat Coal Mine (BCM-03)"
    banner={<LightBanner title="Reports" sub="Operational reports from real query results." />}><RoleStub t="Reports" s="Date-ranged production, dispatch, attendance and compliance reports with CSV export." /></RoleShell>);
}
