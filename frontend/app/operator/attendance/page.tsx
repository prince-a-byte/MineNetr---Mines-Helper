'use client';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { operatorNav } from '../page';
import { RoleStub } from '../../components/ops';
export default function P() {
  return (<RoleShell role="operator" nav={operatorNav} orgTitle="Mine Operations" orgSub="Bharat Coking Coal Ltd." mineName="Bharat Coal Mine (BCM-03)"
    banner={<LightBanner title="Attendance & Access" sub="Daily attendance, gate access and eligibility." />}><RoleStub t="Attendance & Access" s="Daily present/absent/leave registers, entry-exit times and training-gated access. Manual submissions are labeled manual — never shown as biometric." /></RoleShell>);
}
