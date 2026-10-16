import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { services } from '../services/serviceProvider';
import { mockRepo } from '../repositories/mockStore';
import { useEffect, useState } from 'react';

export const qk = {
  dashboard: ['dashboard'] as const,
  workers: (f: object) => ['workers', f] as const,
  worker: (id: string) => ['worker', id] as const,
  mines: (q: string, s: string) => ['mines', q, s] as const,
  mine: (id: string) => ['mine', id] as const,
  docs: (f: object) => ['docs', f] as const,
  bills: (f: object) => ['bills', f] as const,
  bill: (id: string) => ['bill', id] as const,
  txns: ['txns'] as const,
  company: ['company'] as const,
  notifs: ['notifs'] as const,
};

/** Re-runs the query whenever the mock repository changes (create/edit flows). */
export function useRepoVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => mockRepo.subscribe(() => setV((x) => x + 1)), []);
  return v;
}

export function useDashboard() {
  return useQuery({ queryKey: qk.dashboard, queryFn: () => services.dashboard.summary() });
}
export function useActivities(limit = 6) {
  return useQuery({ queryKey: ['activities', limit], queryFn: () => services.dashboard.recentUpdates(limit) });
}
export function useCompany() {
  return useQuery({ queryKey: qk.company, queryFn: () => services.profile.getCompany() });
}
export function useNotifications() {
  return useQuery({ queryKey: qk.notifs, queryFn: () => services.notifications.list() });
}
export function useInvalidation() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => services.auth.logout(),
    onSuccess: () => qc.clear(),
  });
}
