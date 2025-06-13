import { getJobQueue, JOB_TYPES } from '/app/shared/job-queue.js';
import prisma from './db.js';
import { invalidateCache } from '../middleware/cache.js';

// Initialize the job queue for user service
const userJobQueue = getJobQueue('user-service', {
  // Custom configuration options
  processingTimeout: 120 * 1000, // 2 minutes
  retryLimit: 3
});

// Register job processors for user-related background tasks
export const initializeJobQueue = async () => {
  try {
    // Register processor for updating follower counts
    userJobQueue.registerProcessor(JOB_TYPES.UPDATE_FOLLOWER_COUNTS, async (data) => {
      const { userId } = data;
      
      // Count followers and following
      const [followersCount, followingCount] = await Promise.all([
        prisma.follows.count({ where: { followingId: userId } }),
        prisma.follows.count({ where: { followerId: userId } })
      ]);
      
      // Update user profile with counts
      await prisma.user.update({
        where: { id: userId },
        data: { followersCount, followingCount }
      });
      
      // Invalidate user profile cache
      await invalidateCache(`user:profile:${userId}`);
      
      return { userId, followersCount, followingCount };
    });
    
    // Register processor for user data synchronization
    userJobQueue.registerProcessor(JOB_TYPES.SYNC_USER_DATA, async (data) => {
      const { userId, updatedFields } = data;
      
      // Find all related user data that needs synchronization
      await prisma.user.update({
        where: { id: userId },
        data: updatedFields
      });
      
      // Invalidate relevant caches
      await invalidateCache(`user:profile:${userId}`);
      await invalidateCache(`user:list`);
      
      return { success: true, userId };
    });
    
    // Start processing jobs
    await userJobQueue.startProcessing();
    
    console.log('User service job queue initialized successfully');
    return userJobQueue;
  } catch (error) {
    console.error('Failed to initialize user service job queue:', error);
    throw error;
  }
};

export default userJobQueue;