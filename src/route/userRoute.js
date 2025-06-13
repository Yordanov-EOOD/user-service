import { Router } from 'express';
import userController from '../controllers/userController.js';
import { userValidation } from '../middleware/validation.js';
import { handleValidationErrors } from '../middleware/errorHandler.js';
import * as rateLimit from '../middleware/rateLimit.js';
import * as security from '../middleware/security.js';

// Debug log to check controller import
console.log('userController:', userController);
console.log('userController.healthCheck:', userController.healthCheck);
console.log('userController methods:', Object.getOwnPropertyNames(userController));

const userRouter = Router();

// Apply security middleware to all routes
userRouter.use(security.sanitizeInput);
userRouter.use(security.validateContentType);

// Health check endpoint (no rate limiting)
userRouter.get('/health', userController.healthCheck);

// Statistics endpoint (admin only, with rate limiting)
userRouter.get('/stats', 
  rateLimit.strictRateLimit,
  userController.getUserStats
);

// Basic user operations with validation and rate limiting
userRouter.post('/', 
  rateLimit.createUserRateLimit,
  userValidation.createUser,
  handleValidationErrors,
  userController.createUser
);

userRouter.get('/', 
  rateLimit.generalRateLimit,
  userController.getAllUsers
);

userRouter.get('/:id', 
  rateLimit.generalRateLimit,
  userController.getUserById
);

userRouter.put('/:id', 
  rateLimit.updateUserRateLimit,
  userValidation.updateUser,
  handleValidationErrors,
  userController.updateUser
);

userRouter.delete('/:id', 
  rateLimit.strictRateLimit,
  userValidation.deleteUser,
  handleValidationErrors,
  userController.deleteUser
);

// TODO: Add relationship routes when controller is available
// userRouter.post('/:id/follow', 
//   rateLimit.updateOperations,
//   userValidation.followUser,
//   handleValidationErrors,
//   followUser
// );

// userRouter.post('/:id/unfollow', 
//   rateLimit.updateOperations,
//   userValidation.unfollowUser,
//   handleValidationErrors,
//   unfollowUser
// );

// userRouter.get('/:id/followers', 
//   rateLimit.readOperations,
//   userValidation.getFollowers,
//   handleValidationErrors,
//   getFollowers
// );

// userRouter.get('/:id/following', 
//   rateLimit.readOperations,
//   userValidation.getFollowing,
//   handleValidationErrors,
//   getFollowing
// );

export default userRouter;