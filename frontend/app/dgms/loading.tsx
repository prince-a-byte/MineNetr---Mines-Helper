import DashboardSkeleton from '../../components/ui/DashboardSkeleton';

export default function Loading() {
  return (
    <DashboardSkeleton
      kpis={5}
      tableColumns={['Mine Code', 'Mine Name', 'State', 'Operator', 'Status', 'Risk Level', 'Last Inspection']}
    />
  );
}
