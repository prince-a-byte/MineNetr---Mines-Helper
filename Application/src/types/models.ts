/** Typed domain models. Display formatting lives in utils/format, never here. */

export type Role = 'dgms' | 'inspector' | 'operator' | 'contractor';

export interface DemoAccount {
  role: Role;
  label: string;
  email: string;
  password: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  role: Role;
  companyId: string;
  displayName: string;
  email: string;
  rememberMe: boolean;
}

export interface Company {
  id: string;
  name: string;
  contractorId: string;
  registration: string;
  gstin: string;
  address: string;
  contactName: string;
  contactDesignation: string;
  contactPhone: string;
  contactEmail: string;
  status: 'Active' | 'Suspended';
  dgmsValidTill: string;
}

export interface Mine {
  id: string;
  name: string;
  location: string;
  state: string;
  status: 'Active' | 'Inactive';
  contractStart: string;
  contractEnd: string;
  workType: string;
  image: number;
  managerName: string;
  managerPhone: string;
  nodalName: string;
  nodalPhone: string;
}

export type WorkerStatus = 'Active' | 'On Leave' | 'Inactive';

export interface Worker {
  id: string;
  name: string;
  role: string;
  mineId: string;
  status: WorkerStatus;
  phone: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  aadhaarLast4: string;
  joiningDate: string;
  employmentType: 'Contract' | 'Full-time' | 'Daily Wage';
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  avatar?: number | string;
  remarks?: string;
}

export interface Assignment {
  id: string;
  workerId: string;
  mineId: string;
  from: string;
  to?: string;
  status: WorkerStatus;
}

export type DocumentStatus = 'Verified' | 'Pending' | 'Rejected' | 'Expired';
export type DocumentScope = 'worker' | 'company';

export interface DocRecord {
  id: string;
  scope: DocumentScope;
  type: string;
  workerId?: string;
  mineId: string;
  issueDate: string;
  expiryDate: string;
  docNumber?: string;
  status: DocumentStatus;
  fileName?: string;
  fileSize?: number;
  remarks?: string;
  updatedAt: string;
}

export type BillStatus = 'Pending' | 'Approved' | 'Rejected' | 'Paid';

export interface Bill {
  id: string;
  workType: string;
  mineId: string;
  /** Amount stored as numeric INR paise? No — plain INR rupees number. Format only at display. */
  amountInr: number;
  period: string;
  submittedOn: string;
  status: BillStatus;
  description?: string;
}

export interface Payment {
  id: string;
  billId: string;
  mineId: string;
  date: string;
  amountInr: number;
}

export interface ActivityItem {
  id: string;
  kind: 'document' | 'worker' | 'bill' | 'mine';
  text: string;
  at: string;
  refId?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
}

export interface DashboardSummary {
  totalWorkers: number;
  activeWorkers: number;
  assignedMines: number;
  pendingDocuments: number;
  totalBilledInr: number;
  approvedInr: number;
  pendingBills: number;
}
