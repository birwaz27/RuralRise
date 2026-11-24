import { createHash, randomBytes } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AthleteProfile } from '../models/AthleteProfile.js';
import { isEmailConfigured, sendPasswordResetEmail } from '../services/email.js';
import { HttpError, sendSuccess } from '../utils/http.js';
import { logger } from '../utils/logger.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const refreshCookieName = 'rural-rise-refresh';
const tabSessionHeader = 'x-ruralrise-session-id';
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const passwordSchema = z.string()
  .min(8)
  .max(72)
  .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, 'Password must be no more than 72 UTF-8 bytes.');
const registerSchema = z.object({
  username: z.string().trim().min(3).max(40),
  email: z.email().max(254),
  password: passwordSchema,
  role: z.enum(['talent', 'host', 'pe_teacher']),
  institutionName: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
});
const loginSchema = z.object({ email: z.email(), password: passwordSchema });
const resetRequestSchema = z.object({ email: z.email() });
const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  password: passwordSchema,
});
type VerificationMethod = 'domain_auto' | 'read_only_pending' | 'manual_approved' | 'pending_review';

function makeAccessToken(user: { id: string; role: string }): string {
  return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function makeRefreshToken(userId: string): string {
  return jwt.sign({}, env.JWT_REFRESH_SECRET, {
    subject: userId,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function getTabSessionId(req: Request): string | null {
  const sessionId = req.header(tabSessionHeader);
  if (sessionId === undefined) return null;
  if (!/^[a-f\d-]{36}$/i.test(sessionId)) {
    throw new HttpError(400, 'INVALID_TAB_SESSION', 'The tab session identifier is invalid.');
  }
  return sessionId;
}

function getRefreshCookieName(sessionId: string | null): string {
  return sessionId ? `${refreshCookieName}-${sessionId}` : refreshCookieName;
}

function setRefreshCookie(res: Response, token: string, sessionId: string | null): void {
  res.cookie(getRefreshCookieName(sessionId), token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api',
  });
}

function clearRefreshCookie(res: Response, sessionId: string | null): void {
  res.clearCookie(getRefreshCookieName(sessionId), {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api',
  });
}

async function establishSession(
  user: { id: string; role: string; refreshTokenHash?: string | null; save: () => Promise<unknown> },
  res: Response,
  sessionId: string | null,
) {
  const refreshToken = makeRefreshToken(user.id);
  if (sessionId) {
    const tokenHash = hashRefreshToken(refreshToken);
    await User.updateOne({ _id: user.id }, { $pull: { refreshSessions: { sessionId } } });
    await User.updateOne({ _id: user.id }, { $push: { refreshSessions: { sessionId, tokenHash } } });
  } else {
    user.refreshTokenHash = hashRefreshToken(refreshToken);
    await user.save();
  }
  setRefreshCookie(res, refreshToken, sessionId);
  return makeAccessToken(user);
}

function publicUser(user: {
  id: string;
  username: string;
  email: string;
  role: string;
  hostVerificationStatus: string;
  isVerified?: boolean | null;
  verificationMethod?: VerificationMethod | null;
  district?: string | null;
  institutionName?: string | null;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    ...(user.district ? { district: user.district } : {}),
    ...(user.role === 'host' ? { hostVerificationStatus: user.hostVerificationStatus } : {}),
    ...(['host', 'pe_teacher'].includes(user.role) ? {
      isVerified: user.isVerified ?? (user.role === 'host' && user.hostVerificationStatus === 'verified'),
      verificationMethod: user.verificationMethod ?? (user.role === 'host' && user.hostVerificationStatus === 'verified' ? 'manual_approved' : undefined),
      ...(user.role === 'pe_teacher' ? { institutionName: user.institutionName } : {}),
    } : {}),
  };
}

function fullUser(user: {
  id: string;
  username: string;
  email: string;
  role: string;
  hostVerificationStatus: string;
  isVerified?: boolean | null;
  verificationMethod?: VerificationMethod | null;
  institutionName?: string | null;
  district?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    ...(user.district ? { district: user.district } : {}),
    ...(user.role === 'host' ? { hostVerificationStatus: user.hostVerificationStatus } : {}),
    ...(['host', 'pe_teacher'].includes(user.role) ? {
      isVerified: user.isVerified ?? (user.role === 'host' && user.hostVerificationStatus === 'verified'),
      verificationMethod: user.verificationMethod ?? (user.role === 'host' && user.hostVerificationStatus === 'verified' ? 'manual_approved' : undefined),
      ...(user.role === 'pe_teacher' ? { institutionName: user.institutionName } : {}),
    } : {}),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

router.post('/register', authLimiter, validateBody(registerSchema), async (req, res) => {
  const { username, email, password, role, institutionName, district } = req.body as z.infer<typeof registerSchema>;
  const passwordHash = await bcrypt.hash(password, 12);
  let isVerified: boolean | undefined;
  let verificationMethod: VerificationMethod | undefined;
  const normalizedEmail = email.toLowerCase();
  if (role === 'host') {
    const domain = normalizedEmail.split('@').at(-1) ?? '';
    isVerified = domain.endsWith('.gov.in') || domain.endsWith('.org.in');
    verificationMethod = isVerified ? 'domain_auto' : 'read_only_pending';
  } else if (role === 'pe_teacher') {
    isVerified = ['.edu.in', '.ac.in', '.gov.in', '.nic.in'].some((suffix) => normalizedEmail.endsWith(suffix));
    verificationMethod = isVerified ? 'domain_auto' : 'pending_review';
  }

  const trimmedDistrict = district?.trim() || undefined;
  const user = await User.create({
    username,
    email: normalizedEmail,
    passwordHash,
    role,
    ...(trimmedDistrict ? { district: trimmedDistrict } : {}),
    ...(role !== 'talent' ? { isVerified, verificationMethod } : {}),
    ...(role === 'host' ? { hostVerificationStatus: isVerified ? 'verified' : 'pending' } : {}),
    ...(role === 'pe_teacher' ? { institutionName: institutionName?.trim() } : {}),
  });

  if (role === 'talent' && trimmedDistrict) {
    await AthleteProfile.create({
      user: user._id,
      fullName: username,
      age: 18,
      sport: 'Athletics',
      district: trimmedDistrict,
      region: trimmedDistrict,
      verificationStatus: 'pending',
    });
  }

  const accessToken = await establishSession(user, res, getTabSessionId(req));
  sendSuccess(res, { user: fullUser(user), accessToken }, 201);
});

router.post('/login', authLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !passwordMatches) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  const accessToken = await establishSession(user, res, getTabSessionId(req));
  sendSuccess(res, { user: fullUser(user), accessToken });
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await User.findById(req.authUser!.id).select('-passwordHash -refreshTokenHash -passwordResetTokenHash -passwordResetExpiresAt');
  if (!user) throw new HttpError(401, 'INVALID_TOKEN', 'The access token is invalid or expired.');
  sendSuccess(res, { user: fullUser(user) });
});

router.post('/refresh', authLimiter, async (req, res) => {
  const sessionId = getTabSessionId(req);
  const tabCookieName = getRefreshCookieName(sessionId);
  const refreshToken = req.cookies?.[tabCookieName];
  if (typeof refreshToken !== 'string') {
    clearRefreshCookie(res, sessionId);
    throw new HttpError(401, 'SESSION_EXPIRED', 'Your session has expired. Please log in again.');
  }

  let payload: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw new Error('Invalid refresh token payload');
    }
    payload = decoded;
  } catch {
    clearRefreshCookie(res, sessionId);
    throw new HttpError(401, 'SESSION_EXPIRED', 'Your session has expired. Please log in again.');
  }

  const user = await User.findById(payload.sub).select(sessionId ? '+refreshSessions' : '+refreshTokenHash');
  const tokenHash = hashRefreshToken(refreshToken);
  const sessionMatches = sessionId
    ? user?.refreshSessions?.some((session: { sessionId: string; tokenHash: string }) => session.sessionId === sessionId && session.tokenHash === tokenHash)
    : user?.refreshTokenHash === tokenHash;
  if (!user || !sessionMatches) {
    clearRefreshCookie(res, sessionId);
    throw new HttpError(401, 'SESSION_EXPIRED', 'Your session has expired. Please log in again.');
  }

  sendSuccess(res, { user: fullUser(user), accessToken: makeAccessToken(user) });
});

router.post('/logout', async (req, res) => {
  const sessionId = getTabSessionId(req);
  const refreshToken = req.cookies?.[getRefreshCookieName(sessionId)];
  if (typeof refreshToken === 'string' && sessionId) {
    const tokenHash = hashRefreshToken(refreshToken);
    await User.updateOne(
      { 'refreshSessions.sessionId': sessionId, 'refreshSessions.tokenHash': tokenHash },
      { $pull: { refreshSessions: { sessionId, tokenHash } } },
    );
  } else if (typeof refreshToken === 'string') {
    await User.updateOne(
      { refreshTokenHash: hashRefreshToken(refreshToken) },
      { $unset: { refreshTokenHash: 1 } },
    );
  }
  clearRefreshCookie(res, sessionId);
  sendSuccess(res, { loggedOut: true });
});

router.post('/password/forgot', authLimiter, validateBody(resetRequestSchema), async (req, res) => {
  const { email } = req.body as z.infer<typeof resetRequestSchema>;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new HttpError(404, 'EMAIL_NOT_REGISTERED', 'This email is not registered. Check the address or create an account.');
  }
  if (!isEmailConfigured()) {
    throw new HttpError(503, 'EMAIL_UNAVAILABLE', 'Password reset email delivery is not configured. Please try again later.');
  }

  const token = randomBytes(32).toString('hex');
  user.passwordResetTokenHash = createHash('sha256').update(token).digest('hex');
  user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();
  try {
    await sendPasswordResetEmail(user.email, token);
  } catch (error) {
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();
    logger.error('Password reset email could not be sent', { error });
    throw new HttpError(503, 'EMAIL_UNAVAILABLE', 'Password reset email could not be sent. Please try again later.');
  }
  sendSuccess(res, { message: 'Password reset link sent to your registered email address.' }, 202);
});

router.post('/password/reset', authLimiter, validateBody(resetPasswordSchema), async (req, res) => {
  const { token, password } = req.body as z.infer<typeof resetPasswordSchema>;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpiresAt');
  if (!user) throw new HttpError(400, 'INVALID_RESET_TOKEN', 'The reset token is invalid or expired.');
  user.passwordHash = await bcrypt.hash(password, 12);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();
  sendSuccess(res, { message: 'Password has been reset successfully.' });
});

export default router;
