'use client';
import { Suspense } from 'react';
import { InspectorShell } from '../../../../components/inspections/ui';
import { InspectionDetailPage } from '../../../../components/inspections/detail';

/**
 * Individual inspection workflow (reference page 3) — route
 * /inspector/inspections/[inspectionId].
 *
 * The component reads the `?tab=` deep link with useSearchParams, which Next
 * 14 requires to sit under a Suspense boundary.
 */
export default function InspectorInspectionDetailRoute({
  params,
}: {
  params: { id: string };
}) {
  return (
    <InspectorShell
      title="Inspection in progress"
      sub="Work through the checklist, capture evidence, raise findings and submit — one shared record drives every view."
    >
      <Suspense fallback={null}>
        <InspectionDetailPage inspectionId={params.id} />
      </Suspense>
    </InspectorShell>
  );
}
