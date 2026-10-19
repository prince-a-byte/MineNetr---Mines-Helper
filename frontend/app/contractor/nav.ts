'use client';
import { LayoutDashboard, FileText, Users, CalendarCheck, Receipt, FolderCheck, BarChart3, Bell } from 'lucide-react';
import { useMockWorkforce } from '../../lib/workforce/store';

export const contractorNav = [
  { href: '/contractor', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contractor/contracts', label: 'My Contracts', icon: FileText },
  { href: '/contractor/workers', label: 'Workers & Manpower', icon: Users },
  { href: '/contractor/attendance', label: 'Attendance & Access', icon: CalendarCheck },
  { href: '/contractor/bills', label: 'Bills & Transactions', icon: Receipt },
  { href: '/contractor/documents', label: 'Documents & Compliance', icon: FolderCheck },
  { href: '/contractor/reports', label: 'Reports', icon: BarChart3 },
  { href: '/contractor/notifications', label: 'Notifications', icon: Bell },
];

/**
 * The shared contractor navigation with a live unread-notification badge.
 * Safe to use on any contractor page — the count derives from the centralized
 * workforce store, so the badge updates the moment a notification is created
 * or marked read.
 */
export function useContractorNav() {
  const { notifications } = useMockWorkforce();
  const unread = notifications.filter((n) => !n.read).length;
  return contractorNav.map((n) => (n.href === '/contractor/notifications' ? { ...n, badge: unread || undefined } : n));
}
