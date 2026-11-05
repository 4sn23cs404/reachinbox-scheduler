import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../config/database';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined = req.cookies?.token || req.cookies?.auth_token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is missing. Please log in.',
      });
      return;
    }

    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session. Please log in again.',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, avatar: true },
    });

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User account not found.',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to authenticate user.',
    });
  }
}
