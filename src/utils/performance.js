/**
 * Performance monitoring utilities for user-service
 * Provides request tracking and metrics collection
 */

import { performance as perfHooks } from 'perf_hooks';
import logger from '../config/logger.js';

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      totalErrors: 0,
      totalResponseTime: 0,
      slowRequests: 0,
      errors: 0, // This seems to be the same as totalErrors, consider consolidating
      endpointMetrics: new Map(),
      operationMetrics: new Map() // For custom internal operations
    };
    this.requestMap = new Map(); // Tracks active requests
  }

  /**
     * Get current time in milliseconds using high-resolution timer.
     * @returns {number} Current time in milliseconds.
     */
  now() {
    return Number(process.hrtime.bigint() / 1000000n); // Convert nanoseconds to milliseconds
  }

  /**
     * Start tracking a request
     * @param {string} requestId - Unique ID for the request.
     * @param {object} requestDetails - Details about the request (e.g., endpoint, method).
     */
  startRequest(requestId, requestDetails) {
    if (!requestId) {
      logger.warn('Attempted to start request tracking without a requestId.');
      return;
    }
    this.requestMap.set(requestId, {
      startTime: this.now(),
      request: requestDetails
    });
    logger.debug(`Request tracking started: ${requestId}`, { requestDetails });
  }

  /**
     * Calculate response time.
     * @param {number} startTime - The start time of the request in milliseconds.
     * @returns {number} Duration in milliseconds.
     */
  calculateResponseTime(startTime) {
    return this.now() - startTime;
  }

  /**
     * End tracking a request and collect metrics
     * @param {string} requestId - Unique ID for the request.
     * @param {object} response - The Express response object.
     */
  endRequest(requestId, response) {
    const requestData = this.requestMap.get(requestId);
    if (!requestData) {
      logger.warn('Request not found in tracking map for endRequest', { requestId });
      return;
    }

    const duration = this.calculateResponseTime(requestData.startTime);
    const { endpoint, method } = requestData.request;

    // Update general metrics
    this.metrics.totalRequests++;
    this.metrics.totalResponseTime += duration;

    // Track endpoint-specific metrics
    const endpointKey = `${method} ${endpoint}`;
    const endpointStats = this.metrics.endpointMetrics.get(endpointKey) || {
      count: 0,
      totalTime: 0,
      errors: 0
    };
    endpointStats.count++;
    endpointStats.totalTime += duration;
    this.metrics.endpointMetrics.set(endpointKey, endpointStats);

    // Track slow requests
    if (duration > 1000) { // Configurable threshold, e.g., 1 second
      this.metrics.slowRequests++;
      logger.warn('Slow request detected', {
        requestId,
        duration,
        endpoint,
        method
      });
    }

    // Track errors based on status code
    if (response.statusCode >= 400) {
      this.metrics.errors++; // General error count
      endpointStats.errors++; // Endpoint-specific error count
      logger.error('Request error occurred', {
        requestId,
        statusCode: response.statusCode,
        endpoint,
        method
      });
    }

    this.requestMap.delete(requestId); // Clean up tracked request
    logger.debug(`Request tracking ended: ${requestId}`, { duration });
  }

  /**
     * Records metrics for a specific internal operation.
     * @param {string} operationName - The name of the operation (e.g., 'createUserDB', 'validateInput').
     * @param {number} durationMs - The duration of the operation in milliseconds.
     * @param {boolean} success - Whether the operation was successful.
     */
  recordOperationMetric(operationName, durationMs, success) {
    if (typeof operationName !== 'string' || operationName.trim() === '') {
      logger.warn('Invalid operationName for recordOperationMetric');
      return;
    }
    if (typeof durationMs !== 'number' || durationMs < 0) {
      logger.warn(`Invalid durationMs for operation ${operationName}`);
      return;
    }

    const opKey = operationName;
    let opMetrics = this.metrics.operationMetrics.get(opKey);

    if (!opMetrics) {
      opMetrics = {
        count: 0,
        totalDuration: 0,
        successCount: 0,
        failureCount: 0,
      };
      this.metrics.operationMetrics.set(opKey, opMetrics);
    }

    opMetrics.count++;
    opMetrics.totalDuration += durationMs;
    if (success) {
      opMetrics.successCount++;
    } else {
      opMetrics.failureCount++;
    }
    logger.debug(`Operation metric recorded: ${operationName}`, { durationMs, success, currentMetrics: opMetrics });
  }


  /**
     * Get current aggregated performance metrics.
     * @returns {object} Object containing performance metrics.
     */
  getPerformanceMetrics() {
    const averageResponseTime = this.metrics.totalRequests > 0
      ? this.metrics.totalResponseTime / this.metrics.totalRequests
      : 0;

    // Convert Map to object for easier consumption/serialization
    const endpointMetricsObj = {};
    this.metrics.endpointMetrics.forEach((value, key) => {
      endpointMetricsObj[key] = {
        ...value,
        averageTime: value.count > 0 ? value.totalTime / value.count : 0
      };
    });

    const operationMetricsObj = {};
    this.metrics.operationMetrics.forEach((value, key) => {
      operationMetricsObj[key] = {
        ...value,
        averageDuration: value.count > 0 ? value.totalDuration / value.count : 0
      };
    });

    return {
      totalRequests: this.metrics.totalRequests,
      totalErrors: this.metrics.errors, // Using this.metrics.errors
      averageResponseTime: parseFloat(averageResponseTime.toFixed(2)),
      slowRequests: this.metrics.slowRequests,
      activeRequests: this.requestMap.size,
      endpointMetrics: endpointMetricsObj,
      operationMetrics: operationMetricsObj
    };
  }

  /**
     * Tracks metrics for a specific endpoint (primarily count).
     * This might be redundant if endRequest handles endpoint metrics comprehensively.
     * @param {string} endpoint - The endpoint path.
     * @param {string} method - The HTTP method.
     */
  trackEndpointMetrics(endpoint, method) { // Note: duration and statusCode are not used here
    const key = `${method} ${endpoint}`;
    const metrics = this.metrics.endpointMetrics.get(key) || { count: 0, totalTime: 0, errors: 0 };
    metrics.count++;
    this.metrics.endpointMetrics.set(key, metrics);
    logger.debug(`Endpoint hit tracked (manual): ${key}`);
  }


  /**
     * Get system health indicators based on current metrics.
     * @returns {object} Health status and any identified issues.
     */
  getHealthIndicators() {
    const metrics = this.getPerformanceMetrics(); // Use the method that returns all metrics
    const indicators = {
      healthy: true,
      issues: []
    };

    const errorRate = metrics.totalRequests > 0
      ? (metrics.totalErrors / metrics.totalRequests) * 100
      : 0;

    const slowRequestPercentage = metrics.totalRequests > 0
      ? (metrics.slowRequests / metrics.totalRequests) * 100
      : 0;

    if (errorRate > 10) { // Configurable threshold
      indicators.healthy = false;
      indicators.issues.push(`High error rate: ${errorRate.toFixed(1)}%`);
    }

    if (slowRequestPercentage > 20) { // Configurable threshold
      indicators.healthy = false;
      indicators.issues.push(`High slow request rate: ${slowRequestPercentage.toFixed(1)}%`);
    }

    if (metrics.activeRequests > 50) { // Configurable threshold
      indicators.healthy = false;
      indicators.issues.push(`High active request backlog: ${metrics.activeRequests}`);
    }

    return indicators;
  }
}

