import { PrismaClient } from '@prisma/client';
import AppError from '../utils/appError.js';
import logger from '../config/logger.js';
import dbOptimization from '../utils/dbOptimization.js';
import performance from '../utils/performance.js';
import config from '../config/index.js';

const prisma = new PrismaClient();

class UserService {
  constructor() {
    this.tableName = 'user';
    this.selectFields = {
      id: true,
      authUserId: true,
      username: true,
      bio: true,
      image: true,
      createdAt: true,
      updatedAt: true
    };
  }

  async getUserProfile(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: dbOptimization.selectFields.getUserProfile
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return user;
    } catch (error) {
      logger.error('Error getting user profile', { error, userId });
      throw error;
    }
  }

  async updateUserProfile(userId, data) {
    try {
      // Validate update data
      if (!data || Object.keys(data).length === 0) {
        throw new AppError('Invalid update data', 400);
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data,
        select: dbOptimization.selectFields.getUserProfile
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return user;
    } catch (error) {
      logger.error('Error updating user profile', { error, userId, data });
      throw error;
    }
  }



  async getAllUsers({ page = 1, limit = 10, search = '' }) {
    try {
      const skip = (page - 1) * limit;
      const where = search ? {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
        ]
      } : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          select: dbOptimization.selectFields.getUserBasic,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.user.count({ where })
      ]);

      return {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error getting all users', { error, page, limit, search });
      throw error;
    }
  }

  async deleteUser(userId) {
    try {
      const user = await prisma.user.delete({
        where: { id: userId },
        select: dbOptimization.selectFields.getUserBasic
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return user;
    } catch (error) {
      logger.error('Error deleting user', { error, userId });
      throw error;
    }
  }

  async getUserStatistics() {
    try {
      const [totalUsers, activeUsers, newUsersToday] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            lastActiveAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      return {
        totalUsers,
        activeUsers,
        newUsersToday
      };
    } catch (error) {
      logger.error('Error getting user statistics', { error });
      throw error;
    }
  }

  async createUser(userData, correlationId) {
    const timer = performance.startTimer();
    
    try {
      logger.info('Creating user', {
        correlationId,
        operation: 'createUser',
        data: { username: userData.username }
      });

      // Validate required fields
      if (!userData.authUserId) {
        throw new AppError('Auth user ID is required', 400);
      }

      if (!userData.username) {
        throw new AppError('Username is required', 400);
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { authUserId: userData.authUserId }
      });

      if (existingUser) {
        throw new AppError('User with this auth ID already exists', 409);
      }

      // Create user with optimized query
      const newUser = await prisma.user.create({
        data: {
          authUserId: userData.authUserId,
          username: userData.username,
          bio: userData.bio || '',
          image: userData.image || ''
        },
        select: this.selectFields
      });

      const duration = timer.end();
      
      logger.info('User created successfully', {
        correlationId,
        operation: 'createUser',
        userId: newUser.id,
        duration,
        performance: performance.getMetrics()
      });

      performance.trackOperation('createUser', duration, true);
      return newUser;

    } catch (error) {
      const duration = timer.end();
      performance.trackOperation('createUser', duration, false);
      
      logger.error('Error creating user', {
        correlationId,
        operation: 'createUser',
        error: error.message,
        stack: error.stack,
        duration
      });

      throw error;
    }
  }

  async getAllUsers(options = {}, correlationId) {
    const timer = performance.startTimer();
    
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search } = options;
      
      logger.info('Getting all users', {
        correlationId,
        operation: 'getAllUsers',
        options: { page, limit, sortBy, sortOrder, search }
      });

      // Build query with optimization
      const skip = (page - 1) * limit;
      // MODIFIED WHERE CLAUSE:
      const where = search ? {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
        ]
      } : {};

      const orderBy = { [sortBy]: sortOrder };

      // Use optimized batch query
      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where,
          select: this.selectFields,
          skip,
          take: limit,
          orderBy
        }),
        prisma.user.count({ where })
      ]);

      const duration = timer.end();
      
      logger.info('Users retrieved successfully', {
        correlationId,
        operation: 'getAllUsers',
        count: users.length,
        totalCount,
        duration,
        performance: performance.getMetrics()
      });

      performance.trackOperation('getAllUsers', duration, true);

      return {
        users,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      const duration = timer.end();
      performance.trackOperation('getAllUsers', duration, false);
      
      logger.error('Error getting all users', {
        correlationId,
        operation: 'getAllUsers',
        error: error.message,
        stack: error.stack,
        duration
      });

      throw error;
    }
  }

  async getUserById(authUserId, correlationId) {
    const timer = performance.startTimer();
    
    try {
      logger.info('Getting user by ID', {
        correlationId,
        operation: 'getUserById',
        authUserId
      });

      const user = await prisma.user.findUnique({
        where: { authUserId },
        select: this.selectFields
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }


      const duration = timer.end();
      
      logger.info('User retrieved successfully', {
        correlationId,
        operation: 'getUserById',
        userId: user.id,
        duration,
        performance: performance.getMetrics()
      });

      performance.trackOperation('getUserById', duration, true);
      return user;

    } catch (error) {
      const duration = timer.end();
      performance.trackOperation('getUserById', duration, false);
      
      logger.error('Error getting user by ID', {
        correlationId,
        operation: 'getUserById',
        authUserId,
        error: error.message,
        stack: error.stack,
        duration
      });

      throw error;
    }
  }

  async updateUser(authUserId, userData, correlationId) {
    const timer = performance.startTimer();
    
    try {
      logger.info('Updating user', {
        correlationId,
        operation: 'updateUser',
        authUserId,
        updateFields: Object.keys(userData)
      });

      // Check if user exists
      const existingUser = await this.getUserById(authUserId, correlationId);
      
      // Filter allowed update fields
      const allowedFields = ['username',  'bio', 'image'];
      const updateData = {};
      
      for (const field of allowedFields) {
        if (userData[field] !== undefined) {
          updateData[field] = userData[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new AppError('No valid fields to update', 400);
      }

      updateData.updatedAt = new Date();

      const updatedUser = await prisma.user.update({
        where: { authUserId },
        data: updateData,
        select: this.selectFields
      });

      const duration = timer.end();
      
      logger.info('User updated successfully', {
        correlationId,
        operation: 'updateUser',
        userId: updatedUser.id,
        updatedFields: Object.keys(updateData),
        duration,
        performance: performance.getMetrics()
      });

      performance.trackOperation('updateUser', duration, true);
      return updatedUser;

    } catch (error) {
      const duration = timer.end();
      performance.trackOperation('updateUser', duration, false);
      
      logger.error('Error updating user', {
        correlationId,
        operation: 'updateUser',
        authUserId,
        error: error.message,
        stack: error.stack,
        duration
      });

      throw error;
    }
  }

  async deleteUser(authUserId, correlationId) {
    const timer = performance.startTimer();
    
    try {
      logger.info('Deleting user', {
        correlationId,
        operation: 'deleteUser',
        authUserId
      });

      // Check if user exists
      const existingUser = await this.getUserById(authUserId, correlationId);

      // Soft delete by deactivating
      const deletedUser = await prisma.user.delete({
        where: { authUserId },
        data: {
          updatedAt: new Date()
        },
        select: this.selectFields
      });

      const duration = timer.end();
      
      logger.info('User deleted successfully', {
        correlationId,
        operation: 'deleteUser',
        userId: deletedUser.id,
        duration,
        performance: performance.getMetrics()
      });

      performance.trackOperation('deleteUser', duration, true);
      return deletedUser;

    } catch (error) {
      const duration = timer.end();
      performance.trackOperation('deleteUser', duration, false);
      
      logger.error('Error deleting user', {
        correlationId,
        operation: 'deleteUser',
        authUserId,
        error: error.message,
        stack: error.stack,
        duration
      });

      throw error;
    }
  }

  async getUserStats(correlationId) {
    const timer = performance.startTimer();
    
    try {
      logger.info('Getting user statistics', {
        correlationId,
        operation: 'getUserStats'
      });

      const [totalUsers, activeUsers, inactiveUsers] = await Promise.all([
        prisma.user.count(),
      ]);

      const stats = {
        totalUsers,
        activeUsers,
        inactiveUsers,
        activationRate: totalUsers > 0 ? (activeUsers / totalUsers * 100).toFixed(2) : 0
      };

      const duration = timer.end();
      
      logger.info('User statistics retrieved successfully', {
        correlationId,
        operation: 'getUserStats',
        stats,
        duration,
        performance: performance.getMetrics()
      });

      performance.trackOperation('getUserStats', duration, true);
      return stats;

    } catch (error) {
      const duration = timer.end();
      performance.trackOperation('getUserStats', duration, false);
      
      logger.error('Error getting user statistics', {
        correlationId,
        operation: 'getUserStats',
        error: error.message,
        stack: error.stack,
        duration
      });

      throw error;
    }
  }

  async healthCheck(correlationId) {
    const timer = performance.startTimer();
    
    try {
      logger.info('Performing user service health check', {
        correlationId,
        operation: 'healthCheck'
      });

      // Test database connectivity
      await prisma.user.findFirst({
        select: { id: true }
      });

      const duration = timer.end();
      
      logger.info('User service health check passed', {
        correlationId,
        operation: 'healthCheck',
        duration,
        performance: performance.getMetrics()
      });

      performance.trackOperation('healthCheck', duration, true);
      return { status: 'healthy', timestamp: new Date().toISOString() };

    } catch (error) {
      const duration = timer.end();
      performance.trackOperation('healthCheck', duration, false);
      
      logger.error('User service health check failed', {
        correlationId,
        operation: 'healthCheck',
        error: error.message,
        stack: error.stack,
        duration
      });

      throw new AppError('User service health check failed', 503);
    }
  }
}

export default UserService;