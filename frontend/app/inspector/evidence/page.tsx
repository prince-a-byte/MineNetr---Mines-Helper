'use client';
import { InspectorShell } from '../../../components/inspections/ui';
import { EvidencePage } from '../../../components/inspections/evidence';

/**
 * Photos & Evidence — shared-data gallery (reference page 7).
 * Reads the SAME evidence records the inspection workflow and Findings &
 * Observations use, so attaching, relinking or removing a record here is
 * immediately visible everywhere — including on checklist responses.
 */
export default function InspectorEvidencePage() {
  return (
    <InspectorShell
      title="Photos & Evidence"
      sub="Every photo, document, video reference and inspector note attached to your inspections — with its checklist linkage and DEMO file details."
    >
      <EvidencePage />
    </InspectorShell>
  );
}
