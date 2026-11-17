import bcrypt from 'bcryptjs';
import { connectToDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';

if (!env.SEED_ADMIN_USERNAME || !env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
  throw new Error('SEED_ADMIN_USERNAME, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD are required.');
}

await connectToDatabase();
const email = env.SEED_ADMIN_EMAIL.toLowerCase();
const existing = await User.findOne({ $or: [{ email }, { username: env.SEED_ADMIN_USERNAME }] });
if (existing) {
  throw new Error('An account with the seed admin email or username already exists.');
}

await User.create({
  username: env.SEED_ADMIN_USERNAME,
  email,
  passwordHash: await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12),
  role: 'admin',
});
logger.info('Seed admin account created', { email });
process.exit(0);
