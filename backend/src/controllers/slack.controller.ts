import { Request, Response } from 'express';
import { SlackService } from '../services/slack.service';

export class SlackController {
  /**
   * GET /api/slack/connect
   */
  static connect(req: Request, res: Response): void {
    try {
      const authUrl = SlackService.getSlackAuthUrl(req.user!.id);
      res.redirect(authUrl);
    } catch (error: any) {
      res.status(500).json({ error: 'ConfigurationError', message: error.message });
    }
  }

  /**
   * GET /api/slack/callback
   */
  static async callback(req: Request, res: Response): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;

    if (error || !code || !state) {
      res.redirect(`${frontendUrl}/settings?slackError=${encodeURIComponent(error || 'Authorization failed')}`);
      return;
    }

    try {
      await SlackService.handleSlackCallback(code, state);
      res.redirect(`${frontendUrl}/settings?slackConnected=true`);
    } catch (err: any) {
      res.redirect(`${frontendUrl}/settings?slackError=${encodeURIComponent(err.message)}`);
    }
  }

  /**
   * GET /api/slack/status
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await SlackService.getSlackStatus(req.user!.id);
      res.status(200).json(status);
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * POST /api/slack/disconnect
   */
  static async disconnect(req: Request, res: Response): Promise<void> {
    try {
      await SlackService.disconnectSlack(req.user!.id);
      res.status(200).json({ success: true, message: 'Slack disconnected successfully.' });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * POST /api/slack/test
   * Allows manual verification during assignment review & video demo
   */
  static async testNotification(req: Request, res: Response): Promise<void> {
    try {
      await SlackService.sendTestMessage(req.user!.id);
      res.status(200).json({ success: true, message: 'Test notification sent to your Slack channel!' });
    } catch (error: any) {
      res.status(400).json({ error: 'BadRequest', message: error.message });
    }
  }
}