// Export singleton instance
const performanceMonitor = new PerformanceMonitor();

/**
 * Performance middleware for Express request tracking.
 * This middleware should be added early in your Express app setup.
 */
const performanceMiddleware = (req, res, next) => {
  // Use correlation ID from request if available, otherwise generate one
  const requestId = req.correlationId || req.headers['x-correlation-id'] || `req_${performanceMonitor.now()}_${Math.random().toString(36).substring(2, 11)}`;
  // Attach requestId to the request object if not already present, for downstream use
  if (!req.correlationId) req.correlationId = requestId;
  if (!req.id) req.id = requestId; // Common alias

  const endpoint = req.route?.path || req.originalUrl || req.path; // req.originalUrl is often more complete
  const method = req.method;
  const userAgent = req.get('User-Agent') || 'unknown';

  performanceMonitor.startRequest(requestId, {
    endpoint,
    method,
    userAgent
  });

  const originalEnd = res.end;
  res.end = function interceptEnd(chunk, encoding) {
    // Ensure 'this' refers to the response object
    performanceMonitor.endRequest(requestId, this);
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

export default {
  PerformanceMonitor, // Export class for potential extension or direct instantiation if needed
  performanceMonitor, // Export singleton instance
  performanceMiddleware,
  startTimer: () => { // A more functional timer
    const startTime = performanceMonitor.now();
    return {
      end: () => performanceMonitor.now() - startTime
    };
  },
  // This trackEndpoint is somewhat redundant if performanceMiddleware and endRequest are used,
  // but kept for compatibility if it's called directly elsewhere.
  trackEndpoint: (method, path, duration, statusCode) => { // duration and statusCode are not used by current trackEndpointMetrics
    performanceMonitor.trackEndpointMetrics(path, method);
  },
  getMetrics: () => performanceMonitor.getPerformanceMetrics(),
  now: () => performanceMonitor.now(),
  trackOperation: (operationName, duration, success) => {
    performanceMonitor.recordOperationMetric(operationName, duration, success);
  }
};
