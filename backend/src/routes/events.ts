import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { AthleteProfile } from '../models/AthleteProfile.js';
import { Event } from '../models/Event.js';
import { AchievementPost } from '../models/AchievementPost.js';
import { HttpError, sendSuccess } from '../utils/http.js';

const router = Router();
const idPattern = /^[a-f\d]{24}$/i;
const createSchema = z.object({
  title: z.string().trim().min(3).max(120), sport: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(3000), location: z.string().trim().min(2).max(180),
  eventDate: z.iso.datetime({ offset: true }), registrationDeadline: z.iso.datetime({ offset: true }),
  sponsorshipDetails: z.string().trim().max(1000).optional().default(''),
});
const reviewSchema = z.object({
  status: z.enum(['shortlisted', 'selected', 'rejected']).optional(),
  registrationConfirmed: z.boolean().optional(),
  sponsorshipStatus: z.enum(['pending', 'confirmed', 'not_applicable']).optional(),
  sponsorshipNote: z.string().trim().max(300).optional(),
}).refine((value) => Object.keys(value).length > 0);
const applySchema = z.object({ message: z.string().trim().max(500).optional().default('') });

function serializeEvent(event: any, includeApplicants = false) {
  const value = event.toObject ? event.toObject() : event;
  return {
    id: String(value._id), title: value.title, sport: value.sport, description: value.description,
    location: value.location, eventDate: value.eventDate, registrationDeadline: value.registrationDeadline,
    sponsorshipDetails: value.sponsorshipDetails, status: value.status,
    createdBy: String(value.createdBy?._id ?? value.createdBy),
    applicantCount: value.applicants?.length ?? 0,
    ...(includeApplicants ? { applicants: (value.applicants ?? []).map((applicant: any) => ({
      player: applicant.player ? {
        id: String(applicant.player._id), userId: String(applicant.player.user?._id ?? applicant.player.user),
        fullName: applicant.player.fullName, age: applicant.player.age, sport: applicant.player.sport,
        district: applicant.player.district, region: applicant.player.region, bio: applicant.player.bio,
        verificationStatus: applicant.player.verificationStatus,
        certificates: applicant.certificates ?? applicant.player.certificates ?? [],
      } : null,
      message: applicant.message, status: applicant.status, appliedAt: applicant.appliedAt,
      registrationConfirmed: applicant.registrationConfirmed,
      sponsorshipStatus: applicant.sponsorshipStatus, sponsorshipNote: applicant.sponsorshipNote,
    })) } : {}),
  };
}

router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const events = await Event.find({ status: 'open', eventDate: { $gte: new Date() } })
    .sort({ eventDate: 1 }).limit(100);
  const profile = req.authUser!.role === 'talent' ? await AthleteProfile.findOne({ user: req.authUser!.id }).select('_id') : null;
  sendSuccess(res, events.map((event) => ({
    ...serializeEvent(event),
    myApplication: profile ? ((event as any).applicants?.find((item: any) => item.player.toString() === profile.id)
      ? { status: (event as any).applicants.find((item: any) => item.player.toString() === profile.id).status, sponsorshipStatus: (event as any).applicants.find((item: any) => item.player.toString() === profile.id).sponsorshipStatus }
      : null) : null,
  })));
});

router.post('/', requireAuth, validateBody(createSchema), async (req: AuthenticatedRequest, res) => {
  if (req.authUser!.role !== 'host') throw new HttpError(403, 'SCOUT_REQUIRED', 'Only Scout accounts can create events.');
  const input = req.body as z.infer<typeof createSchema>;
  const deadline = new Date(input.registrationDeadline);
  const eventDate = new Date(input.eventDate);
  if (deadline >= eventDate) throw new HttpError(400, 'INVALID_DEADLINE', 'Registration deadline must be before the event date.');
  const event = await Event.create({ ...input, eventDate, registrationDeadline: deadline, createdBy: req.authUser!.id });
  sendSuccess(res, serializeEvent(event), 201);
});

