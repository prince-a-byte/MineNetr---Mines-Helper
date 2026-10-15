'use client';
import RoleShell, { LightBanner } from '../../../components/RoleShell';
import { operatorNav } from '../nav';
import { RoleStub } from '../../../components/ops';
export default function P() {
  return (<RoleShell role="operator" nav={operatorNav} orgTitle="Mine Operations" orgSub="Bharat Coking Coal Ltd." mineName="Bharat Coal Mine (BCM-03)"
    banner={<LightBanner title="Documents & Compliance" sub="Document registry, validity and expiry alerts." />}><RoleStub t="Documents & Compliance" s="Licenses, permits and certificates with issue/expiry dates and verification status." /></RoleShell>);
}
