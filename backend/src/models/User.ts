import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 40 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    refreshTokenHash: { type: String, select: false },
    refreshSessions: {
      type: [{ sessionId: { type: String, required: true }, tokenHash: { type: String, required: true } }],
      default: [],
      select: false,
    },
    role: { type: String, enum: ['talent', 'host', 'admin', 'pe_teacher'], required: true },
    hostVerificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      required: true,
    },
    isVerified: { type: Boolean },
    verificationMethod: { type: String, enum: ['domain_auto', 'read_only_pending', 'manual_approved', 'pending_review'] },
    institutionName: { type: String },
    district: { type: String },
    shortlist: [{ type: Schema.Types.ObjectId, ref: 'AthleteProfile' }],
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ username: 1 }, { unique: true });

export type UserDocument = InferSchemaType<typeof userSchema> & mongoose.Document;
export const User = mongoose.model('User', userSchema);
