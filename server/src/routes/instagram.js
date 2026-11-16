import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../config/logger.js';
import { InstagramAccount } from '../models/InstagramAccount.js';
import { signState, verifyState, buildAuthUrl } from '../services/instagramAuth.js';
import {
  credentials, exchangeCode, toLongLived, getProfile, saveAccount, refreshAccount,
} from '../services/instagram.js';

const router = Router();
const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173';

// Returns the Instagram login URL; the browser then navigates to it
router.get('/connect', requireAuth, (req, res, next) => {
  try {
    credentials();
    res.json({ url: buildAuthUrl(signState(req.user.id)) });
  } catch (err) {
    next(err);
  }
});

// Instagram redirects the browser here (no login header), so the signed state identifies the user
router.get('/callback', async (req, res) => {
  const back = (result) => res.redirect(`${clientUrl()}/settings?instagram=${result}`);
  try {
    const { code, state, error } = req.query;
    const userId = verifyState(typeof state === 'string' ? state : '');
    if (!userId) return back('error');
    if (error || typeof code !== 'string') return back('denied');

    const shortToken = await exchangeCode(code);
    const long = await toLongLived(shortToken);
    const profile = await getProfile(long.accessToken);
    await saveAccount(userId, { ...profile, accessToken: long.accessToken, expiresIn: long.expiresIn });
    return back('connected');
  } catch (err) {
    logger.error({ err: err.message }, 'Instagram connect failed');
    return back('error');
  }
});

router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const account = await InstagramAccount.findOne({ user: req.user.id });
    if (!account) return res.json({ connected: false });
    const daysLeft = Math.max(0, Math.floor((account.tokenExpiresAt - Date.now()) / 86_400_000));
    res.json({
      connected: true,
      username: account.username,
      expiresAt: account.tokenExpiresAt,
      daysLeft,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', requireAuth, async (req, res, next) => {
  try {
    const account = await refreshAccount(req.user.id);
    res.json({ expiresAt: account.tokenExpiresAt });
  } catch (err) {
    next(err);
  }
});

router.delete('/', requireAuth, async (req, res, next) => {
  try {
    await InstagramAccount.deleteOne({ user: req.user.id });
    res.json({ connected: false });
  } catch (err) {
    next(err);
  }
});

// Development fallback: use a token generated in the Meta dashboard, no tunnel needed
const devTokenSchema = z.object({ accessToken: z.string().trim().min(20).max(1000) });
router.post('/dev-token', requireAuth, validate(devTokenSchema), async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') throw new AppError('Not found', 404);
    const profile = await getProfile(req.body.accessToken);
    await saveAccount(req.user.id, {
      ...profile,
      accessToken: req.body.accessToken,
      expiresIn: 60 * 24 * 3600, // dashboard tokens are long-lived (about 60 days)
    });
    res.json({ connected: true, username: profile.username });
  } catch (err) {
    next(err);
  }
});

export default router;