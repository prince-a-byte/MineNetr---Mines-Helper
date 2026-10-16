import DashboardSkeleton from '../../components/ui/DashboardSkeleton';

export default function Loading() {
  return (
    <DashboardSkeleton
      kpis={6}
      tableColumns={['Inspection ID', 'Mine', 'Inspector', 'Date', 'Status', 'Report']}
    />
  );
}
