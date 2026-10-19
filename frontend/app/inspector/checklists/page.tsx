'use client';
import { InspectorShell } from '../../../components/inspections/ui';
import { ChecklistsLibrary } from '../../../components/inspections/templates';

/**
 * Checklists & Forms — shared template library (reference page 5).
 * Reads the SAME template/item definitions the inspection workflow instantiates.
 */
export default function ChecklistsPage() {
  return (
    <InspectorShell
      title="Checklists & Forms"
      sub="Browse the shared checklist library, preview every section and item, and clone a form before scheduling an inspection."
    >
      <ChecklistsLibrary />
    </InspectorShell>
  );
}
