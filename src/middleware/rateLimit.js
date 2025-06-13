import rateLimit from 'express-rate-limit';
import AppError from '../utils/appError.js';
import logger from '../config/logger.js';

/**
 * Rate limiting configurations for user-service
 */

// Default configuration
const defaultConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.originalUrl,
      method: req.method
    });
    next(new AppError('Too many requests, please try again later.', 429));
  }
};

// Default rate limit tiers
const defaultTiers = {
  basic: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },
  premium: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500 // limit each IP to 500 requests per windowMs
  }
};

// Get rate limit configuration
const getRateLimitConfig = (tier = 'basic') => {
  const config = defaultTiers[tier] || defaultTiers.basic;
  return {
    ...defaultConfig,
    windowMs: config.windowMs,
    max: config.max
  };
};

// General rate limit for all routes
const generalRateLimit = rateLimit(getRateLimitConfig('basic'));

// Premium rate limit for authenticated users
const premiumRateLimit = rateLimit(getRateLimitConfig('premium'));

// Strict rate limit for sensitive operations
const strictRateLimit = rateLimit({
  ...getRateLimitConfig('basic'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 requests per hour
  message: 'Too many requests from this IP, please try again after an hour'
});

/**
 * Rate limiting for user creation
 */
const createUserRateLimit = rateLimit({
  ...getRateLimitConfig('basic'),
  max: 10, // 10 user creations per window
  message: 'Too many user creation attempts, please try again later.',
    
  handler: (req, res) => {
    logger.warn('User creation rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      correlationId: req.correlationId
    });
        
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: 'Too many user creation attempts. Please try again in 15 minutes.',
      retryAfter: 900, // 15 minutes
      correlationId: req.correlationId
    });
  }
});

/**
 * Moderate rate limiting for user updates
 */
const updateUserRateLimit = rateLimit({
  ...getRateLimitConfig('basic'),
  max: 30, // 30 updates per window
  message: 'Too many update requests, please try again later.',
    
  handler: (req, res) => {
    logger.warn('User update rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      correlationId: req.correlationId
    });
        
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: 'Too many update requests. Please try again later.',
      retryAfter: 900,
      correlationId: req.correlationId
    });
  }
});

/**
 * Rate limiting for search operations
 */
const searchRateLimit = rateLimit({
  ...getRateLimitConfig('basic'),
  max: 100, // 100 searches per window
  message: 'Too many search requests, please try again later.',
    
  keyGenerator: (req) => {
    // More lenient key generation for search (only by IP)
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
    
  handler: (req, res) => {
    logger.warn('Search rate limit exceeded', {
      ip: req.ip,
      searchQuery: req.query.q,
      correlationId: req.correlationId
    });
        
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: 'Too many search requests. Please try again later.',
      retryAfter: 900,
      correlationId: req.correlationId
    });
  }
});

/**
 * Rate limiting for follow/unfollow operations
 */
const followRateLimit = rateLimit({
  ...getRateLimitConfig('basic'),
  max: 50, // 50 follow/unfollow actions per window
  message: 'Too many follow/unfollow requests, please try again later.',
    
  handler: (req, res) => {
    logger.warn('Follow/unfollow rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      action: req.path.includes('follow') ? 'follow' : 'unfollow',
      targetUserId: req.params.id,
      correlationId: req.correlationId
    });
        
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: 'Too many follow/unfollow requests. Please try again in an hour.',
      retryAfter: 3600, // 1 hour
      correlationId: req.correlationId
    });
  }
});

/**
 * Rate limiting for batch operations
 */
const batchRateLimit = rateLimit({
  ...getRateLimitConfig('basic'),
  max: 20, // 20 batch requests per window
  message: 'Too many batch requests, please try again later.',
    
  handler: (req, res) => {
    logger.warn('Batch operation rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      batchSize: req.body?.userIds?.length || 0,
      correlationId: req.correlationId
    });
        
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: 'Too many batch requests. Please try again later.',
      retryAfter: 900,
      correlationId: req.correlationId
    });
  }
});

/**
 * Flexible rate limiter factory
 */
const createRateLimit = (type) => {
  const configs = {
    general: {
      max: getRateLimitConfig('basic').max,
      windowMs: getRateLimitConfig('basic').windowMs,
      message: 'Rate limit exceeded'
    },
    premium: {
      max: getRateLimitConfig('premium').max,
      windowMs: getRateLimitConfig('premium').windowMs,
      message: 'Premium rate limit exceeded'
    },
    api: {
      max: config.rateLimit.tiers.api.requests,
      windowMs: config.rateLimit.tiers.api.window,
      message: 'API rate limit exceeded'
    },
    strict: {
      max: 20,
      windowMs: 15 * 60 * 1000,
      message: 'Strict rate limit exceeded'
    }
  };

  const limitConfig = configs[type] || configs.general;

  return rateLimit({
    ...defaultConfig,
    ...limitConfig,
        
    handler: (req, res) => {
      logger.warn(`${type} rate limit exceeded`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        correlationId: req.correlationId
      });
            
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: limitConfig.message,
        retryAfter: Math.ceil(limitConfig.windowMs / 1000),
        correlationId: req.correlationId
      });
    }
  });
};

/**
 * Progressive rate limiting based on user behavior
 */
const progressiveRateLimit = (req, res, next) => {
  const ip = req.ip;
  const userAgent = req.get('User-Agent') || '';
    
  // Implement progressive rate limiting logic
  // This could be enhanced with a cache/database to track user behavior
    
  // For now, apply stricter limits to suspicious user agents
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i
  ];
    
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
    
  if (isSuspicious) {
    logger.info('Applying progressive rate limiting for suspicious user agent', {
      ip,
      userAgent,
      correlationId: req.correlationId
    });
        
    // Apply stricter rate limiting
    const strictLimit = createRateLimit('strict');
    return strictLimit(req, res, next);
  }
    
  next();
};

/**
 * Custom middleware to track rate limit metrics
 */
const rateLimitMetrics = (req, res, next) => {
  // Add rate limit headers info to response for monitoring
  const originalJson = res.json;
    
  res.json = function(data) {
    // Add rate limit info if available
    if (res.get('X-RateLimit-Limit') && res.get('X-RateLimit-Remaining')) {
      logger.debug('Rate limit status', {
        limit: res.get('X-RateLimit-Limit'),
        remaining: res.get('X-RateLimit-Remaining'),
        reset: res.get('X-RateLimit-Reset'),
        ip: req.ip,
        correlationId: req.correlationId
      });
    }
        
    return originalJson.call(this, data);
  };
    
  next();
};

export {
  generalRateLimit,
  createUserRateLimit,
  updateUserRateLimit,
  searchRateLimit,
  followRateLimit,
  batchRateLimit,
  createRateLimit,
  progressiveRateLimit,
  rateLimitMetrics,
  strictRateLimit
};
