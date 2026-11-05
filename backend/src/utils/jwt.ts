import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'reachinbox_default_jwt_secret_key_32_characters';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  name: string;
}

export function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch (error) {
    return null;
  }
}
