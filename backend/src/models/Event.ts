import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const applicantSchema = new Schema({
  player: { type: Schema.Types.ObjectId, ref: 'AthleteProfile', required: true },
  message: { type: String, trim: true, maxlength: 500, default: '' },
  status: { type: String, enum: ['interested', 'shortlisted', 'selected', 'rejected'], default: 'interested', required: true },
  appliedAt: { type: Date, default: Date.now, required: true },
  registrationConfirmed: { type: Boolean, default: false, required: true },
  sponsorshipStatus: { type: String, enum: ['pending', 'confirmed', 'not_applicable'], default: 'pending', required: true },
  sponsorshipNote: { type: String, trim: true, maxlength: 300, default: '' },
}, { _id: false });

const eventSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  sport: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  location: { type: String, required: true, trim: true, maxlength: 180 },
  eventDate: { type: Date, required: true },
  registrationDeadline: { type: Date, required: true },
  sponsorshipDetails: { type: String, trim: true, maxlength: 1000, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open', required: true },
  applicants: { type: [applicantSchema], default: [] },
}, { timestamps: true });

eventSchema.index({ status: 1, eventDate: 1, sport: 1 });
eventSchema.index({ createdBy: 1, createdAt: -1 });
eventSchema.index({ 'applicants.player': 1 });

export type EventDocument = InferSchemaType<typeof eventSchema> & mongoose.Document;
export const Event = mongoose.model('Event', eventSchema);
