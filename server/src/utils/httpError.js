export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`);
export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const conflict = (msg) => new HttpError(409, msg);

/** Wraps async route handlers so rejected promises reach the error handler. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
