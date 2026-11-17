import mongoose, { Schema } from 'mongoose';

const connectionRequestSchema = new Schema(
  {
    athlete: { type: Schema.Types.ObjectId, ref: 'AthleteProfile', required: true },
    fromUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending', required: true },
  },
  { timestamps: true },
);

connectionRequestSchema.index({ fromUser: 1, athlete: 1 }, { unique: true });
connectionRequestSchema.index({ toUser: 1, status: 1 });

export const ConnectionRequest = mongoose.model('ConnectionRequest', connectionRequestSchema);
