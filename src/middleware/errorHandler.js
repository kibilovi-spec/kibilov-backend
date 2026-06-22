'use strict';

// Standard error response format:
// { success: false, message: string, code?: string, details?: any }

function errorResponse(res, status, message, code = null, details = null) {
  const body = { success: false, message };
  if (code) body.code = code;
  if (details) body.details = details;
  return res.status(status).json(body);
}

// Validation error (422)
function validationError(res, message, details = null) {
  return errorResponse(res, 422, message, 'VALIDATION_ERROR', details);
}

// Not found (404)
function notFoundError(res, message = 'რესურსი ვერ მოიძებნა') {
  return errorResponse(res, 404, message, 'NOT_FOUND');
}

// Unauthorized (401)
function unauthorizedError(res, message = 'ავტორიზაცია საჭიროა') {
  return errorResponse(res, 401, message, 'UNAUTHORIZED');
}

// Forbidden (403)
function forbiddenError(res, message = 'წვდომა აკრძალულია') {
  return errorResponse(res, 403, message, 'FORBIDDEN');
}

// Server error (500)
function serverError(res, message = 'სერვერის შეცდომა', err = null) {
  if (err) console.error('[SERVER ERROR]', err);
  return errorResponse(res, 500, message, 'SERVER_ERROR');
}

// Express global error handler (app.use at the end)
function globalErrorHandler(err, req, res, next) {
  console.error('[UNHANDLED ERROR]', err);
  return errorResponse(res, 500, err.message || 'სერვერის შეცდომა', 'SERVER_ERROR');
}

module.exports = {
  errorResponse,
  validationError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  serverError,
  globalErrorHandler,
};
