import { Router } from 'express';
import multer from 'multer';
import type { AthleteProfileDocument } from '../models/AthleteProfile.js';
import { z } from 'zod';
import { AthleteProfile } from '../models/AthleteProfile.js';
import { User } from '../models/User.js';
import { requireAuth, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { HttpError, sendSuccess } from '../utils/http.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/png', 'image/jpeg'].includes(file.mimetype)) {
      callback(new HttpError(400, 'INVALID_IMAGE_TYPE', 'Only PNG and JPG images are allowed.'));
      return;
    }
    callback(null, true);
  },
});

const profileSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  age: z.coerce.number().int().min(5).max(100),
  sport: z.string().trim().min(1).max(80),
  district: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(100),
  background: z.string().trim().max(3000).optional().default(''),
  tournaments: z.array(z.string().trim().min(1).max(150)).max(50).optional().default([]),
  bio: z.string().trim().max(2000).optional().default(''),
});
const verificationSchema = z.object({ status: z.enum(['verified', 'rejected']) });
const shortlistSchema = z.object({ athleteId: z.string().regex(/^[a-f\d]{24}$/i) });

export function serializeProfile(profile: AthleteProfileDocument) {
  const value = profile.toObject();
  return {
    id: String(value._id),
    userId: String(value.user),
    fullName: value.fullName,
    age: value.age,
    sport: value.sport,
    district: value.district,
    region: value.region,
    background: value.background,
    tournaments: value.tournaments,
    bio: value.bio,
    verificationStatus: value.verificationStatus,
    planTier: value.planTier,
    photoUrl: `/api/athletes/${value._id}/photo`,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

router.get('/', async (req, res) => {
  const querySchema = z.object({
    search: z.string().trim().max(100).optional(),
    sport: z.string().trim().max(80).optional(),
    district: z.string().trim().max(100).optional(),
    region: z.string().trim().max(100).optional(),
    status: z.enum(['pending', 'verified', 'rejected']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'The search filters are invalid.');
  const { search, sport, district, region, status, page, limit } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (search) {
    const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { fullName: { $regex: literal, $options: 'i' } },
      { sport: { $regex: literal, $options: 'i' } },
    ];
  }
  if (sport) filter.sport = new RegExp(`^${sport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (district) filter.district = new RegExp(`^${district.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (region) filter.region = new RegExp(`^${region.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (status) filter.verificationStatus = status;

  const [profiles, total] = await Promise.all([
    AthleteProfile.find(filter)
      .select('-photo -photoContentType')
      .sort({ priorityPlacement: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AthleteProfile.countDocuments(filter),
  ]);
  sendSuccess(res, { items: profiles.map(serializeProfile), page, limit, total, pages: Math.ceil(total / limit) });
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const profile = await AthleteProfile.findOne({ user: req.authUser!.id })
    .select('-photo -photoContentType');
  sendSuccess(res, profile ? serializeProfile(profile) : null);
});

router.post('/', requireAuth, validateBody(profileSchema), async (req: AuthenticatedRequest, res) => {
  if (req.authUser?.role !== 'talent') {
    throw new HttpError(403, 'FORBIDDEN', 'Only talent accounts can create athlete profiles.');
  }
  const existing = await AthleteProfile.exists({ user: req.authUser.id });
  if (existing) throw new HttpError(409, 'PROFILE_EXISTS', 'An athlete profile already exists for this account.');
  const profile = await AthleteProfile.create({
    ...(req.body as z.infer<typeof profileSchema>),
    user: req.authUser.id,
  });
  if (profile.district) {
    await User.updateOne({ _id: req.authUser.id }, { $set: { district: profile.district.trim() } });
  }
  sendSuccess(res, serializeProfile(profile), 201);
});

router.get('/shortlist', requireAuth, requireRoles('host', 'admin'), async (req: AuthenticatedRequest, res) => {
  const user = await User.findById(req.authUser!.id).select('shortlist');
  const ids = user?.shortlist ?? [];
  const profiles = await AthleteProfile.find({ _id: { $in: ids } })
    .select('-photo -photoContentType');
  sendSuccess(res, profiles.map(serializeProfile));
});

router.post('/shortlist', requireAuth, requireRoles('host', 'admin'), validateBody(shortlistSchema), async (req: AuthenticatedRequest, res) => {
  const { athleteId } = req.body as z.infer<typeof shortlistSchema>;
  const profile = await AthleteProfile.findById(athleteId);
  if (!profile) throw new HttpError(404, 'ATHLETE_NOT_FOUND', 'Athlete profile was not found.');
  await User.updateOne({ _id: req.authUser!.id }, { $addToSet: { shortlist: profile._id } });
  sendSuccess(res, { athleteId, shortlisted: true });
});

router.delete('/shortlist/:athleteId', requireAuth, requireRoles('host', 'admin'), async (req: AuthenticatedRequest, res) => {
  const athleteId = req.params.athleteId;
  if (typeof athleteId !== 'string' || !/^[a-f\d]{24}$/i.test(athleteId)) {
    throw new HttpError(400, 'INVALID_ID', 'The supplied athlete ID is invalid.');
  }
  await User.updateOne({ _id: req.authUser!.id }, { $pull: { shortlist: athleteId } });
  sendSuccess(res, { athleteId, shortlisted: false });
});

router.get('/:id/photo', async (req, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw new HttpError(400, 'INVALID_ID', 'The supplied athlete ID is invalid.');
  const profile = await AthleteProfile.findById(id).select('+photo +photoContentType');
  if (!profile?.photo || !profile.photoContentType) throw new HttpError(404, 'PHOTO_NOT_FOUND', 'No profile photo was found.');
  res.type(profile.photoContentType).set('Cache-Control', 'public, max-age=3600').send(profile.photo);
});

router.get('/:id/analytics', requireAuth, async (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new HttpError(400, 'INVALID_ID', 'The supplied athlete ID is invalid.');
  }
  const profile = await AthleteProfile.findById(id).select('+viewCount');
  if (!profile) throw new HttpError(404, 'ATHLETE_NOT_FOUND', 'Athlete profile was not found.');
  if (profile.user.toString() !== req.authUser!.id && req.authUser!.role !== 'admin') {
    throw new HttpError(403, 'FORBIDDEN', 'You can only view analytics for your own profile.');
  }
  if (profile.planTier !== 'pro' && req.authUser!.role !== 'admin') {
    throw new HttpError(403, 'PRO_REQUIRED', 'Profile-view analytics are available on the Pro tier.');
  }
  sendSuccess(res, { athleteId: profile.id, planTier: profile.planTier, totalViews: profile.viewCount });
});

router.get('/:id', async (req, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw new HttpError(400, 'INVALID_ID', 'The supplied athlete ID is invalid.');
  const profile = await AthleteProfile.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }, { returnDocument: 'after' })
    .select('-photo -photoContentType');
  if (!profile) throw new HttpError(404, 'ATHLETE_NOT_FOUND', 'Athlete profile was not found.');
  sendSuccess(res, serializeProfile(profile));
});

router.patch('/:id', requireAuth, validateBody(profileSchema.partial()), async (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw new HttpError(400, 'INVALID_ID', 'The supplied athlete ID is invalid.');
  const profile = await AthleteProfile.findById(id);
  if (!profile) throw new HttpError(404, 'ATHLETE_NOT_FOUND', 'Athlete profile was not found.');
  if (Object.keys(req.body as Record<string, unknown>).length === 0) {
    throw new HttpError(400, 'EMPTY_UPDATE', 'Provide at least one profile field to update.');
  }
  if (profile.user.toString() !== req.authUser!.id && req.authUser!.role !== 'admin') {
    throw new HttpError(403, 'FORBIDDEN', 'You can only edit your own profile.');
  }
  Object.assign(profile, req.body, { verificationStatus: 'pending', verifiedBy: undefined });
  await profile.save();
  if (profile.district) {
    await User.updateOne({ _id: profile.user }, { $set: { district: profile.district.trim() } });
  }
  sendSuccess(res, serializeProfile(profile));
});

router.put('/:id/verification', requireAuth, requireRoles('admin'), validateBody(verificationSchema), async (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw new HttpError(400, 'INVALID_ID', 'The supplied athlete ID is invalid.');
  const { status } = req.body as z.infer<typeof verificationSchema>;
  const profile = await AthleteProfile.findByIdAndUpdate(
    id,
    { verificationStatus: status, verifiedBy: req.authUser!.id },
    { returnDocument: 'after', runValidators: true },
  ).select('-photo -photoContentType');
  if (!profile) throw new HttpError(404, 'ATHLETE_NOT_FOUND', 'Athlete profile was not found.');
  sendSuccess(res, serializeProfile(profile));
});

router.post('/:id/photo', requireAuth, upload.single('photo'), async (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw new HttpError(400, 'INVALID_ID', 'The supplied athlete ID is invalid.');
  const profile = await AthleteProfile.findById(id);
  if (!profile) throw new HttpError(404, 'ATHLETE_NOT_FOUND', 'Athlete profile was not found.');
  if (profile.user.toString() !== req.authUser!.id && req.authUser!.role !== 'admin') {
    throw new HttpError(403, 'FORBIDDEN', 'You can only update your own profile photo.');
  }
  const file = req.file;
  if (!file) throw new HttpError(400, 'PHOTO_REQUIRED', 'Select a PNG or JPG image no larger than 2 MB.');
  const isPng = file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
  if (!isPng && !isJpeg) throw new HttpError(400, 'INVALID_IMAGE', 'The uploaded file is not a valid PNG or JPG image.');
  profile.photo = file.buffer;
  profile.photoContentType = isPng ? 'image/png' : 'image/jpeg';
  profile.verificationStatus = 'pending';
  profile.verifiedBy = undefined;
  await profile.save();
  sendSuccess(res, { photoUrl: `/api/athletes/${profile.id}/photo` });
});

export default router;
