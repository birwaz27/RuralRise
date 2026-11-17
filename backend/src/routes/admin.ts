import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { AthleteProfile } from '../models/AthleteProfile.js';
import { User } from '../models/User.js';
import { HttpError, sendSuccess } from '../utils/http.js';

const router = Router();
const statusSchema = z.object({ status: z.enum(['verified', 'rejected']) });
const querySchema = z.object({ status: z.enum(['pending', 'verified', 'rejected']).default('pending') });
const tierSchema = z.object({ tier: z.enum(['standard', 'pro']) });

router.get('/hosts', requireAuth, requireRoles('admin'), async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'The host status filter is invalid.');
  const hosts = await User.find({ role: 'host', hostVerificationStatus: parsed.data.status })
    .select('username email hostVerificationStatus createdAt');
  sendSuccess(res, hosts.map((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    verificationStatus: user.hostVerificationStatus,
    createdAt: user.createdAt,
  })));
});

router.put('/hosts/:id/verification', requireAuth, requireRoles('admin'), validateBody(statusSchema), async (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new HttpError(400, 'INVALID_ID', 'The supplied host ID is invalid.');
  }
  const { status } = req.body as z.infer<typeof statusSchema>;
  const host = await User.findOneAndUpdate(
    { _id: id, role: 'host' },
    {
      hostVerificationStatus: status,
      isVerified: status === 'verified',
      verificationMethod: status === 'verified' ? 'manual_approved' : 'read_only_pending',
    },
    { returnDocument: 'after', runValidators: true },
  );
  if (!host) throw new HttpError(404, 'HOST_NOT_FOUND', 'Host account was not found.');
  sendSuccess(res, {
    id: host.id,
    username: host.username,
    verificationStatus: host.hostVerificationStatus,
  });
});

router.put('/athletes/:id/tier', requireAuth, requireRoles('admin'), validateBody(tierSchema), async (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new HttpError(400, 'INVALID_ID', 'The supplied athlete ID is invalid.');
  }
  const { tier } = req.body as z.infer<typeof tierSchema>;
  const profile = await AthleteProfile.findByIdAndUpdate(
    id,
    { planTier: tier, priorityPlacement: tier === 'pro' },
    { returnDocument: 'after', runValidators: true },
  );
  if (!profile) throw new HttpError(404, 'ATHLETE_NOT_FOUND', 'Athlete profile was not found.');
  sendSuccess(res, { athleteId: profile.id, planTier: profile.planTier });
});

export default router;
