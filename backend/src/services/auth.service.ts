import prisma from '../config/database';
import { generateToken } from '../utils/jwt';

interface GoogleTokens {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
}

export class AuthService {
  /**
   * Generates the Google OAuth 2.0 authorization URL
   */
  static getGoogleAuthUrl(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

    if (!clientId || clientId.includes('your_google_client_id')) {
      throw new Error(
        'GOOGLE_CLIENT_ID is not configured in backend/.env. Please configure your Google Cloud OAuth credentials.'
      );
    }

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: redirectUri,
      client_id: clientId,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'openid',
      ].join(' '),
    };

    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }

  /**
   * Exchanges Google authorization code for tokens, verifies profile, and manages User in DB
   */
  static async handleGoogleCallback(code: string): Promise<{ token: string; user: any }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured in backend/.env');
    }

    // 1. Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error('Google token exchange failed:', errBody);
      throw new Error('Failed to exchange authorization code with Google');
    }

    const tokens: GoogleTokens = (await tokenResponse.json()) as GoogleTokens;

    // 2. Fetch verified Google user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user profile from Google');
    }

    const googleUser: GoogleUserInfo = (await userInfoResponse.json()) as GoogleUserInfo;

    if (!googleUser.email) {
      throw new Error('Google account has no associated email address');
    }

    // 3. Find or create user in PostgreSQL
    const user = await prisma.user.upsert({
      where: { googleId: googleUser.sub },
      update: {
        name: googleUser.name || 'User',
        avatar: googleUser.picture || null,
        email: googleUser.email,
      },
      create: {
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name || 'User',
        avatar: googleUser.picture || null,
      },
    });

    // 4. Create default email sender for the user if none exists
    const existingSender = await prisma.emailSender.findFirst({
      where: { userId: user.id },
    });

    if (!existingSender) {
      await prisma.emailSender.create({
        data: {
          userId: user.id,
          email: user.email,
          displayName: user.name,
          isDefault: true,
          isActive: true,
        },
      });
    }

    // 5. Generate secure JWT session token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    return { token, user };
  }

  /**
   * Creates or returns a demo user account for testing and reviewer evaluation
   */
  static async getOrCreateDemoUser() {
    const demoEmail = 'reviewer@reachinbox.ai';
    const demoGoogleId = 'reachinbox-demo-reviewer-id';

    const user = await prisma.user.upsert({
      where: { googleId: demoGoogleId },
      update: {
        name: 'Technical Reviewer',
        email: demoEmail,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      },
      create: {
        googleId: demoGoogleId,
        email: demoEmail,
        name: 'Technical Reviewer',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      },
    });

    const existingSender = await prisma.emailSender.findFirst({
      where: { userId: user.id },
    });

    if (!existingSender) {
      await prisma.emailSender.create({
        data: {
          userId: user.id,
          email: user.email,
          displayName: user.name,
          isDefault: true,
          isActive: true,
        },
      });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    return { user, token };
  }
}