router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !idPattern.test(id)) throw new HttpError(400, 'INVALID_ID', 'The supplied event ID is invalid.');
  const event = await Event.findById(id);
  if (!event) throw new HttpError(404, 'EVENT_NOT_FOUND', 'The event was not found.');
  const isOwner = event.createdBy.toString() === req.authUser!.id;
  if (isOwner) {
    const applicants = await Promise.all(event.applicants.map(async (applicant: any) => {
      const profile = await AthleteProfile.findById(applicant.player).populate('user', 'username');
      if (!profile) return { ...applicant.toObject(), player: null, certificates: [] };
      const certificates = await AchievementPost.find({ athlete: profile._id, hasCertificate: true, verificationStatus: 'verified' })
        .select('title eventDate verificationStatus')
        .sort({ eventDate: -1 }).limit(20);
      return { ...applicant.toObject(), player: profile, certificates: certificates.map((post) => ({
        id: String(post._id), title: post.title, eventDate: post.eventDate,
        verificationStatus: post.verificationStatus, certificateUrl: `/api/posts/${post.id}/certificate`,
      })) };
    }));
    sendSuccess(res, serializeEvent({ ...event.toObject(), applicants }, true));
    return;
  }
  const profile = req.authUser!.role === 'talent' ? await AthleteProfile.findOne({ user: req.authUser!.id }).select('_id') : null;
  const applicant = profile ? event.applicants.find((item: any) => item.player.toString() === profile.id) : null;
  const own = serializeEvent({ ...event.toObject(), applicants: [] });
  sendSuccess(res, { ...own, myApplication: applicant ? { status: applicant.status, sponsorshipStatus: applicant.sponsorshipStatus, appliedAt: applicant.appliedAt } : null });
});

router.post('/:id/apply', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.authUser!.role !== 'talent') throw new HttpError(403, 'PLAYER_REQUIRED', 'Only athlete accounts can apply to events.');
  const id = req.params.id;
  if (typeof id !== 'string' || !idPattern.test(id)) throw new HttpError(400, 'INVALID_ID', 'The supplied event ID is invalid.');
  const parsed = applySchema.safeParse(req.body ?? {});
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Application note must be 500 characters or fewer.');
  const profile = await AthleteProfile.findOne({ user: req.authUser!.id }).select('_id');
  if (!profile) throw new HttpError(409, 'PROFILE_REQUIRED', 'Create your athlete profile before applying.');
  const appliedAt = new Date();
  const event = await Event.findOneAndUpdate(
    { _id: id, status: 'open', registrationDeadline: { $gte: appliedAt }, 'applicants.player': { $ne: profile._id } },
    { $push: { applicants: { player: profile._id, message: parsed.data.message, status: 'interested', appliedAt, registrationConfirmed: false, sponsorshipStatus: 'pending', sponsorshipNote: '' } } },
    { returnDocument: 'after', runValidators: true },
  );
  if (!event) {
    const existing = await Event.findById(id).select('status registrationDeadline applicants.player');
    if (!existing || existing.status !== 'open' || existing.registrationDeadline < appliedAt) throw new HttpError(404, 'EVENT_CLOSED', 'This event is no longer accepting applications.');
    throw new HttpError(409, 'ALREADY_APPLIED', 'You have already applied to this event.');
  }
  sendSuccess(res, { eventId: event.id, status: 'interested', appliedAt }, 201);
});

router.patch('/:id/applicants/:playerId', requireAuth, validateBody(reviewSchema), async (req: AuthenticatedRequest, res) => {
  if (req.authUser!.role !== 'host') throw new HttpError(403, 'SCOUT_REQUIRED', 'Only Scout accounts can review applicants.');
  const { id, playerId } = req.params;
  if (typeof id !== 'string' || !idPattern.test(id) || typeof playerId !== 'string' || !idPattern.test(playerId)) {
    throw new HttpError(400, 'INVALID_ID', 'The supplied event or player ID is invalid.');
  }
  const event = await Event.findOne({ _id: id, createdBy: req.authUser!.id });
  if (!event) throw new HttpError(404, 'EVENT_NOT_FOUND', 'The event was not found for your Scout account.');
  const applicant: any = event.applicants.find((item: any) => item.player.toString() === playerId);
  if (!applicant) throw new HttpError(404, 'APPLICANT_NOT_FOUND', 'This player has not applied to the event.');
  Object.assign(applicant, req.body);
  await event.save();
  sendSuccess(res, { playerId, status: applicant.status, registrationConfirmed: applicant.registrationConfirmed, sponsorshipStatus: applicant.sponsorshipStatus, sponsorshipNote: applicant.sponsorshipNote });
});

export default router;
