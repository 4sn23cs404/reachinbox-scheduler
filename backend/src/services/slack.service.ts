import { WebClient } from '@slack/web-api';
import prisma from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';

export interface RateLimitNotificationPayload {
  userId: string;
  senderEmail: string;
  campaignName: string;
  hourlyLimit: number;
  currentCount: number;
  nextAvailableWindow: Date;
  remainingEmails?: number;
}

export class SlackService {
  /**
   * Generates the Slack OAuth 2.0 authorization URL
   */
  static getSlackAuthUrl(userId: string): string {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/slack/callback';

    if (!clientId || clientId.includes('your_slack_client_id')) {
      throw new Error('SLACK_CLIENT_ID is not configured in backend/.env');
    }

    const scopes = ['chat:write', 'incoming-webhook', 'team:read'].join(',');
    const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64');

    return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${encodeURIComponent(state)}`;
  }

  /**
   * Exchanges OAuth authorization code for Slack access token and incoming webhook
   */
  static async handleSlackCallback(code: string, state: string) {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/slack/callback';

    if (!clientId || !clientSecret) {
      throw new Error('Slack OAuth credentials missing in backend/.env');
    }

    // Decode state
    let userId: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      userId = decoded.userId;
    } catch {
      throw new Error('Invalid OAuth state parameter');
    }

    // Exchange code with Slack
    const client = new WebClient();
    const response: any = await client.oauth.v2.access({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    if (!response.ok) {
      throw new Error(`Slack OAuth exchange failed: ${response.error}`);
    }

    const teamId = response.team?.id || 'unknown_team';
    const teamName = response.team?.name || 'Slack Workspace';
    const channelId = response.incoming_webhook?.channel_id || null;
    const channelName = response.incoming_webhook?.channel || null;
    const incomingWebhookUrl = response.incoming_webhook?.url
      ? encrypt(response.incoming_webhook.url)
      : null;
    const accessToken = encrypt(response.access_token || '');
    const refreshToken = response.refresh_token ? encrypt(response.refresh_token) : null;

    // Upsert integration record
    const integration = await prisma.slackIntegration.upsert({
      where: { userId },
      update: {
        teamId,
        teamName,
        channelId,
        channelName,
        incomingWebhookUrl,
        accessToken,
        refreshToken,
        isConnected: true,
      },
      create: {
        userId,
        teamId,
        teamName,
        channelId,
        channelName,
        incomingWebhookUrl,
        accessToken,
        refreshToken,
        isConnected: true,
      },
    });

    return { success: true, teamName, channelName, integrationId: integration.id };
  }

  /**
   * Returns current Slack connection status (safe info without secrets)
   */
  static async getSlackStatus(userId: string) {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
      select: {
        id: true,
        teamId: true,
        teamName: true,
        channelId: true,
        channelName: true,
        isConnected: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return integration || { isConnected: false };
  }

  /**
   * Disconnects the user's Slack integration
   */
  static async disconnectSlack(userId: string) {
    return await prisma.slackIntegration.updateMany({
      where: { userId },
      data: { isConnected: false },
    });
  }

  /**
   * Dispatches a real Slack notification message when an hourly rate limit is breached
   */
  static async sendRateLimitNotification(payload: RateLimitNotificationPayload): Promise<boolean> {
    try {
      const integration = await prisma.slackIntegration.findUnique({
        where: { userId: payload.userId },
      });

      if (!integration || !integration.isConnected || !integration.accessToken) {
        // Slack not connected; silently proceed without error
        return false;
      }

      const token = decrypt(integration.accessToken);
      const client = new WebClient(token);

      const nextWindowFormatted = payload.nextAvailableWindow.toUTCString();
      const remainingText = payload.remainingEmails !== undefined
        ? `*Remaining Emails:* ${payload.remainingEmails}`
        : '';

      const messageText = `⚠️ *Email Rate Limit Reached*\n• *Sender:* ${payload.senderEmail}\n• *Campaign:* ${payload.campaignName}\n• *Hourly Limit:* ${payload.hourlyLimit} emails\n• *Current Status:* Sending paused\n• *Next Available Window:* ${nextWindowFormatted}\n${remainingText}\n_The remaining emails have been rescheduled automatically._`;

      const channel = integration.channelId || 'general';

      await client.chat.postMessage({
        channel,
        text: messageText,
      });

      console.log(`📢 [Slack Alert Sent] Notification delivered to workspace "${integration.teamName}"`);
      return true;
    } catch (err: any) {
      console.error('⚠️ [Slack Alert Warning] Failed to post Slack message:', err.message);
      return false;
    }
  }

  /**
   * Test endpoint to verify Slack integration during demo
   */
  static async sendTestMessage(userId: string): Promise<boolean> {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });

    if (!integration || !integration.isConnected || !integration.accessToken) {
      throw new Error('Slack is not connected. Please connect Slack first.');
    }

    const token = decrypt(integration.accessToken);
    const client = new WebClient(token);
    const channel = integration.channelId || 'general';

    await client.chat.postMessage({
      channel,
      text: `✅ *ReachInbox Slack Integration Test*\nConnection verified successfully at ${new Date().toUTCString()}!`,
    });

    return true;
  }
}
