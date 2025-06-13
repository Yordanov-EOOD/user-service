/**
 * Security middleware for user-service
 * Provides comprehensive security headers and protection
 */

import helmet from 'helmet';
import logger from '../config/logger.js';
import config from '../config/index.js';
import AppError from '../utils/appError.js';
import xss from 'xss';
import mongoSanitize from 'express-mongo-sanitize';

// Content Security Policy configuration
const cspConfig = {
  directives: {
    defaultSrc: ['\'self\''],
    styleSrc: ['\'self\'', '\'unsafe-inline\''],
    scriptSrc: ['\'self\''],
    imgSrc: ['\'self\'', 'data:', 'https:'],
    connectSrc: ['\'self\''],
    frameSrc: ['\'none\''],
    objectSrc: ['\'none\'']
  },
  reportOnly: config.isDevelopment
};

// Helmet configuration for user service
const helmetConfig = {
  contentSecurityPolicy: cspConfig,
  crossOriginEmbedderPolicy: false, // Allow embedding for development
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
};

/**
 * Main security headers middleware
 */
const securityHeaders = helmet(helmetConfig);

/**
 * Additional API security middleware
 */
const apiSecurity = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
    
  // Add custom security headers
  res.setHeader('X-Service', 'user-service');
  res.setHeader('X-Request-ID', req.correlationId || 'unknown');
    
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
    
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
    
  next();
};

/**
 * Enhanced security for sensitive endpoints
 */
const sensitiveEndpointSecurity = (req, res, next) => {
  // Extra strict headers for sensitive operations
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
    
  next();
};

/**
 * Input sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          req.body[key] = xss(req.body[key].trim());
        }
      });
    }

    // Sanitize query parameters
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
          req.query[key] = xss(req.query[key].trim());
        }
      });
    }

    next();
  } catch (error) {
    logger.error('Input sanitization failed', { error });
    next(new AppError('Input sanitization failed', 400));
  }
};

/**
 * Request size limiter
 */
const requestSizeLimiter = (req, res, next) => {
  const maxSize = 1024 * 1024; // 1MB
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    return next(new AppError('Request entity too large', 413));
  }
  next();
};

/**
 * IP filtering middleware
 */
const ipFilter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
    
  // Blacklisted IPs (could be loaded from database or config)
  const blacklistedIPs = (process.env.BLACKLISTED_IPS || '').split(',').filter(Boolean);
    
  if (blacklistedIPs.includes(ip)) {
    logger.warn('Blocked IP access attempt', {
      ip,
      correlationId: req.correlationId,
      url: req.url
    });
        
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      correlationId: req.correlationId
    });
  }
    
  next();
};

/**
 * Security event logging
 */
const securityLogger = (req, res, next) => {
  // Log security-relevant events
  const securityEvents = {
    sensitiveEndpoints: ['/users/admin', '/users/bulk', '/internal'],
    suspiciousPatterns: [
      /\b(union|select|insert|update|delete|drop|create|alter)\b/i,
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /vbscript:/i
    ]
  };

  // Check for suspicious patterns in URL
  const url = req.url;
  const isSuspicious = securityEvents.suspiciousPatterns.some(pattern => pattern.test(url));
    
  if (isSuspicious) {
    logger.warn('Suspicious request pattern detected', {
      url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      correlationId: req.correlationId
    });
  }

  // Log access to sensitive endpoints
  if (securityEvents.sensitiveEndpoints.some(endpoint => url.startsWith(endpoint))) {
    logger.info('Sensitive endpoint access', {
      endpoint: url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      correlationId: req.correlationId
    });
  }

  next();
};

/**
 * Correlation ID generator for request tracking
 */
const correlationMiddleware = (req, res, next) => {
  const id = req.get('X-Correlation-ID') || 
              `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
  req.correlationId = id;
  res.setHeader('X-Correlation-ID', id);
    
  next();
};

/**
 * User agent validation
 */
const validateUserAgent = (req, res, next) => {
  const userAgent = req.get('User-Agent');
    
  if (!userAgent || userAgent.trim() === '') {
    logger.warn('Missing User-Agent header', {
      ip: req.ip,
      correlationId: req.correlationId
    });
        
    return res.status(400).json({
      success: false,
      error: 'User-Agent header is required',
      correlationId: req.correlationId
    });
  }
    
  // Block known malicious user agents
  const blockedAgents = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /burp/i,
    /nmap/i
  ];
    
  if (blockedAgents.some(pattern => pattern.test(userAgent))) {
    logger.warn('Blocked user agent detected', {
      userAgent,
      ip: req.ip,
      correlationId: req.correlationId
    });
        
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      correlationId: req.correlationId
    });
  }
    
  next();
};

/**
 * Validate content type middleware
 */
const validateContentType = (req, res, next) => {
  const contentType = req.get('Content-Type');
    
  // Allow requests without content type for GET/DELETE requests
  if (['GET', 'DELETE', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
    
  // For POST/PUT requests, require proper content type
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: 'Content-Type header is required',
        correlationId: req.correlationId
      });
    }
        
    // Allow only specific content types
    const allowedTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data'
    ];
        
    const isValidType = allowedTypes.some(type => contentType.includes(type));
        
    if (!isValidType) {
      logger.warn('Invalid content type detected', {
        contentType,
        method: req.method,
        ip: req.ip,
        correlationId: req.correlationId
      });
            
      return res.status(415).json({
        success: false,
        error: 'Unsupported content type',
        correlationId: req.correlationId
      });
    }
  }
    
  next();
};

/**
 * Complete security middleware stack
 */
const securityStack = [
  correlationMiddleware,
  securityHeaders,
  apiSecurity,
  sanitizeInput,
  requestSizeLimiter,
  ipFilter,
  validateUserAgent,
  securityLogger,
  validateContentType
];

export {
  securityHeaders,
  apiSecurity,
  sensitiveEndpointSecurity,
  sanitizeInput,
  validateContentType,
  requestSizeLimiter,
  ipFilter,
  securityLogger,
  correlationMiddleware,
  validateUserAgent,
  securityStack
};
