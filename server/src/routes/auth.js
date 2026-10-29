import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { registerSchema, loginSchema } from '../schemas/auth.js';

const router = Router();

const signToken = (userId) =>
  jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const publicUser = (u) => ({ id: u._id, email: u.email, name: u.name });

// Used to keep login timing similar when the email doesn't exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash, name });
    res.status(201).json({ token: signToken(user._id), user: publicUser(user) });
  } catch (err) {
    next(err); // duplicate email becomes a 409 in errorHandler
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+passwordHash');
    const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

    if (!user || !valid) throw new AppError('Invalid email or password', 401);

    res.json({ token: signToken(user._id), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) throw new AppError('User not found', 401);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;