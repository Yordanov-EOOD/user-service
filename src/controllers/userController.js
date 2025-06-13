import UserService from '../services/userService.js';
import logger from '../config/logger.js';
import performance from '../utils/performance.js';
import { catchAsync, AppError } from '../middleware/errorHandler.js';
import config from '../config/index.js';

// Create an instance of UserService
const userService = new UserService();

class UserController {
  constructor() {
    // Bind methods to ensure proper 'this' context when used as route handlers
    this.createUser = catchAsync(this.createUser.bind(this));
    this.getAllUsers = catchAsync(this.getAllUsers.bind(this));
    this.getUserById = catchAsync(this.getUserById.bind(this));
    this.updateUser = catchAsync(this.updateUser.bind(this));
    this.deleteUser = catchAsync(this.deleteUser.bind(this));
    this.getUserStats = catchAsync(this.getUserStats.bind(this));
    this.healthCheck = catchAsync(this.healthCheck.bind(this));
  }

  async createUser(req, res) {
    const correlationId = req.correlationId;
    const timer = performance.startTimer();
    
    logger.info('Create user request received', {
      correlationId,
      operation: 'createUser',
      body: { username: req.body.username, email: req.body.email }
    });

    const userData = {
      authUserId: req.body.authUserId,
      username: req.body.username,
      email: req.body.email,
      bio: req.body.bio,
      image: req.body.image
    };

    const user = await userService.createUser(userData, correlationId);

    // Publish event if Kafka is available
    if (config.features.kafkaEnabled) {
      try {
        // TODO: Implement Kafka publishing
        logger.info('User created event would be published to Kafka', {
          correlationId,
          userId: user.id,
          authUserId: user.authUserId
        });
      } catch (kafkaError) {
        logger.warn('Failed to publish user created event', {
          correlationId,
          error: kafkaError.message,
          userId: user.id
        });
      }
    }

    const duration = timer.end();
    performance.trackEndpoint(req.method, (req.route && req.route.path) || req.path || req.url, duration, 201);

    logger.info('User created successfully', {
      correlationId,
      operation: 'createUser',
      userId: user.id,
      duration
    });

    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      data: { user },
      correlationId,
      timestamp: new Date().toISOString()
    });
  }

  async getAllUsers(req, res) {
    const correlationId = req.correlationId;
    const timer = performance.startTimer();
    
    logger.info('Get all users request received', {
      correlationId,
      operation: 'getAllUsers',
      query: req.query
    });

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 10, 100), // Max 100 per page
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'desc',
      search: req.query.search
    };

    const result = await userService.getAllUsers(options, correlationId);

    const duration = timer.end();
    performance.trackEndpoint(req.method, (req.route && req.route.path) || req.path || req.url, duration, 200);

    logger.info('Users retrieved successfully', {
      correlationId,
      operation: 'getAllUsers',
      count: result.users.length,
      totalCount: result.pagination.totalCount,
      duration
    });

    res.status(200).json({
      status: 'success',
      message: 'Users retrieved successfully',
      data: result,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }

  async getUserById(req, res) {
    const correlationId = req.correlationId;
    const timer = performance.startTimer();
    const { id: authUserId } = req.params;
    
    logger.info('Get user by ID request received', {
      correlationId,
      operation: 'getUserById',
      authUserId
    });

    const user = await userService.getUserById(authUserId, correlationId);

    const duration = timer.end();
    performance.trackEndpoint(req.method, (req.route && req.route.path) || req.path || req.url, duration, 200);

    logger.info('User retrieved successfully', {
      correlationId,
      operation: 'getUserById',
      userId: user.id,
      duration
    });

    res.status(200).json({
      status: 'success',
      message: 'User retrieved successfully',
      data: { user },
      correlationId,
      timestamp: new Date().toISOString()
    });
  }

  async updateUser(req, res) {
    const correlationId = req.correlationId;
    const timer = performance.startTimer();
    const { id: authUserId } = req.params;
    
    logger.info('Update user request received', {
      correlationId,
      operation: 'updateUser',
      authUserId,
      updateFields: Object.keys(req.body)
    });

    const userData = {
      username: req.body.username,
      email: req.body.email,
      bio: req.body.bio,
      image: req.body.image
    };

    const user = await userService.updateUser(authUserId, userData, correlationId);

    // Publish event if Kafka is available
    if (config.features.kafkaEnabled) {
      try {
        // TODO: Implement Kafka publishing
        logger.info('User updated event would be published to Kafka', {
          correlationId,
          userId: user.id,
          authUserId: user.authUserId,
          updatedFields: Object.keys(userData).filter(key => userData[key] !== undefined)
        });
      } catch (kafkaError) {
        logger.warn('Failed to publish user updated event', {
          correlationId,
          error: kafkaError.message,
          userId: user.id
        });
      }
    }

    const duration = timer.end();
    performance.trackEndpoint(req.method, (req.route && req.route.path) || req.path || req.url, duration, 200);

    logger.info('User updated successfully', {
      correlationId,
      operation: 'updateUser',
      userId: user.id,
      duration
    });

    res.status(200).json({
      status: 'success',
      message: 'User updated successfully',
      data: { user },
      correlationId,
      timestamp: new Date().toISOString()
    });
  }

  async deleteUser(req, res) {
    const correlationId = req.correlationId;
    const timer = performance.startTimer();
    const { id: authUserId } = req.params;
    
    logger.info('Delete user request received', {
      correlationId,
      operation: 'deleteUser',
      authUserId
    });

    const user = await userService.deleteUser(authUserId, correlationId);

    // Publish event if Kafka is available
    if (config.features.kafkaEnabled) {
      try {
        // TODO: Implement Kafka publishing
        logger.info('User deleted event would be published to Kafka', {
          correlationId,
          userId: user.id,
          authUserId: user.authUserId
        });
      } catch (kafkaError) {
        logger.warn('Failed to publish user deleted event', {
          correlationId,
          error: kafkaError.message,
          userId: user.id
        });
      }
    }

    const duration = timer.end();
    performance.trackEndpoint(req.method, (req.route && req.route.path) || req.path || req.url, duration, 200);

    logger.info('User deleted successfully', {
      correlationId,
      operation: 'deleteUser',
      userId: user.id,
      duration
    });

    res.status(200).json({
      status: 'success',
      message: 'User deleted successfully',
      data: { user },
      correlationId,
      timestamp: new Date().toISOString()
    });
  }

  async getUserStats(req, res) {
    const correlationId = req.correlationId;
    const timer = performance.startTimer();
    
    logger.info('Get user stats request received', {
      correlationId,
      operation: 'getUserStats'
    });

    const stats = await userService.getUserStats(correlationId);

    const duration = timer.end();
    performance.trackEndpoint(req.method, (req.route && req.route.path) || req.path || req.url, duration, 200);

    logger.info('User statistics retrieved successfully', {
      correlationId,
      operation: 'getUserStats',
      stats,
      duration
    });

    res.status(200).json({
      status: 'success',
      message: 'User statistics retrieved successfully',
      data: { stats },
      correlationId,
      timestamp: new Date().toISOString()
    });
  }

  async healthCheck(req, res) {
    const correlationId = req.correlationId;
    const timer = performance.startTimer();
    
    logger.info('User service health check request received', {
      correlationId,
      operation: 'healthCheck'
    });

    const healthStatus = await userService.healthCheck(correlationId);
    const systemMetrics = performance.getMetrics();

    const duration = timer.end();
    performance.trackEndpoint(req.method, (req.route && req.route.path) || req.path || req.url, duration, 200);

    logger.info('User service health check completed', {
      correlationId,
      operation: 'healthCheck',
      status: healthStatus.status,
      duration
    });

    res.status(200).json({
      status: 'success',
      message: 'User service is healthy',
      data: {
        service: healthStatus,
        metrics: systemMetrics,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      },
      correlationId
    });
  }
}

export default new UserController();
