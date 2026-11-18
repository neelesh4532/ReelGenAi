import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../config/logger.js';
import { InstagramAccount } from '../models/InstagramAccount.js';
import { signState, verifyState, buildAuthUrl } from '../services/instagramAuth.js';
import { credentials, exchangeCode, getInstagramAccount, saveAccount } from '../services/instagram.js';

const router = Router();
const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173';

// Returns the login URL; the browser then navigates to it
router.get('/connect', requireAuth, (req, res, next) => {
  try {
    credentials();
    res.json({ url: buildAuthUrl(signState(req.user.id)) });
  } catch (err) {
    next(err);
  }
});

// Meta redirects the browser here (no login header), so the signed state identifies the user
router.get('/callback', async (req, res) => {
  const back = (result) => res.redirect(`${clientUrl()}/settings?instagram=${result}`);
  let step = 'state';
  try {
    const { code, state, error, error_description: errorDescription } = req.query;

    const userId = verifyState(typeof state === 'string' ? state : '');
    if (!userId) {
      logger.warn('Instagram callback: invalid or expired state');
      return back('error');
    }
    if (error || typeof code !== 'string') {
      logger.warn({ error, errorDescription }, 'Instagram callback: login cancelled or no code');
      return back('denied');
    }

    step = 'code-exchange';
    const { accessToken, expiresIn } = await exchangeCode(code);

    step = 'account-lookup';
    const account = await getInstagramAccount(accessToken);

    step = 'save';
    await saveAccount(userId, { ...account, accessToken, expiresIn });
    return back('connected');
  } catch (err) {
    logger.error({ step, err: err.message }, 'Instagram connect failed');
    return back(err.reason === 'no-account' ? 'no-account' : 'error');
  }
});

router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const account = await InstagramAccount.findOne({ user: req.user.id });
    if (!account) return res.json({ connected: false });
    res.json({
      connected: true,
      username: account.username,
      neverExpires: !account.tokenExpiresAt,
      expiresAt: account.tokenExpiresAt,
    });
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

// Development fallback: use a token generated in the Meta dashboard
const devTokenSchema = z.object({ accessToken: z.string().trim().min(20).max(1000) });
router.post('/dev-token', requireAuth, validate(devTokenSchema), async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') throw new AppError('Not found', 404);
    const account = await getInstagramAccount(req.body.accessToken);
    await saveAccount(req.user.id, { ...account, accessToken: req.body.accessToken, expiresIn: null });
    res.json({ connected: true, username: account.username });
  } catch (err) {
    next(err);
  }
});

export default router;