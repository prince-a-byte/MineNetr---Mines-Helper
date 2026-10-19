'use client';
/**
 * MineNetr — Contractor Dashboard (/contractor).
 *
 * The page composes the shared ContractorShell (sidebar/header, mine selector,
 * notification badge, toast layer and the mining banner) around the dashboard
 * body in components/workforce/dashboard.tsx, which reads the centralized
 * synthetic stores — no backend, no fetch, no skeleton.
 */
import { ContractorShell } from '../../components/workforce/shell';
import { ContractorDashboard } from '../../components/workforce/dashboard';

export default function ContractorDashboardPage() {
  return (
    <ContractorShell
      title="Contractor Dashboard"
      sub="Manage your workforce, contracts, compliance documents and billing for a safer and more transparent mining operation."
    >
      <ContractorDashboard />
    </ContractorShell>
  );
}
