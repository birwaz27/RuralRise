import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireVerifiedRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { AthleteProfile } from '../models/AthleteProfile.js';
import { AchievementPost } from '../models/AchievementPost.js';
import { sendSuccess, HttpError } from '../utils/http.js';
import { validateBody } from '../middleware/validate.js';
import { serializeProfile } from './athletes.js';
import { serializePost, type PostAuthor } from './posts.js';

const router = Router();

const endorsementSchema = z.object({
  status: z.enum(['endorsed', 'correction_requested']),
  note: z.string().max(500).optional(),
});

router.get('/athletes', requireAuth, requireVerifiedRole('pe_teacher'), async (req: AuthenticatedRequest, res) => {
  const teacher = await User.findById(req.authUser!.id).select('district');
  if (!teacher) throw new HttpError(404, 'TEACHER_NOT_FOUND', 'The PE Teacher account was not found.');

  const athletes = teacher.district
    ? await AthleteProfile.find({ district: teacher.district }).sort({ createdAt: -1 })
    : [];

  // Also fetch recent posts for these athletes to show in dashboard
  const athleteIds = athletes.map(a => a._id);
  const posts = await AchievementPost.find({ athlete: { $in: athleteIds } })
    .populate<{ athlete: PostAuthor | null }>('athlete', 'fullName sport district region verificationStatus')
    .sort({ createdAt: -1 })
    .limit(50);

  sendSuccess(res, {
    athletes: athletes.map(serializeProfile),
    posts: posts.map(serializePost).filter((post) => post !== null),
  });
});

router.put('/athletes/:id/verification', requireAuth, requireVerifiedRole('pe_teacher'), async (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new HttpError(400, 'INVALID_ID', 'The supplied athlete ID is invalid.');
  }

  const teacher = await User.findById(req.authUser!.id).select('district');
  if (!teacher?.district) {
    throw new HttpError(403, 'DISTRICT_REQUIRED', 'Your PE Teacher account must have a district to verify local athletes.');
  }

  const profile = await AthleteProfile.findById(id);
  if (!profile) throw new HttpError(404, 'ATHLETE_NOT_FOUND', 'Athlete profile was not found.');
  if (profile.district !== teacher.district) {
    throw new HttpError(403, 'OUT_OF_DISTRICT', 'You can only verify athlete profiles in your district.');
  }
  if (profile.verificationStatus !== 'pending') {
    throw new HttpError(409, 'PROFILE_ALREADY_REVIEWED', 'This athlete profile is no longer awaiting verification.');
  }

  profile.verificationStatus = 'verified';
  profile.verifiedBy = teacher._id;
  await profile.save();
  sendSuccess(res, { id: profile.id, verificationStatus: profile.verificationStatus });
});

// PATCH /api/pe-teacher/endorse/:postId
router.patch('/endorse/:postId', requireAuth, requireVerifiedRole('pe_teacher'), validateBody(endorsementSchema), async (req: AuthenticatedRequest, res) => {
  const { postId } = req.params;
  const { status, note } = req.body as z.infer<typeof endorsementSchema>;

  const post = await AchievementPost.findById(postId);
  if (!post) {
    throw new HttpError(404, 'POST_NOT_FOUND', 'The achievement post was not found.');
  }

  post.endorsementStatus = status as 'endorsed' | 'correction_requested';
  post.endorsedBy = req.authUser!.id as any;
  post.endorsementNote = note;

  await post.save();

  sendSuccess(res, { post });
});

export default router;
