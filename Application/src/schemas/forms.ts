import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Enter your email or mobile number').refine(
    (v) => /.+@.+\..+/.test(v) || /^[6-9]\d{9}$/.test(v.replace(/\s/g, '')),
    'Enter a valid email or 10-digit mobile number',
  ),
  password: z.string().min(1, 'Enter your password'),
  rememberMe: z.boolean(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const otpSchema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code'),
});
export type OtpInput = z.infer<typeof otpSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const workerSchema = z.object({
  fullName: z.string().min(3, 'Enter the full name'),
  aadhaar: z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits'),
  dob: isoDate,
  gender: z.enum(['Male', 'Female', 'Other']),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  mineId: z.string().min(1, 'Select a mine'),
  jobRole: z.string().min(1, 'Select a job role'),
  joiningDate: isoDate,
  employmentType: z.enum(['Contract', 'Full-time', 'Daily Wage']),
  remarks: z.string().max(500, 'Remarks too long').optional(),
});
export type WorkerInput = z.infer<typeof workerSchema>;

export const documentSchema = z.object({
  workerId: z.string().optional(),
  type: z.string().min(1, 'Select a document type'),
  mineId: z.string().min(1, 'Select a related mine'),
  issueDate: isoDate,
  expiryDate: isoDate,
  docNumber: z.string().max(60).optional(),
  remarks: z.string().max(500).optional(),
}).refine((v) => v.expiryDate >= v.issueDate, {
  message: 'Expiry must be on or after the issue date',
  path: ['expiryDate'],
});
export type DocumentInput = z.infer<typeof documentSchema>;

export const billSchema = z.object({
  mineId: z.string().min(1, 'Select a mine'),
  workType: z.string().min(1, 'Select a work type'),
  period: z.string().min(1, 'Enter the billing period'),
  amountInr: z.number({ invalid_type_error: 'Enter the amount' }).positive('Amount must be positive'),
  description: z.string().max(500).optional(),
});
export type BillInput = z.infer<typeof billSchema>;
