import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const athleteProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    age: { type: Number, required: true, min: 5, max: 100 },
    sport: { type: String, required: true, trim: true, maxlength: 80 },
    district: { type: String, required: true, trim: true, maxlength: 100 },
    region: { type: String, required: true, trim: true, maxlength: 100 },
    background: { type: String, trim: true, maxlength: 3000, default: '' },
    tournaments: { type: [String], default: [] },
    bio: { type: String, trim: true, maxlength: 2000, default: '' },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      required: true,
    },
    planTier: { type: String, enum: ['standard', 'pro'], default: 'standard', required: true },
    priorityPlacement: { type: Boolean, default: false, required: true },
    viewCount: { type: Number, min: 0, default: 0, select: false },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    photo: { type: Buffer, select: false },
    photoContentType: { type: String, select: false },
  },
  { timestamps: true },
);

athleteProfileSchema.index({ sport: 1, district: 1, verificationStatus: 1 });
athleteProfileSchema.index({ priorityPlacement: -1, createdAt: -1 });

export type AthleteProfileDocument = InferSchemaType<typeof athleteProfileSchema> & mongoose.Document;
export const AthleteProfile = mongoose.model('AthleteProfile', athleteProfileSchema);
