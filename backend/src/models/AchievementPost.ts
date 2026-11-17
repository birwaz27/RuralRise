import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const achievementPostSchema = new Schema(
  {
    athlete: { type: Schema.Types.ObjectId, ref: 'AthleteProfile', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1500 },
    eventDate: { type: Date },
    hasPhoto: { type: Boolean, default: false, required: true },
    photo: { type: Buffer, select: false },
    photoContentType: { type: String, select: false },
    hasVideo: { type: Boolean, default: false, required: true },
    video: { type: Buffer, select: false },
    videoContentType: { type: String, select: false },
    endorsementStatus: { type: String, enum: ['unverified', 'endorsed', 'correction_requested'], default: 'unverified' },
    endorsedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    endorsementNote: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

achievementPostSchema.index({ createdAt: -1 });
achievementPostSchema.index({ athlete: 1, createdAt: -1 });

export type AchievementPostDocument = InferSchemaType<typeof achievementPostSchema> & mongoose.Document;
export const AchievementPost = mongoose.model('AchievementPost', achievementPostSchema);
