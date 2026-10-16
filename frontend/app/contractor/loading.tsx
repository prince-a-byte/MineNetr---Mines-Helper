import DashboardSkeleton from '../../components/ui/DashboardSkeleton';

export default function Loading() {
  return (
    <DashboardSkeleton
      kpis={4}
      tableColumns={['Bill ID', 'Contract', 'Mine', 'Period', 'Amount', 'Status']}
    />
  );
}
