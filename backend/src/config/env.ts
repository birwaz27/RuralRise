import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const corsOriginsSchema = z.string().min(1).refine((value) => {
  const origins = value.split(',').map((origin) => origin.trim());
  return origins.every((origin) => {
    if (!origin || origin === '*') return false;
    try {
      const parsed = new URL(origin);
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin === origin;
    } catch {
      return false;
    }
  });
}, 'CORS_ORIGINS must be a comma-separated list of explicit HTTP(S) origins');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.preprocess(
    (value) => (value === undefined || value === '' ? '5000' : value),
    z.coerce.number().int().positive(),
  ),
  MONGODB_URI: z
    .string()
    .refine(
      (value) => value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'),
      'MONGODB_URI must be a mongodb:// or mongodb+srv:// URI',
    ),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.url(),
  CORS_ORIGINS: corsOriginsSchema,
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex characters'),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.preprocess(
    (value) => (value === undefined || value === '' ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  SENTRY_DSN: z.url().optional(),
  SEED_ADMIN_USERNAME: z.string().min(3).optional(),
  SEED_ADMIN_EMAIL: z.email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).max(72).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
