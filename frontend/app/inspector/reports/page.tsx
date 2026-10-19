'use client';
import { InspectorShell } from '../../../components/inspections/ui';
import { ReportsPage } from '../../../components/inspections/reports';

/**
 * Reports — shared-data report register (reference page 8).
 * Reads db.reports from the centralized inspections repository: a report is
 * generated automatically when an inspection is submitted, from the live
 * checklist, evidence and finding counts.
 */
export default function InspectorReportsPage() {
  return (
    <InspectorShell
      title="Reports"
      sub="Review, download and open the inspection reports generated automatically on submission — synthetic DEMO exports, never a DGMS filing."
    >
      <ReportsPage />
    </InspectorShell>
  );
}
