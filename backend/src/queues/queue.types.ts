export interface EmailJobData {
  emailId: string;
  campaignId: string;
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string; // ISO string
  delayBetweenEmails: number; // in milliseconds
  hourlyLimit: number;
  retryCount?: number;
}

export interface EmailJobResult {
  success: boolean;
  emailId: string;
  messageId?: string;
  etherealPreviewUrl?: string;
  error?: string;
  rescheduled?: boolean;
  rescheduledFor?: string;
}

export interface QueueStatistics {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: number;
}
