'use client';
import { LayoutDashboard, ClipboardList, CalendarDays, ListChecks, TriangleAlert, Camera, Leaf, Truck, Users, BarChart3, ShieldCheck, MessagesSquare, FolderClosed, Settings } from 'lucide-react';
import { useMockInspections } from '../../lib/inspections/store';
import { effectiveStatusOf } from '../../lib/inspections/format';

export const inspectorNav = [
  { href: '/inspector', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inspector/inspections', label: 'My Inspections', icon: ClipboardList },
  { href: '/inspector/schedule', label: 'Inspection Schedule', icon: CalendarDays },
  { href: '/inspector/checklists', label: 'Checklists & Forms', icon: ListChecks },
  { href: '/inspector/findings', label: 'Findings & Observations', icon: TriangleAlert },
  { href: '/inspector/evidence', label: 'Photos & Evidence', icon: Camera },
  { href: '/inspector/safety', label: 'Safety & Environment', icon: Leaf },
  { href: '/inspector/production', label: 'Production & Dispatch', icon: Truck },
  { href: '/inspector/workers', label: 'Workers & Contractor', icon: Users },
  { href: '/inspector/reports', label: 'Reports', icon: BarChart3 },
  { href: '/inspector/compliance', label: 'Compliance Status', icon: ShieldCheck },
  { href: '/inspector/communications', label: 'Communications', icon: MessagesSquare },
  { href: '/inspector/documents', label: 'Documents', icon: FolderClosed },
  { href: '/inspector/settings', label: 'Settings', icon: Settings },
];

/**
 * The shared inspector navigation with live badges derived from the centralized
 * inspections store — overdue work on My Inspections, unresolved findings on
 * Findings & Observations. The counts update the moment a record changes.
 */
export function useInspectorNav() {
  const { inspections, findings } = useMockInspections();
  const overdue = inspections.filter((i) => effectiveStatusOf(i) === 'Overdue').length;
  const openFindings = findings.filter((f) => f.status !== 'Resolved').length;
  return inspectorNav.map((n) => {
    if (n.href === '/inspector/inspections') return { ...n, badge: overdue || undefined };
    if (n.href === '/inspector/findings') return { ...n, badge: openFindings || undefined };
    return n;
  });
}
