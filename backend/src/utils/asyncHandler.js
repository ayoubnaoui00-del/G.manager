/**
 * Wraps async Express route handlers to forward rejected promises to next(err).
 * Returns the promise to allow awaiting in test suites and middlewares.
 */
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
