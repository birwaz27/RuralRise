import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { z } from 'zod';
import { AchievementPost, type AchievementPostDocument } from '../models/AchievementPost.js';
import { AthleteProfile, type AthleteProfileDocument } from '../models/AthleteProfile.js';
import { requireAuth, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { HttpError, sendSuccess } from '../utils/http.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/png', 'image/jpeg', 'video/mp4', 'video/webm'].includes(file.mimetype)) {
      callback(new HttpError(400, 'INVALID_MEDIA_TYPE', 'Choose a PNG, JPG, MP4, or WebM file.'));
      return;
    }
    callback(null, true);
  },
});

const postSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(1500),
  eventDate: z.iso.date().optional(),
});
const editPostSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(1500),
  eventDate: z.union([z.iso.date(), z.literal('')]),
});

export type PostAuthor = Pick<AthleteProfileDocument, '_id' | 'fullName' | 'sport' | 'district' | 'region' | 'verificationStatus'>;
export type PopulatedPost = Omit<AchievementPostDocument, 'athlete'> & { athlete: PostAuthor | null };
type PostFilter = { athlete?: mongoose.Types.ObjectId };
type AchievementMedia = { type: 'image' | 'video'; contentType: string };

function validateMediaFile(file: { mimetype: string; size: number; buffer: Buffer }): AchievementMedia {
  const isPng = file.mimetype === 'image/png'
    && file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = file.mimetype === 'image/jpeg'
    && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
  const isMp4 = file.mimetype === 'video/mp4' && file.buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  const isWebm = file.mimetype === 'video/webm'
    && file.buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));

  if (isPng || isJpeg) {
    if (file.size > 2 * 1024 * 1024) {
      throw new HttpError(413, 'FILE_TOO_LARGE', 'Images must be no larger than 2 MB.');
    }
    return { type: 'image', contentType: file.mimetype };
  }
  if (isMp4 || isWebm) return { type: 'video', contentType: file.mimetype };
  throw new HttpError(400, 'INVALID_MEDIA', 'The uploaded file is not a valid PNG, JPG, MP4, or WebM file.');
}

export function serializePost(post: PopulatedPost) {
  const athlete = post.athlete;
  if (!athlete) return null;
  return {
    id: String(post._id),
    title: post.title,
    description: post.description,
    eventDate: post.eventDate?.toISOString() ?? null,
    createdAt: post.createdAt,
    endorsementStatus: post.endorsementStatus,
    endorsementNote: post.endorsementNote ?? null,
    photoUrl: post.hasPhoto ? `/api/posts/${post._id}/photo?v=${post.updatedAt.getTime()}` : null,
    videoUrl: post.hasVideo ? `/api/posts/${post._id}/video?v=${post.updatedAt.getTime()}` : null,
    mediaType: post.hasVideo ? 'video' : 'image',
    athlete: {
      id: String(athlete._id),
      fullName: athlete.fullName,
      sport: athlete.sport,
      district: athlete.district,
      region: athlete.region,
      verificationStatus: athlete.verificationStatus,
      photoUrl: `/api/athletes/${athlete._id}/photo`,
    },
  };
}

async function getPosts(filter: PostFilter, page: number, limit: number) {
  const [posts, total] = await Promise.all([
    AchievementPost.find(filter)
      .populate<{ athlete: PostAuthor | null }>('athlete', 'fullName sport district region verificationStatus')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AchievementPost.countDocuments(filter),
  ]);
  return {
    items: posts.map((post) => serializePost(post)).filter((post) => post !== null),
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}

router.get('/', async (req, res) => {
  const querySchema = z.object({
    athleteId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  });
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'The feed filters are invalid.');
  const filter: PostFilter = {};
  if (parsed.data.athleteId) {
    filter.athlete = new mongoose.Types.ObjectId(parsed.data.athleteId);
  }
  sendSuccess(res, await getPosts(filter, parsed.data.page, parsed.data.limit));
});

router.get('/mine', requireAuth, requireRoles('talent'), async (req: AuthenticatedRequest, res) => {
  const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  });
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'The feed filters are invalid.');
  const profile = await AthleteProfile.findOne({ user: req.authUser!.id }).select('_id');
  if (!profile) {
    sendSuccess(res, { items: [], page: parsed.data.page, limit: parsed.data.limit, total: 0, pages: 0 });
    return;
  }
  sendSuccess(res, await getPosts({ athlete: profile._id }, parsed.data.page, parsed.data.limit));
});

