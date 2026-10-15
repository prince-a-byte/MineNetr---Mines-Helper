'use client';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { operatorNav } from '../page';
import { ContractsTable } from '../../components/ops';
export default function P() {
  return (<RoleShell role="operator" nav={operatorNav} orgTitle="Mine Operations" orgSub="Bharat Coking Coal Ltd." mineName="Bharat Coal Mine (BCM-03)"
    banner={<LightBanner title="Contractors" sub="Contract directory, milestones, status and compliance." />}><ContractsTable /></RoleShell>);
}
