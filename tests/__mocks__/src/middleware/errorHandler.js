// Mock for src/middleware/errorHandler.js
export const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export { default as AppError } from '../utils/appError.js';
