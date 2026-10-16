import DashboardSkeleton from '../../components/ui/DashboardSkeleton';

export default function Loading() {
  return (
    <DashboardSkeleton
      kpis={5}
      tableColumns={['Worker ID', 'Name', 'Contractor', 'Mine', 'Compliance', 'Training Valid Till']}
    />
  );
}
