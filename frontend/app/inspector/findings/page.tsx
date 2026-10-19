'use client';
import { InspectorShell } from '../../../components/inspections/ui';
import { FindingsPage } from '../../../components/inspections/findings';

/**
 * Findings & Observations — shared-data register (reference page 6).
 * Reads the SAME finding records My Inspections writes to, so a finding raised
 * during an inspection appears here immediately and a status change here
 * updates the inspection's open-finding count and the sidebar badge.
 */
export default function InspectorFindingsPage() {
  return (
    <InspectorShell
      title="Findings & Observations"
      sub="Record observations with severity, evidence linkage and corrective-action routing — all driven by the shared inspection records."
    >
      <FindingsPage />
    </InspectorShell>
  );
}
