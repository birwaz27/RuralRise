import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { HttpError } from '../utils/http.js';

export interface AuthenticatedRequest extends Request {
  authUser?: { id: string; role: 'talent' | 'host' | 'admin' | 'pe_teacher'; peVerified: boolean };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  if (!token) throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication is required.');

  let payload: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw new Error('Invalid token payload');
    }
    payload = decoded;
  } catch {
    throw new HttpError(401, 'INVALID_TOKEN', 'The access token is invalid or expired.');
  }

  const user = await User.findById(payload.sub).select('_id role isVerified');
  if (!user) throw new HttpError(401, 'INVALID_TOKEN', 'The access token is invalid or expired.');
  req.authUser = {
    id: user.id,
    role: user.role as 'talent' | 'host' | 'admin' | 'pe_teacher',
    peVerified: (user as any).isVerified === true,
  };
  next();
}

export function requireRoles(...roles: Array<'talent' | 'host' | 'admin' | 'pe_teacher'>) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    }
    next();
  };
}

export function requireVerifiedRole(role: 'pe_teacher') {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.authUser || req.authUser.role !== role) {
      throw new HttpError(403, 'FORBIDDEN', `This action requires the ${role} role.`);
    }
    if (role === 'pe_teacher' && !req.authUser.peVerified) {
      throw new HttpError(403, 'VERIFICATION_REQUIRED', 'Your account must be verified to perform this action.');
    }
    next();
  };
}
