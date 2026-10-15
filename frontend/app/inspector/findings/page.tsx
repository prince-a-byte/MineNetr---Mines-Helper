'use client';
import { useState } from 'react';
import RoleShell, { LightBanner } from '../../components/RoleShell';
import { inspectorNav } from '../page';
import { FindingsTable, FindingForm } from '../../components/ops';

export default function FindingsPage() {
  const [k, setK] = useState(0);
  return (
    <RoleShell role="inspector" nav={inspectorNav} orgTitle="Mine Inspector (DGMS)" orgSub="Directorate General of Mines Safety" mineName="Bharat Coal Mine (BCM-01)"
      banner={<LightBanner title="Findings & Observations" sub="Record findings with severity, evidence linkage and corrective-action routing." />}>
      <div className="grid xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2"><FindingsTable key={k} /></div>
        <div><FindingForm onDone={() => setK(x => x + 1)} /></div>
      </div>
    </RoleShell>
  );
}
