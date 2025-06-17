import { PrismaClient } from '@prisma/client';
import config from './index.js';
import logger from './logger.js';

// Connection pooling configuration for Prisma
const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: config.database.url
      }
    },    // Enhanced logging configuration - only log queries in development
    log: process.env.NODE_ENV === 'development' 
      ? [
          {
            emit: 'event',
            level: 'query',
          },
          {
            emit: 'event',
            level: 'error',
          },
          {
            emit: 'event',
            level: 'info',
          },
          {
            emit: 'event',
            level: 'warn',
          },
        ]
      : [
          {
            emit: 'event',
            level: 'error',
          },
          {
            emit: 'event',
            level: 'warn',
          },
        ],
    // Connection pooling settings
    __internal: {
      engine: {
        // Configure connection pooling
        connectionLimit: parseInt(process.env.PRISMA_CONNECTION_LIMIT || '10'),
        // Higher value for more frequent pool checks
        activeTimeoutMs: parseInt(process.env.PRISMA_ACTIVE_TIMEOUT_MS || '300000'), // 5 minutes
        // Higher value for more time to hold connections in pool before closing
        idleTimeoutMs: parseInt(process.env.PRISMA_IDLE_TIMEOUT_MS || '60000'), // 1 minute        // Higher value gives more time for long-running transactions
        transactionTimeoutMs: parseInt(process.env.PRISMA_TRANSACTION_TIMEOUT_MS || '5000')
      }
    }
  });
};

// Global singleton instance
const globalForPrisma = globalThis || global;

// Ensure we only create one instance in development
const prisma = globalForPrisma.prisma || prismaClientSingleton();

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}

// Enhanced logging with Winston
prisma.$on('query', (e) => {
  if (config.isDevelopment) {
    logger.debug('Database Query', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
      timestamp: e.timestamp
    });
  }
  
  // Log slow queries
  if (e.duration > config.performance.slowQueryThreshold) {
    logger.warn('Slow Query Detected', {
      query: e.query,
      duration: `${e.duration}ms`,
      threshold: `${config.performance.slowQueryThreshold}ms`,
      timestamp: e.timestamp
    });
  }
});

prisma.$on('error', (e) => {
  logger.error('Database Error', {
    target: e.target,
    message: e.message,
    timestamp: e.timestamp
  });
});

prisma.$on('warn', (e) => {
  logger.warn('Database Warning', {
    target: e.target,
    message: e.message,
    timestamp: e.timestamp
  });
});

prisma.$on('info', (e) => {
  logger.info('Database Info', {
    target: e.target,
    message: e.message,
    timestamp: e.timestamp
  });
});

// Graceful shutdown handler
const gracefulShutdown = async () => {
  logger.info('Disconnecting from database...');
  await prisma.$disconnect();
  logger.info('Database disconnected successfully');
};

// Handle process termination
process.on('beforeExit', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);


// Handle connection issues
prisma.$on('error', (e) => {
  console.error('Prisma Client error:', e);
});

// Add connection management
process.on('SIGINT', async () => {
  console.log('Received SIGINT - Closing Prisma connections');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM - Closing Prisma connections');
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;