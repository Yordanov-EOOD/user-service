const axios = require('axios');
const config = require('../src/config');
const logger = require('../src/config/logger');

/**
 * Health check script for monitoring service health
 */
class HealthChecker {
  constructor() {
    this.serviceUrl = `http://localhost:${config.server.port}`;
    this.checkInterval = 60000; // 1 minute
    this.endpoints = [
      '/health',
      '/health/detailed',
      '/api/users/health'
    ];
    this.consecutiveFailures = 0;
    this.maxConsecutiveFailures = 3;
  }

  async start() {
    logger.info('Starting health monitoring', {
      component: 'HealthChecker',
      serviceUrl: this.serviceUrl,
      interval: this.checkInterval,
      endpoints: this.endpoints
    });

    // Initial health check
    await this.performHealthCheck();

    // Set up recurring health checks
    setInterval(async () => {
      await this.performHealthCheck();
    }, this.checkInterval);
  }

  async performHealthCheck() {
    logger.info('Performing health check', {
      component: 'HealthChecker',
      timestamp: new Date().toISOString()
    });

    const results = await Promise.allSettled(
      this.endpoints.map(endpoint => this.checkEndpoint(endpoint))
    );

    const healthStatus = {
      timestamp: new Date().toISOString(),
      overallStatus: 'healthy',
      endpoints: {}
    };

    let hasFailures = false;

    results.forEach((result, index) => {
      const endpoint = this.endpoints[index];
      
      if (result.status === 'fulfilled') {
        healthStatus.endpoints[endpoint] = {
          status: 'healthy',
          responseTime: result.value.responseTime,
          statusCode: result.value.statusCode
        };
      } else {
        hasFailures = true;
        healthStatus.endpoints[endpoint] = {
          status: 'unhealthy',
          error: result.reason.message
        };
      }
    });

    if (hasFailures) {
      this.consecutiveFailures++;
      healthStatus.overallStatus = 'unhealthy';
      
      logger.warn('Health check failed', {
        component: 'HealthChecker',
        consecutiveFailures: this.consecutiveFailures,
        healthStatus
      });

      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        logger.error('Critical: Service appears to be down', {
          component: 'HealthChecker',
          consecutiveFailures: this.consecutiveFailures,
          maxFailures: this.maxConsecutiveFailures,
          healthStatus
        });
      }
    } else {
      this.consecutiveFailures = 0;
      logger.info('Health check passed', {
        component: 'HealthChecker',
        healthStatus
      });
    }

    return healthStatus;
  }

  async checkEndpoint(endpoint) {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${this.serviceUrl}${endpoint}`, {
        timeout: 10000,
        validateStatus: (status) => status < 500 // Accept 4xx as valid responses
      });

      const responseTime = Date.now() - startTime;

      return {
        statusCode: response.status,
        responseTime,
        data: response.data
      };
    } catch (error) {
      throw new Error(`Health check failed for ${endpoint}: ${error.message}`);
    }
  }

  async checkDependencies() {
    logger.info('Checking service dependencies', {
      component: 'HealthChecker'
    });

    const dependencies = {
      database: await this.checkDatabase(),
      // TODO: Add other dependencies (Redis, Kafka, etc.)
    };

    return dependencies;
  }

  async checkDatabase() {
    try {
      // This would typically ping the database
      // For now, we'll check if the service can connect
      const response = await this.checkEndpoint('/api/users/health');
      return {
        status: 'healthy',
        responseTime: response.responseTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  stop() {
    logger.info('Stopping health monitoring', {
      component: 'HealthChecker'
    });
  }
}

// Start monitoring if this script is run directly
if (require.main === module) {
  const healthChecker = new HealthChecker();
  healthChecker.start().catch(error => {
    logger.error('Failed to start health monitoring', {
      component: 'HealthChecker',
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    healthChecker.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    healthChecker.stop();
    process.exit(0);
  });
}

module.exports = HealthChecker;
