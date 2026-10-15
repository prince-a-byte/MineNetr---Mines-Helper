'use client';
import RoleShell, { LightBanner } from '../../../components/RoleShell';
import { operatorNav } from '../nav';
import { RoleStub } from '../../../components/ops';
export default function P() {
  return (<RoleShell role="operator" nav={operatorNav} orgTitle="Mine Operations" orgSub="Bharat Coking Coal Ltd." mineName="Bharat Coal Mine (BCM-03)"
    banner={<LightBanner title="Stockpile Management" sub="Stockpile registry, balances and reconciliation." />}><RoleStub t="Stockpile Management" s="Grade-wise opening/closing balances computed from persisted production inflow and dispatch outflow." /></RoleShell>);
}
