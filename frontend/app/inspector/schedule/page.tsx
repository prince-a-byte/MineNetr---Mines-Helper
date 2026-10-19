'use client';
import { InspectorShell } from '../../../components/inspections/ui';
import { ScheduleCalendar } from '../../../components/inspections/schedule';

/**
 * Inspection Schedule — shared-data calendar (reference page 4).
 * Every entry is derived from the same inspection records the My Inspections
 * table, KPIs and the individual workflow read, so a change in one place is
 * immediately visible here.
 */
export default function InspectorSchedulePage() {
  return (
    <InspectorShell
      title="Inspection Schedule"
      sub="Plan the month, move a slot or request a reschedule — every change updates the shared inspection record."
    >
      <ScheduleCalendar />
    </InspectorShell>
  );
}
