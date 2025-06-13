import prisma from '../config/db.js';
import { getUserServiceProducer, TOPICS, MESSAGE_TYPES } from '/app/shared/kafka.js';

// Follow a user and publish event to Kafka with async processing
export const followUser = async (req, res) => {
  try {
    const { id: followingId } = req.params; // ID of the user being followed
    const { userId: followerId } = req.user; // ID of the user doing the following
    
    // Check if input IDs are valid before proceeding
    if (!followerId || !followingId) {
      return res.status(400).json({ error: 'Missing required user IDs' });
    }
    
    // Respond immediately for better UX (non-blocking)
    res.status(202).json({ 
      message: 'Follow request accepted',
      status: 'processing',
      followerId,
      followingId
    });
    
    // Process the follow request asynchronously
    try {
      // Use a transaction to ensure data consistency
      const result = await prisma.$transaction(async (tx) => {
        // Fetch both users in parallel
        const [follower, following, existingRelationship] = await Promise.all([
          tx.user.findUnique({ where: { id: followerId }, select: { id: true, authUserId: true } }),
          tx.user.findUnique({ where: { id: followingId }, select: { id: true, authUserId: true } }),
          tx.follows.findUnique({
            where: {
              followerId_followingId: {
                followerId,
                followingId,
              },
            },
          })
        ]);
        
        // Validate users exist
        if (!follower || !following) {
          throw new Error(`One or more users not found`);
        }
        
        // Check if already following
        if (existingRelationship) {
          // No need to create duplicate relationship
          return { alreadyExists: true, follower, following };
        }
        
        // Create the follow relationship
        const follow = await tx.follows.create({
          data: {
            follower: { connect: { id: followerId } },
            following: { connect: { id: followingId } },
          }
        });
        
        return { success: true, follow, follower, following };
      });
      
      // If the relationship was created, invalidate caches and publish event
      if (result.success || result.alreadyExists) {
        // Invalidate relevant caches in parallel
        await Promise.all([
          invalidateCache(`user:profile:${followingId}`),
          invalidateCache(`user:profile:${followerId}`),
          invalidateCache(`follow:${followerId}:following`),
          invalidateCache(`follow:${followingId}:followers`),
        ]);
        
        // Only publish the event if this is a new relationship
        if (result.success) {
          // Publish to Kafka with retry mechanism built into our enhanced producer
          const producer = await getUserServiceProducer();
          await producer.publishMessage(
            TOPICS.USER_FOLLOWED,
            {
              followerId,
              followingId,
              followerAuthId: result.follower.authUserId,
              followingAuthId: result.following.authUserId,
            },
            `follow-${followerId}-${followingId}`
          );
        }
      }
    } catch (error) {
      // Log error but don't affect user experience since response already sent
      console.error('Error in async follow processing:', error);
      
      // Send follow error event for monitoring and potential recovery
      try {
        const producer = await getUserServiceProducer();
        await producer.publishMessage(
          TOPICS.DEAD_LETTER_QUEUE,
          {
            operation: 'follow',
            followerId,
            followingId,
            error: error.message
          }
        );
      } catch (kafkaError) {
        console.error('Failed to publish follow error event:', kafkaError);
      }
    }
  } catch (error) {
    // This only catches synchronous errors before response is sent
    console.error('Error in followUser:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Unfollow a user and publish event to Kafka with async processing
export const unfollowUser = async (req, res) => {
  try {
    const { id: followingId } = req.params; // ID of the user being unfollowed
    const { userId: followerId } = req.user; // ID of the user doing the unfollowing
    
    // Check if input IDs are valid before proceeding
    if (!followerId || !followingId) {
      return res.status(400).json({ error: 'Missing required user IDs' });
    }
    
    // Respond immediately for better UX (non-blocking)
    res.status(202).json({ 
      message: 'Unfollow request accepted',
      status: 'processing',
      followerId,
      followingId
    });
    
    // Process the unfollow request asynchronously
    try {
      // Use a transaction to ensure data consistency
      const result = await prisma.$transaction(async (tx) => {
        // Check if relationship exists
        const existingRelationship = await tx.follows.findUnique({
          where: {
            followerId_followingId: {
              followerId,
              followingId,
            },
          },
        });
        
        if (!existingRelationship) {
          throw new Error('Relationship does not exist');
        }
        
        // Delete the follow relationship
        const deletedFollow = await tx.follows.delete({
          where: {
            followerId_followingId: {
              followerId,
              followingId,
            },
          },
        });
        
        return { success: true, deletedFollow };
      });
      
      // If the relationship was deleted, invalidate caches and publish event
      if (result.success) {
        // Invalidate relevant caches in parallel
        await Promise.all([
          invalidateCache(`user:profile:${followingId}`),
          invalidateCache(`user:profile:${followerId}`),
          invalidateCache(`follow:${followerId}:following`),
          invalidateCache(`follow:${followingId}:followers`),
        ]);
        
        // Publish to Kafka with retry mechanism built into our enhanced producer
        const producer = await getUserServiceProducer();
        await producer.publishMessage(
          TOPICS.USER_UNFOLLOWED,
          {
            followerId,
            followingId
          },
          `unfollow-${followerId}-${followingId}`
        );
      }
    } catch (error) {
      // Log error but don't affect user experience since response already sent
      console.error('Error in async unfollow processing:', error);
      
      // Send unfollow error event for monitoring and potential recovery
      try {
        const producer = await getUserServiceProducer();
        await producer.publishMessage(
          TOPICS.DEAD_LETTER_QUEUE,
          {
            operation: 'unfollow',
            followerId,
            followingId,
            error: error.message
          }
        );
      } catch (kafkaError) {
        console.error('Failed to publish unfollow error event:', kafkaError);
      }
    }
  } catch (error) {
    // This only catches synchronous errors before response is sent
    console.error('Error in unfollowUser:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all followers for a user with pagination and batching
export const getFollowers = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    
    // Use a transaction to get both count and data in one round trip to the database
    const result = await prisma.$transaction([
      // Get total count for pagination metadata
      prisma.follows.count({
        where: { followingId: id },
      }),
      // Get paginated batch of followers
      prisma.follows.findMany({
        where: { followingId: id },
        include: { follower: true },
        skip,
        take,
        orderBy: { createdAt: 'desc' }, // Most recent followers first
      })
    ]);
    
    const [totalCount, followers] = result;
    const hasMore = skip + followers.length < totalCount;
    
    res.status(200).json({
      followers: followers.map(f => f.follower),
      pagination: {
        page: parseInt(page),
        limit: take,
        total: totalCount,
        hasMore
      }
    });
    
  } catch (error) {
    console.error('Error in getFollowers:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all users a user is following with pagination and batching
export const getFollowing = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    
    // Use a transaction to get both count and data in one round trip to the database
    const result = await prisma.$transaction([
      // Get total count for pagination metadata
      prisma.follows.count({
        where: { followerId: id },
      }),
      // Get paginated batch of following
      prisma.follows.findMany({
        where: { followerId: id },
        include: { following: true },
        skip,
        take,
        orderBy: { createdAt: 'desc' }, // Most recently followed users first
      })
    ]);
    
    const [totalCount, following] = result;
    const hasMore = skip + following.length < totalCount;
    
    res.status(200).json({
      following: following.map(f => f.following),
      pagination: {
        page: parseInt(page),
        limit: take,
        total: totalCount,
        hasMore
      }
    });
    
  } catch (error) {
    console.error('Error in getFollowing:', error);
    res.status(500).json({ error: 'Server error' });
  }
};