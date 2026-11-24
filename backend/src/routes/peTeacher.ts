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
const certificateReviewSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  notes: z.string().trim().max(500).optional().default(''),
});

router.get('/pending-verifications', requireAuth, requireVerifiedRole('pe_teacher'), async (req: AuthenticatedRequest, res) => {
  const teacher = await User.findById(req.authUser!.id).select('district');
  if (!teacher?.district) throw new HttpError(403, 'DISTRICT_REQUIRED', 'Your PE Teacher account must have a district to verify certificates.');
  const districtProfiles = await AthleteProfile.find({ district: { $regex: `^${teacher.district.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }).select('_id');
  const posts = await AchievementPost.find({ verificationStatus: 'pending', hasCertificate: true })
    .where('athlete').in(districtProfiles.map((profile) => profile._id))
    .populate<{ athlete: import('../models/AthleteProfile.js').AthleteProfileDocument | null }>('athlete', 'fullName sport district region user')
    .sort({ createdAt: 1 }).limit(500);
  sendSuccess(res, posts.map((post) => ({
    id: String(post._id), title: post.title, description: post.description, eventDate: post.eventDate,
    createdAt: post.createdAt, verificationStatus: post.verificationStatus,
    certificateUrl: `/api/posts/${post.id}/certificate`,
    athlete: post.athlete ? { id: String(post.athlete._id), fullName: post.athlete.fullName, sport: post.athlete.sport, district: post.athlete.district, region: post.athlete.region } : null,
  })));
});

router.patch('/verify/:achievementId', requireAuth, requireVerifiedRole('pe_teacher'), validateBody(certificateReviewSchema), async (req: AuthenticatedRequest, res) => {
  const { achievementId } = req.params;
  if (typeof achievementId !== 'string' || !/^[a-f\d]{24}$/i.test(achievementId)) throw new HttpError(400, 'INVALID_ID', 'The supplied achievement ID is invalid.');
  const teacher = await User.findById(req.authUser!.id).select('district');
  if (!teacher?.district) throw new HttpError(403, 'DISTRICT_REQUIRED', 'Your PE Teacher account must have a district to verify certificates.');
  const post = await AchievementPost.findById(achievementId).populate<{ athlete: import('../models/AthleteProfile.js').AthleteProfileDocument | null }>('athlete', 'district');
  if (!post || !post.hasCertificate) throw new HttpError(404, 'CERTIFICATE_NOT_FOUND', 'The certificate was not found.');
  if (!post.athlete || post.athlete.district.trim().toLowerCase() !== teacher.district.trim().toLowerCase()) throw new HttpError(403, 'OUT_OF_DISTRICT', 'You can only verify certificates from athletes in your district.');
  if (post.verificationStatus !== 'pending') throw new HttpError(409, 'CERTIFICATE_ALREADY_REVIEWED', 'This certificate is no longer awaiting verification.');
  const input = req.body as z.infer<typeof certificateReviewSchema>;
  post.verificationStatus = input.status;
  post.verifiedBy = req.authUser!.id as any;
  post.verificationNotes = input.notes;
  await post.save();
  sendSuccess(res, { id: post.id, verificationStatus: post.verificationStatus, verificationNotes: post.verificationNotes });
});

router.get('/athletes', requireAuth, requireVerifiedRole('pe_teacher'), async (req: AuthenticatedRequest, res) => {
  const teacher = await User.findById(req.authUser!.id).select('district');
  if (!teacher) throw new HttpError(404, 'TEACHER_NOT_FOUND', 'The PE Teacher account was not found.');

  const teacherDistrict = teacher.district?.trim();
  const districtQuery = teacherDistrict
    ? { district: { $regex: new RegExp(`^${teacherDistrict.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
    : null;

  const athletes = districtQuery
    ? await AthleteProfile.find(districtQuery).sort({ createdAt: -1 })
    : [];

  // Also catch any registered talent users in this district who don't have an AthleteProfile yet
  if (districtQuery && teacherDistrict) {
    const existingUserIds = athletes.map((a) => a.user.toString());
    const usersWithoutProfile = await User.find({
      role: 'talent',
      district: districtQuery.district,
      _id: { $nin: existingUserIds },
    });

    for (const u of usersWithoutProfile) {
      const created = await AthleteProfile.create({
        user: u._id,
        fullName: u.username,
        age: 18,
        sport: 'Athletics',
        district: u.district || teacherDistrict,
        region: u.district || teacherDistrict,
        verificationStatus: 'pending',
      });
      athletes.unshift(created);
    }
  }

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
  if (profile.district.trim().toLowerCase() !== teacher.district.trim().toLowerCase()) {
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
