const config = require('../src/config');
const logger = require('../src/config/logger');
const performance = require('../src/utils/performance');

/**
 * Performance monitoring script
 * Monitors key performance metrics and alerts on thresholds
 */
class PerformanceMonitor {
  constructor() {
    this.monitoringInterval = 30000; // 30 seconds
    this.alertThresholds = {
      memoryUsage: 80, // 80% of available memory
      responseTime: 1000, // 1 second
      errorRate: 5, // 5% error rate
      requestRate: 1000 // 1000 requests per minute
    };
  }

  start() {
    logger.info('Starting performance monitoring', {
      component: 'PerformanceMonitor',
      interval: this.monitoringInterval,
      thresholds: this.alertThresholds
    });

    setInterval(() => {
      this.checkMetrics();
    }, this.monitoringInterval);
  }

  checkMetrics() {
    const metrics = performance.getMetrics();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Memory usage check
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > this.alertThresholds.memoryUsage) {
      logger.warn('High memory usage detected', {
        component: 'PerformanceMonitor',
        memoryUsagePercent: memoryUsagePercent.toFixed(2),
        threshold: this.alertThresholds.memoryUsage,
        memoryUsage
      });
    }

    // Response time check
    if (metrics.averageResponseTime > this.alertThresholds.responseTime) {
      logger.warn('High response time detected', {
        component: 'PerformanceMonitor',
        averageResponseTime: metrics.averageResponseTime,
        threshold: this.alertThresholds.responseTime,
        slowestEndpoint: metrics.slowestEndpoint
      });
    }

    // Error rate check
    if (metrics.errorRate > this.alertThresholds.errorRate) {
      logger.warn('High error rate detected', {
        component: 'PerformanceMonitor',
        errorRate: metrics.errorRate,
        threshold: this.alertThresholds.errorRate,
        totalErrors: metrics.totalErrors
      });
    }

    // Log current metrics
    logger.info('Performance metrics', {
      component: 'PerformanceMonitor',
      metrics: {
        uptime: process.uptime(),
        memory: {
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
          usagePercent: memoryUsagePercent.toFixed(2)
        },
        performance: metrics,
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      }
    });
  }

  stop() {
    logger.info('Stopping performance monitoring', {
      component: 'PerformanceMonitor'
    });
  }
}

// Start monitoring if this script is run directly
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  monitor.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });
}

module.exports = PerformanceMonitor;
