/**
 * Shared page shell for every contractor-portal route.
 *
 * Guarantees consistency without each page re-implementing the wiring:
 *  - the shared RoleShell sidebar/header (reused, never duplicated),
 *  - the permission-scoped mine selector in the header (persisted in the
 *    centralized store, so the selection survives navigation and reloads),
 *  - the live unread-notification badge on the nav,
 *  - the live toast layer.
 *
 * Pages pass only their banner title/subtitle and their content.
 */
'use client';
import RoleShell, { LightBanner } from '../RoleShell';
import { useContractorNav } from '../../app/contractor/nav';
import { actions, useMockWorkforce } from '../../lib/workforce/store';
import { identityContractor, mines } from '../../lib/workforce/seed';
import { WorkforceToasts } from './ui';

export function ContractorShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  const db = useMockWorkforce();
  const nav = useContractorNav();
  const mineOptions = [
    { id: 'ALL', label: 'All Assigned Mines' },
    ...mines.map((m) => ({ id: m.id, label: `${m.name} (${m.code})` })),
  ];

  return (
    <RoleShell
      role="contractor"
      nav={nav}
      orgTitle="Contractor Workspace"
      orgSub={identityContractor.name}
      mineOptions={mineOptions}
      mineValue={db.selectedMineId}
      onMineChange={(id) => actions.setSelectedMine(id)}
      profileSub={identityContractor.name}
      banner={<LightBanner title={title} sub={sub} />}
    >
      <WorkforceToasts />
      {children}
    </RoleShell>
  );
}
