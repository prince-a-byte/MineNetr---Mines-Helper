import type { DemoAccount } from '../types/models';

/** Role shown on selection cards. Stored as login-flow state only — never trusted as authorization. */
export const ROLES = [
  { id: 'dgms', title: 'DGMS / Main Admin', sub: 'Monitoring and Oversight', tint: '#EAF3FF', iconColor: '#1463D9' },
  { id: 'inspector', title: 'Inspector / Field Officer', sub: 'On-site Inspection', tint: '#E7F6F0', iconColor: '#159B72' },
  { id: 'operator', title: 'Mine Operator', sub: 'Mine Operations', tint: '#FDF1E2', iconColor: '#E8A02B' },
  { id: 'contractor', title: 'Contractor', sub: 'Workforce Management', tint: '#EEEAFB', iconColor: '#6C4FD8' },
] as const;

/** Development-only mock accounts. Valid ONLY through the mock auth adapter. */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: 'contractor', label: 'Contractor', email: 'contractor@minenetr.demo', password: 'Demo@123' },
  { role: 'dgms', label: 'DGMS / Main Admin', email: 'dgms@minenetr.demo', password: 'Demo@123' },
  { role: 'inspector', label: 'Inspector', email: 'inspector@minenetr.demo', password: 'Demo@123' },
  { role: 'operator', label: 'Mine Operator', email: 'operator@minenetr.demo', password: 'Demo@123' },
];

/** Fixed OTP accepted by the mock adapter. No real SMS is ever sent. */
export const DEMO_OTP = '123456';
export const OTP_RESEND_SECONDS = 30;

export const JOB_ROLES = [
  'Excavator Operator',
  'Safety Supervisor',
  'Electrician',
  'Drilling Operator',
  'Heavy Vehicle Driver',
  'Helper',
  'Welder',
  'Fitter',
] as const;

export const DOC_TYPES = [
  'Aadhaar Card',
  'Medical Certificate',
  'Safety Training Certificate',
  'Contract Agreement',
  'Experience Certificate',
  'Other Documents',
] as const;

export const MAX_UPLOAD_MB = 5;
export const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png'] as const;
