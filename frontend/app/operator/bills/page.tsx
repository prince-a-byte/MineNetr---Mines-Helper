'use client';
import RoleShell, { LightBanner } from '../../../components/RoleShell';
import { operatorNav } from '../nav';
import { BillsManager } from '../../../components/ops';
export default function P() {
  return (<RoleShell role="operator" nav={operatorNav} orgTitle="Mine Operations" orgSub="Bharat Coking Coal Ltd." mineName="Bharat Coal Mine (BCM-03)"
    banner={<LightBanner title="Bills & Transactions" sub="Review contractor bills, approve or reject with remarks." />}><BillsManager canDecide /></RoleShell>);
}
