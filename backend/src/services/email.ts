import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export function isEmailConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.EMAIL_FROM);
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error('SMTP is not fully configured.');
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  const resetUrl = new URL('/forgot-password', `${env.CLIENT_URL.replace(/\/$/, '')}/`);
  resetUrl.searchParams.set('token', token);

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: email,
    subject: 'Reset your Rural Talent Hub password',
    text: `Reset your RuralRise password within 30 minutes by opening this link: ${resetUrl.toString()}`,
    html: `<p>We received a request to reset your RuralRise password.</p><p><a href="${resetUrl.toString()}">Choose a new password</a></p><p>This link expires in 30 minutes. If you did not request a reset, you can ignore this email.</p>`,
  });
}
