'use client';
import { Suspense } from 'react';
import { InspectorShell } from '../../../components/inspections/ui';
import { MyInspectionsPage } from '../../../components/inspections/main';

/**
 * My Inspections (reference page 2) — thin wrapper only.
 *
 * The page body reads the URL (useSearchParams for ?tab / ?q / ?status / …),
 * which Next 14 requires to sit inside a Suspense boundary in a client
 * component, so the shell renders here and the content is suspended.
 */
export default function MyInspectionsPageWrapper() {
  return (
    <InspectorShell
      title="My Inspections"
      sub="View and manage your assigned inspections, track progress, conduct inspections, and submit reports."
    >
      <Suspense fallback={null}>
        <MyInspectionsPage />
      </Suspense>
    </InspectorShell>
  );
}
