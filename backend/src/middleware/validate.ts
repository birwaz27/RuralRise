import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { HttpError } from '../utils/http.js';

export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields = result.error.issues.reduce<Record<string, string[]>>((all, issue) => {
        const key = issue.path.join('.') || 'body';
        (all[key] ??= []).push(issue.message);
        return all;
      }, {});
      throw new HttpError(400, 'VALIDATION_ERROR', 'Please correct the submitted fields.', fields);
    }
    req.body = result.data;
    next();
  };
}
