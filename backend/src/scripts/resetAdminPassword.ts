import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectToDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';

if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
  throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required.');
}

try {
  await connectToDatabase();
  const user = await User.findOne({
    email: env.SEED_ADMIN_EMAIL.toLowerCase(),
    role: 'admin',
  }).select('+passwordHash');

  if (!user) {
    throw new Error('No admin account matches SEED_ADMIN_EMAIL.');
  }

  user.passwordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12);
  await user.save();
  logger.info('Admin password updated', { email: user.email });
} finally {
  await mongoose.disconnect();
}
