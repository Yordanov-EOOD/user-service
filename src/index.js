import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import crypto from 'crypto';

// Import configuration and utilities
import config from './config/index.js';
import logger from './config/logger.js';
import performance from './utils/performance.js';
import { initKafka } from './config/kafkaInit.js';

// Import middleware
import * as security from './middleware/security.js';
import * as rateLimit from './middleware/rateLimit.js';
import { globalErrorHandler, notFound, catchAsync } from './middleware/errorHandler.js';
import { metricsMiddleware, metricsHandler } from './middleware/metrics.js';

// Import routes
import userRoute from './route/userRoute.js';

const app = express();

// Set trust proxy for proper IP forwarding
app.set('trust proxy', 1);

initKafka();

// Performance monitoring middleware
app.use((req, res, next) => {
  req.correlationId = crypto.randomUUID();
  req.startTime = performance.now();
  
  // Log request
  logger.info('Incoming request', {
    correlationId: req.correlationId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Track response
  res.on('finish', () => {
    const duration = performance.now() - req.startTime;
    performance.trackEndpoint(req.method, req.route?.path || req.path, duration, res.statusCode);
    
    logger.info('Request completed', {
      correlationId: req.correlationId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('Content-Length')
    });
  });
  
  next();
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: config.env === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression({
  level: 6,
  threshold: 1024
}));

// Request logging
if (config.env !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim(), { component: 'morgan' })
    }
  }));
}

// CORS configuration
app.use(cors({
  origin: config.server.cors.origin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Correlation-ID',
    'X-Forwarded-For',
    'X-Real-IP'
  ],
  credentials: true,
  maxAge: 86400 // 24 hours preflight cache
}));

// Body parsing middleware with security
app.use(express.json({ 
  limit: config.server.bodyParser.limit,
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: config.server.bodyParser.limit 
}));

// Apply global security middleware
app.use(security.ipFilter);
app.use(security.sanitizeInput);
app.use(security.validateUserAgent);

// Add metrics middleware
app.use(metricsMiddleware);

// Health check endpoints (no authentication required)
app.get('/health', catchAsync(async (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
    version: process.env.npm_package_version || '1.0.0',
    correlationId: req.correlationId
  };
  
  res.status(200).json(healthCheck);
}));

app.get('/health/detailed', catchAsync(async (req, res) => {
  const metrics = performance.getMetrics();
  const memoryUsage = process.memoryUsage();
  
  const detailedHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
    version: process.env.npm_package_version || '1.0.0',
    metrics: {
      performance: metrics,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
      }
    },
    correlationId: req.correlationId
  };
    res.status(200).json(detailedHealth);
}));

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// API routes with rate limiting and authentication
app.use('/users', rateLimit.generalRateLimit, userRoute);

// Internal routes (for service-to-service communication)
// TODO: Add service authentication middleware when available
app.use('/internal/users', rateLimit.strictRateLimit, userRoute);

// Catch-all for undefined routes
app.all('*', notFound);

// Global error handling middleware
app.use(globalErrorHandler);

// Graceful shutdown handling
const server = app.listen(config.server.port, () => {
  logger.info('User Service started successfully', {
    port: config.server.port,
    environment: config.env,
    pid: process.pid,
    features: config.features
  });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown`, {
    signal,
    pid: process.pid
  });
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown', { error: err.message });
      process.exit(1);
    }
    
    logger.info('Server closed successfully');
    
    // Close database connections if needed
    // TODO: Add Prisma disconnect when available
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack,
    pid: process.pid
  });
  gracefulShutdown('uncaughtException');
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason,
    promise: promise,
    pid: process.pid
  });  gracefulShutdown('unhandledRejection');
});

export default app;