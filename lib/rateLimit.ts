// In-memory rate limiting for MVP (no Redis required)
// Note: In production with multiple servers, consider Redis or similar

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// Global rate limit storage
const globalForRateLimit = globalThis as typeof globalThis & {
  rateLimitStore?: Map<string, RateLimitRecord>;
  rateLimitCleanupInterval?: NodeJS.Timeout;
};

if (!globalForRateLimit.rateLimitStore) {
  globalForRateLimit.rateLimitStore = new Map();
}

const rateLimitStore = globalForRateLimit.rateLimitStore;

// Cleanup old entries every 5 minutes
if (!globalForRateLimit.rateLimitCleanupInterval) {
  globalForRateLimit.rateLimitCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000); // 5 minutes
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
  limit: number;
  remaining: number;
}

/**
 * Check if a request is within rate limit
 * @param options - Rate limit configuration
 * @returns Result with ok status and retry info
 */
export function rateLimit(options: RateLimitOptions): RateLimitResult {
  const { key, limit, windowMs } = options;
  const now = Date.now();

  // Get or create record
  let record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    // Create new window
    record = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, record);

    return {
      ok: true,
      retryAfterSec: 0,
      limit,
      remaining: limit - 1,
    };
  }

  // Increment count
  record.count++;

  if (record.count > limit) {
    // Rate limit exceeded
    const retryAfterMs = record.resetAt - now;
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);

    return {
      ok: false,
      retryAfterSec,
      limit,
      remaining: 0,
    };
  }

  // Within limit
  return {
    ok: true,
    retryAfterSec: 0,
    limit,
    remaining: limit - record.count,
  };
}

/**
 * Get client IP from request headers
 * @param request - Next.js request object
 * @returns IP address or "unknown"
 */
export function getClientIp(request: Request): string {
  // Check common headers for IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list, take the first one
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback
  return 'unknown';
}

/**
 * Create a rate limit key for unauthenticated requests
 * @param ip - Client IP address
 * @param endpoint - API endpoint
 * @param identifier - Optional additional identifier (e.g., email)
 * @returns Rate limit key
 */
export function createRateLimitKey(
  ip: string,
  endpoint: string,
  identifier?: string
): string {
  if (identifier) {
    return `${ip}:${endpoint}:${identifier}`;
  }
  return `${ip}:${endpoint}`;
}

/**
 * Create a rate limit key for authenticated requests
 * @param userId - User ID
 * @param endpoint - API endpoint
 * @returns Rate limit key
 */
export function createAuthRateLimitKey(
  userId: string,
  endpoint: string
): string {
  return `user:${userId}:${endpoint}`;
}
