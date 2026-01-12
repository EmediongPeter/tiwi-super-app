/**
 * Bug Report Types
 */

export interface BugReport {
  id: string;
  userWallet: string;
  description: string;
  screenshot?: string; // Base64 or URL
  logFile?: string; // Base64 or URL
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    language?: string;
    screenResolution?: string;
  };
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface CreateBugReportRequest {
  userWallet: string;
  description: string;
  screenshot?: string;
  logFile?: string;
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    language?: string;
    screenResolution?: string;
  };
}

export interface BugReportsAPIResponse {
  bugReports: BugReport[];
  total: number;
}

