import { LayoutDashboard, Users, HardHat, CalendarCheck, Truck, Warehouse, Receipt, FileCheck, BarChart3, ClipboardCheck, Settings } from 'lucide-react';
export const operatorNav = [
  { href: '/operator', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/operator/workers', label: 'Workers & Manpower', icon: Users },
  { href: '/operator/contractors', label: 'Contractors', icon: HardHat },
  { href: '/operator/attendance', label: 'Attendance & Access', icon: CalendarCheck },
  { href: '/operator/production', label: 'Production & Dispatch', icon: Truck },
  { href: '/operator/stockpile', label: 'Stockpile Management', icon: Warehouse },
  { href: '/operator/bills', label: 'Bills & Transactions', icon: Receipt },
  { href: '/operator/documents', label: 'Documents & Compliance', icon: FileCheck },
  { href: '/operator/reports', label: 'Reports', icon: BarChart3 },
  { href: '/operator/inspections', label: 'Inspection & Audit', icon: ClipboardCheck },
  { href: '/operator/settings', label: 'Settings', icon: Settings },
];
