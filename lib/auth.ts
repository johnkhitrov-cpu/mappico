import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  email: string;
}

/**
 * Get JWT_SECRET at runtime only.
 * This function is called inside request handlers, NOT at module import time.
 * This allows Next.js build to succeed without JWT_SECRET set.
 */
function getJwtSecretOrThrow(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    console.error('[AUTH] FATAL: JWT_SECRET is not set in environment variables');
    throw new Error('Server misconfigured: JWT_SECRET is required for authentication');
  }
  return secret;
}

export function signToken(payload: TokenPayload): string {
  const secret = getJwtSecretOrThrow();
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: '7d',
  });
}

export function verifyToken(token: string): TokenPayload {
  const secret = getJwtSecretOrThrow();
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as TokenPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}
