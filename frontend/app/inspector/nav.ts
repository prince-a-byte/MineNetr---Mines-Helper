import { LayoutDashboard, ClipboardList, CalendarDays, ListChecks, TriangleAlert, Camera, Leaf, Truck, Users, BarChart3, ShieldCheck, MessagesSquare, FolderClosed, Settings } from 'lucide-react';
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
