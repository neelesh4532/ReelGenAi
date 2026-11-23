import { rateLimit } from 'express-rate-limit';

const message = { error: 'Too many requests, please try again later.' };

export function createLimiter({ windowMs, limit, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message,
    ...(keyGenerator ? { keyGenerator } : {}),
  });
}

// Per-user limits are mounted after requireAuth, so req.user is always set
const byUser = (req) => String(req.user?.id ?? 'anonymous');

export const apiLimiter = createLimiter({ windowMs: 15 * 60_000, limit: 300 });
export const authLimiter = createLimiter({ windowMs: 15 * 60_000, limit: 10 });
export const scriptLimiter = createLimiter({ windowMs: 60 * 60_000, limit: 10, keyGenerator: byUser });
export const renderLimiter = createLimiter({ windowMs: 60 * 60_000, limit: 10, keyGenerator: byUser });
export const publishLimiter = createLimiter({ windowMs: 60 * 60_000, limit: 20, keyGenerator: byUser });