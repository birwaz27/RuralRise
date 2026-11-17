import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { AthleteProfile } from '../models/AthleteProfile.js';
import { ConnectionRequest } from '../models/ConnectionRequest.js';
import { HttpError, sendSuccess } from '../utils/http.js';

const router = Router();
const statusSchema = z.object({ status: z.enum(['accepted', 'rejected']) });
const connectSchema = z.object({ message: z.string().trim().min(1).max(1000) });

router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const filter = req.authUser!.role === 'talent'
    ? { toUser: req.authUser!.id }
    : req.authUser!.role === 'host'
      ? { fromUser: req.authUser!.id }
      : {};
  const requests = await ConnectionRequest.find(filter)
    .populate('athlete', 'fullName sport district verificationStatus')
    .sort({ createdAt: -1 })
    .limit(100);
  sendSuccess(res, requests.map((item) => ({
    id: item.id,
    athlete: item.athlete,
    fromUserId: item.fromUser.toString(),
    toUserId: item.toUser.toString(),
    message: item.message,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  })));
});

router.post('/:id', requireAuth, validateBody(connectSchema), async (req: AuthenticatedRequest, res) => {
  if (req.authUser!.role !== 'host') {
    throw new HttpError(403, 'FORBIDDEN', 'Only host or scout accounts can express interest in an athlete.');
  }
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new HttpError(400, 'INVALID_ID', 'The supplied athlete ID is invalid.');
  }
  const profile = await AthleteProfile.findById(id);
  if (!profile) throw new HttpError(404, 'ATHLETE_NOT_FOUND', 'Athlete profile was not found.');
  if (profile.verificationStatus !== 'verified') {
    throw new HttpError(409, 'ATHLETE_NOT_VERIFIED', 'You can only connect with verified athletes.');
  }
  const { message } = req.body as z.infer<typeof connectSchema>;
  const connection = await ConnectionRequest.create({
    athlete: profile._id,
    fromUser: req.authUser!.id,
    toUser: profile.user,
    message,
  });
  sendSuccess(res, {
    id: connection.id,
    athleteId: profile.id,
    message: connection.message,
    status: connection.status,
    createdAt: connection.createdAt,
  }, 201);
});

router.patch('/:id', requireAuth, validateBody(statusSchema), async (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new HttpError(400, 'INVALID_ID', 'The supplied connection ID is invalid.');
  }
  const connection = await ConnectionRequest.findById(id);
  if (!connection) throw new HttpError(404, 'CONNECTION_NOT_FOUND', 'Connection request was not found.');
  if (connection.toUser.toString() !== req.authUser!.id || req.authUser!.role !== 'talent') {
    throw new HttpError(403, 'FORBIDDEN', 'Only the athlete receiving this request can respond.');
  }
  if (connection.status !== 'pending') {
    throw new HttpError(409, 'CONNECTION_ALREADY_RESOLVED', 'This connection request has already been resolved.');
  }
  const { status } = req.body as z.infer<typeof statusSchema>;
  connection.status = status;
  await connection.save();
  sendSuccess(res, { id: connection.id, status: connection.status });
});

export default router;