router.post('/', requireAuth, requireRoles('talent'), upload.single('photo'), validateBody(postSchema), async (req: AuthenticatedRequest, res) => {
  const profile = await AthleteProfile.findOne({ user: req.authUser!.id }).select('_id');
  if (!profile) throw new HttpError(409, 'PROFILE_REQUIRED', 'Create your athlete profile before sharing an achievement.');
  const file = req.file;
  const { title, description, eventDate } = req.body as z.infer<typeof postSchema>;
  if (!file) throw new HttpError(400, 'MEDIA_REQUIRED', 'Choose an image or video for your achievement.');
  const media = validateMediaFile(file);
  const post = await AchievementPost.create({
    athlete: profile._id,
    title,
    description,
    ...(eventDate ? { eventDate: new Date(`${eventDate}T00:00:00.000Z`) } : {}),
    hasPhoto: media.type === 'image',
    hasVideo: media.type === 'video',
    ...(media.type === 'image'
      ? { photo: file.buffer, photoContentType: media.contentType }
      : { video: file.buffer, videoContentType: media.contentType }),
  });
  const populated = await post.populate<{ athlete: PostAuthor | null }>(
    'athlete',
    'fullName sport district region verificationStatus',
  );
  const serialized = serializePost(populated);
  if (!serialized) throw new HttpError(500, 'POST_AUTHOR_MISSING', 'The achievement author could not be loaded.');
  sendSuccess(res, serialized, 201);
});

router.patch('/:id', requireAuth, requireRoles('talent'), upload.single('photo'), validateBody(editPostSchema), async (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new HttpError(400, 'INVALID_ID', 'The supplied post ID is invalid.');
  }
  const profile = await AthleteProfile.findOne({ user: req.authUser!.id }).select('_id');
  const post = profile
    ? await AchievementPost.findOne({ _id: id, athlete: profile._id })
    : null;
  if (!post) throw new HttpError(404, 'POST_NOT_FOUND', 'The achievement was not found on your profile.');

  const { title, description, eventDate } = req.body as z.infer<typeof editPostSchema>;
  post.title = title;
  post.description = description;
  post.eventDate = eventDate ? new Date(`${eventDate}T00:00:00.000Z`) : undefined;

  const file = req.file;
  if (file) {
    const media = validateMediaFile(file);
    if (media.type === 'image') {
      post.photo = file.buffer;
      post.photoContentType = media.contentType;
      post.video = undefined;
      post.videoContentType = undefined;
    } else {
      post.video = file.buffer;
      post.videoContentType = media.contentType;
      post.photo = undefined;
      post.photoContentType = undefined;
    }
    post.hasPhoto = media.type === 'image';
    post.hasVideo = media.type === 'video';
  }

  await post.save();
  const populated = await post.populate<{ athlete: PostAuthor | null }>(
    'athlete',
    'fullName sport district region verificationStatus',
  );
  const serialized = serializePost(populated);
  if (!serialized) throw new HttpError(500, 'POST_AUTHOR_MISSING', 'The achievement author could not be loaded.');
  sendSuccess(res, serialized);
});

router.get('/:id/photo', async (req, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new HttpError(400, 'INVALID_ID', 'The supplied post ID is invalid.');
  }
  const post = await AchievementPost.findById(id).select('+photo +photoContentType');
  if (!post?.photo || !post.photoContentType) {
    throw new HttpError(404, 'PHOTO_NOT_FOUND', 'No achievement photo was found.');
  }
  res.type(post.photoContentType).set('Cache-Control', 'public, max-age=3600').send(post.photo);
});

router.get('/:id/video', async (req, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new HttpError(400, 'INVALID_ID', 'The supplied post ID is invalid.');
  }
  const post = await AchievementPost.findById(id).select('+video +videoContentType');
  if (!post?.video || !post.videoContentType) {
    throw new HttpError(404, 'VIDEO_NOT_FOUND', 'No achievement video was found.');
  }

  const video = post.video;
  const range = req.headers.range;
  res.set('Accept-Ranges', 'bytes').set('Cache-Control', 'public, max-age=3600').type(post.videoContentType);
  if (!range) {
    res.set('Content-Length', String(video.length)).send(video);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) {
    res.status(416).set('Content-Range', `bytes */${video.length}`).end();
    return;
  }
  const suffixLength = Number(match[2]);
  const start = match[1] ? Number(match[1]) : Math.max(video.length - suffixLength, 0);
  const end = match[1]
    ? (match[2] ? Math.min(suffixLength, video.length - 1) : video.length - 1)
    : video.length - 1;
  if (start >= video.length || start > end || (!match[1] && suffixLength === 0)) {
    res.status(416).set('Content-Range', `bytes */${video.length}`).end();
    return;
  }
  res.status(206)
    .set('Content-Range', `bytes ${start}-${end}/${video.length}`)
    .set('Content-Length', String(end - start + 1))
    .send(video.subarray(start, end + 1));
});

router.delete('/:id', requireAuth, requireRoles('talent'), async (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new HttpError(400, 'INVALID_ID', 'The supplied post ID is invalid.');
  }
  const profile = await AthleteProfile.findOne({ user: req.authUser!.id }).select('_id');
  const post = profile
    ? await AchievementPost.findOneAndDelete({ _id: id, athlete: profile._id })
    : null;
  if (!post) throw new HttpError(404, 'POST_NOT_FOUND', 'The achievement was not found on your profile.');
  sendSuccess(res, { id });
});

export default router;
