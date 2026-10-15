'use client';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { operatorNav } from '../page';
import { RoleStub } from '../../components/ops';
export default function P() {
  return (<RoleShell role="operator" nav={operatorNav} orgTitle="Mine Operations" orgSub="Bharat Coking Coal Ltd." mineName="Bharat Coal Mine (BCM-03)"
    banner={<LightBanner title="Settings" sub="Profile, security and notification preferences." />}><RoleStub t="Settings" s="Inspector profile, password change, notification preferences and session management." /></RoleShell>);
}
