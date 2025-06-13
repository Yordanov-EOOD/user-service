import winston from 'winston';
import config from './index.js';

/**
 * Enhanced logging configuration with correlation support
 */

// Custom log format for user service
const userServiceFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, correlationId, service, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      service: service || 'user-service',
      correlationId,
      ...meta
    };
    
    return JSON.stringify(logEntry);
  })
);

// Development format with colors
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    const corrId = correlationId ? `[${correlationId}]` : '';
    return `${timestamp} ${level} ${corrId}: ${message} ${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: config.isDevelopment ? devFormat : userServiceFormat,
  defaultMeta: { service: 'user-service' },
  transports: []
});

// Console transport
if (config.logging.enableConsole) {
  logger.add(new winston.transports.Console({
    handleExceptions: true,
    handleRejections: true
  }));
}

// File transport (if enabled)
if (config.logging.enableFile) {
  logger.add(new winston.transports.File({
    filename: `${config.logging.filePath}/user-service.log`,
    maxsize: config.logging.maxSize,
    maxFiles: config.logging.maxFiles,
    format: userServiceFormat
  }));

  // Error log file
  if (config.logging.enableError) {
    logger.add(new winston.transports.File({
      filename: `${config.logging.filePath}/user-service-error.log`,
      level: 'error',
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      format: userServiceFormat
    }));
  }
}

/**
 * Request ID middleware for correlation tracking
 */
export const addRequestId = (req, res, next) => {
  const correlationId = req.get('X-Correlation-ID') || 
                       `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
};

/**
 * Request logging middleware
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log incoming request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    correlationId: req.correlationId
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      correlationId: req.correlationId
    });

    // Log slow requests
    if (duration > config.performance.slowQueryThreshold) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration,
        correlationId: req.correlationId
      });
    }

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Morgan stream for access logs
 */
logger.getMorganStream = function() {
  return {
    write: function(message) {
      logger.info(message.trim());
    }
  };
};

/**
 * Create child logger with additional context
 */
logger.createChild = function(meta) {
  return logger.child(meta);
};

export { logger };
export default logger;
