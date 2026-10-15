'use client';
import RoleShell, { LightBanner } from '../../../components/RoleShell';
import { operatorNav } from '../nav';
import { RoleStub } from '../../../components/ops';
export default function P() {
  return (<RoleShell role="operator" nav={operatorNav} orgTitle="Mine Operations" orgSub="Bharat Coking Coal Ltd." mineName="Bharat Coal Mine (BCM-03)"
    banner={<LightBanner title="Production & Dispatch" sub="Production records, dispatch, vehicles and weighbridge." />}><RoleStub t="Production & Dispatch" s="Shift production entries, dispatch challans, truck registry and weighbridge transactions with destination tracking." /></RoleShell>);
}
