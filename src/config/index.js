import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

/**
 * Centralized Configuration Management
 * Validates and provides typed access to all environment variables
 */
class Configuration {
  constructor() {
    this.initializeConfig();
    this.validateRequiredConfig();
  }

  /**
   * Initialize configuration with defaults and type conversions
   */
  initializeConfig() {
    // Environment
    this.env = process.env.NODE_ENV || 'development';
    this.isDevelopment = this.env === 'development';
    this.isProduction = this.env === 'production';
    this.isTesting = this.env === 'test';

    // Server Configuration
    this.server = {
      port: parseInt(process.env.PORT, 10) || 3000,
      host: process.env.HOST || '0.0.0.0',
      timeout: parseInt(process.env.SERVER_TIMEOUT, 10) || 30000,
      cors: {
        origin: process.env.CORS_ORIGIN ? 
          process.env.CORS_ORIGIN.split(',') : 
          ['http://localhost:3000', 'http://api-gateway:80'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
      },
      bodyParser: {
        limit: process.env.BODY_LIMIT || '10mb'
      }
    };    // Database Configuration
    this.database = {
      url: process.env.DATABASE_URL,
      connectionTimeout: parseInt(process.env.DB_TIMEOUT, 10) || 10000
    };

    // Authentication & Security
    this.auth = {
      jwtSecret: process.env.ACCESS_TOKEN_SECRET,
      jwtExpiry: process.env.JWT_EXPIRY || '24h',
      serviceTokenSecret: process.env.SERVICE_TOKEN_SECRET || 'service-secret'
    };

    // Rate Limiting Configuration
    this.rateLimit = {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 900000, // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
      skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
      skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true',
      standardHeaders: true,
      legacyHeaders: false,
      // Tier-specific limits
      tiers: {
        basic: {
          requests: parseInt(process.env.RATE_LIMIT_BASIC, 10) || 50,
          window: parseInt(process.env.RATE_LIMIT_BASIC_WINDOW, 10) || 900000
        },
        premium: {
          requests: parseInt(process.env.RATE_LIMIT_PREMIUM, 10) || 200,
          window: parseInt(process.env.RATE_LIMIT_PREMIUM_WINDOW, 10) || 900000
        },
        api: {
          requests: parseInt(process.env.RATE_LIMIT_API, 10) || 500,
          window: parseInt(process.env.RATE_LIMIT_API_WINDOW, 10) || 900000
        }
      }
    };

    // Performance Monitoring
    this.performance = {
      enabled: process.env.PERFORMANCE_MONITORING !== 'false',
      slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD, 10) || 1000,
      memoryWarningThreshold: parseInt(process.env.MEMORY_WARNING_THRESHOLD, 10) || 80,
      cpuWarningThreshold: parseInt(process.env.CPU_WARNING_THRESHOLD, 10) || 80,
      metricsRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS, 10) || 30
    };

    // Logging Configuration
    this.logging = {
      level: process.env.LOG_LEVEL || (this.isDevelopment ? 'debug' : 'info'),
      format: process.env.LOG_FORMAT || 'combined',
      enableConsole: process.env.LOG_CONSOLE !== 'false',
      enableFile: process.env.LOG_FILE === 'true',
      filePath: process.env.LOG_FILE_PATH || path.join(__dirname, '../../logs'),
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: parseInt(process.env.LOG_MAX_FILES, 10) || 14,
      enableError: process.env.LOG_ERROR !== 'false',
      enableAccess: process.env.LOG_ACCESS !== 'false',
      enableSecurity: process.env.LOG_SECURITY !== 'false',
      enablePerformance: process.env.LOG_PERFORMANCE !== 'false'
    };

    // Security Configuration
    this.security = {
      helmet: {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"]
          }
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      },
      cors: {
        credentials: true,
        optionsSuccessStatus: 200,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      },
      validation: {
        maxBioLength: parseInt(process.env.MAX_BIO_LENGTH, 10) || 500,
        maxNameLength: parseInt(process.env.MAX_NAME_LENGTH, 10) || 100,
        maxUsernameLength: parseInt(process.env.MAX_USERNAME_LENGTH, 10) || 30
      }
    };

    // External Services
    this.external = {
      authService: {
        url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
        timeout: parseInt(process.env.AUTH_SERVICE_TIMEOUT, 10) || 5000
      }
    };

    // Kafka Configuration
    this.kafka = {
      clientId: process.env.KAFKA_CLIENT_ID || 'user-service',
      brokers: process.env.KAFKA_BROKERS ? 
        process.env.KAFKA_BROKERS.split(',') : 
        ['localhost:9092'],
      groupId: process.env.KAFKA_GROUP_ID || 'user-service-group',
      connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT, 10) || 3000,
      requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT, 10) || 30000
    };

    // Feature Flags
    this.features = {
      enableMetrics: process.env.ENABLE_METRICS !== 'false',
      enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== 'false',
      enableDebugRoutes: process.env.ENABLE_DEBUG_ROUTES === 'true' && this.isDevelopment
    };
  }

  /**
   * Validate required configuration
   */  validateRequiredConfig() {
    const required = [
      'DATABASE_URL',
      'ACCESS_TOKEN_SECRET'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Get configuration for a specific section
   * @param {string} section - Configuration section name
   * @returns {object} Section configuration
   */
  get(section) {
    return this[section] || {};
  }

  /**
   * Check if running in development mode
   * @returns {boolean}
   */
  isDev() {
    return this.isDevelopment;
  }

  /**
   * Check if running in production mode
   * @returns {boolean}
   */
  isProd() {
    return this.isProduction;
  }

  /**
   * Check if running in test mode
   * @returns {boolean}
   */
  isTest() {
    return this.isTesting;
  }
}

// Export singleton instance
const config = new Configuration();

/**
 * Validate configuration on startup
 */
const validateConfig = () => {
  try {
    config.validateRequiredConfig();
    return true;
  } catch (error) {
    throw new Error(`Configuration validation failed: ${error.message}`);
  }
};

export default config;
export { validateConfig };
