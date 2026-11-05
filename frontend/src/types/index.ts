export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

export interface EmailSender {
  id: string;
  email: string;
  displayName: string;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  status: 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'PAUSED';
  totalEmails: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export interface ScheduledEmail {
  id: string;
  campaignId: string;
  recipientEmail: string;
  subject: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';
  errorMessage?: string | null;
  etherealPreviewUrl?: string | null;
  campaign?: { id: string; name: string };
  sender?: { id: string; email: string; displayName: string };
}

export interface DashboardStats {
  totalCampaigns: number;
  totalScheduled: number;
  totalSent: number;
  totalFailed: number;
  pendingEmails: number;
  activeQueueJobs: number;
  queueStats: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    paused: number;
  };
}

export interface SlackStatus {
  isConnected: boolean;
  teamId?: string;
  teamName?: string;
  channelId?: string;
  channelName?: string;
}
