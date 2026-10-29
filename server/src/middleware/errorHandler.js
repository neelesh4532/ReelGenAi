import { logger } from '../config/logger.js';

export class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = err.status || 500;
  let message = err.message;

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  } else if (err.name === 'ValidationError') {
    status = 400; // Mongoose validation
  } else if (err.code === 11000) {
    status = 409;
    message = 'Resource already exists';
  }

  if (status >= 500) logger.error({ err }, 'Unhandled error');
  else logger.warn({ msg: message, path: req.originalUrl }, 'Request failed');

  res.status(status).json({
      error: status >= 500 ? 'Something went wrong' : message,
      detail:
        status >= 500 && process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
}