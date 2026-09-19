import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async Express route handler or middleware to catch any rejected promises
 * and automatically forward them to Express error-handling middleware (`next(err)`).
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default asyncHandler;
