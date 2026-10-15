import { LayoutDashboard, FileText, Users, CalendarCheck, Receipt, FolderCheck, BarChart3, Bell } from 'lucide-react';
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
