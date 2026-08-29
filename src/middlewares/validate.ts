import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '../utils/AppError';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Validates and parses a request part against a zod schema, replacing the
 * raw value with the parsed (and, where declared, coerced/defaulted) one
 * so downstream handlers work with trusted, typed data.
 */
export function validate(schema: AnyZodObject, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[part]);
      (req[part] as unknown) = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          new ValidationError(
            'Request validation failed.',
            err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
          ),
        );
        return;
      }
      next(err);
    }
  };
}
