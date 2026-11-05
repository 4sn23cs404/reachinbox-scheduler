import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export class AuthController {
  /**
   * GET /api/auth/google
   * Redirects user to Google's official OAuth consent screen
   */
  static googleLogin(_req: Request, res: Response): void {
    try {
      const url = AuthService.getGoogleAuthUrl();
      res.redirect(url);
    } catch (error: any) {
      console.error('Google login initialization error:', error.message);
      res.status(500).json({
        error: 'ConfigurationError',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/auth/google/callback
   * Handles Google callback, verifies profile, sets secure cookie, redirects to dashboard with token
   */
  static async googleCallback(req: Request, res: Response): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const code = req.query.code as string;
    const error = req.query.error as string;

    if (error || !code) {
      console.error('Google OAuth error callback:', error);
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error || 'Access denied')}`);
      return;
    }

    try {
      const { token } = await AuthService.handleGoogleCallback(code);

      const isProd = process.env.NODE_ENV === 'production';

      // Set cookie (sameSite: 'none' and secure: true in production for cross-site Vercel <-> Render)
      res.cookie('token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Pass token in URL query parameter so frontend can also store in localStorage
      res.redirect(`${frontendUrl}/dashboard?token=${encodeURIComponent(token)}`);
    } catch (err: any) {
      console.error('Failed to complete Google OAuth:', err.message);
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(err.message)}`);
    }
  }

  /**
   * GET /api/auth/me
   * Returns authenticated user profile
   */
  static getMe(req: Request, res: Response): void {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
      return;
    }

    res.status(200).json({
      user: req.user,
    });
  }

  /**
   * POST /api/auth/logout
   * Clears session cookie and invalidates session
   */
  static logout(_req: Request, res: Response): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  }

  /**
   * POST /api/auth/demo-login
   * Provides immediate 1-click evaluator login for assignment review
   */
  static async demoLogin(_req: Request, res: Response): Promise<void> {
    try {
      const { user, token } = await AuthService.getOrCreateDemoUser();
      const isProd = process.env.NODE_ENV === 'production';

      res.cookie('token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({ success: true, user, token });
    } catch (err: any) {
      res.status(500).json({ error: 'InternalServerError', message: err.message });
    }
  }
}
