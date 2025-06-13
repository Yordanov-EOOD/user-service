import { body, param, query, validationResult } from 'express-validator';
import xss from 'xss';
import logger from '../config/logger.js';
import config from '../config/index.js';
import AppError from '../utils/appError.js';

/**
 * Validation rules for user operations
 */
const userValidation = {
    createUser: [
        body('authUserId')
            .notEmpty()
            .withMessage('Auth User ID is required')
            .isString()
            .withMessage('Auth User ID must be a string')
            .isLength({ min: 1, max: 100 })
            .withMessage('Auth User ID must be 1-100 characters'),
            
        body('username')
            .isLength({ min: 3, max: config.security.validation.maxUsernameLength })
            .withMessage(`Username must be 3-${config.security.validation.maxUsernameLength} characters`)
            .matches(/^[a-zA-Z0-9_]+$/)
            .withMessage('Username can only contain letters, numbers, and underscores')
            .custom(async (value) => {
                // Reserved usernames
                const reserved = ['admin', 'api', 'www', 'mail', 'ftp', 'localhost', 'root', 'null', 'undefined'];
                if (reserved.includes(value.toLowerCase())) {
                    throw new Error('Username is reserved');
                }
                return true;
            }),
            
        body('bio')
            .optional()
            .isLength({ max: config.security.validation.maxBioLength })
            .withMessage(`Bio cannot exceed ${config.security.validation.maxBioLength} characters`),
            
        body('name')
            .optional()
            .isLength({ max: config.security.validation.maxNameLength })
            .withMessage(`Name cannot exceed ${config.security.validation.maxNameLength} characters`),
            
        body('image')
            .optional()
            .isURL({ require_protocol: true, protocols: ['http', 'https'] })
            .withMessage('Image must be a valid URL')
            .isLength({ max: 500 })
            .withMessage('Image URL cannot exceed 500 characters')
    ],

    updateUser: [
        param('id')
            .notEmpty()
            .withMessage('User ID is required')
            .isString()
            .withMessage('User ID must be a string'),
            
        body('username')
            .optional()
            .isLength({ min: 3, max: config.security.validation.maxUsernameLength })
            .withMessage(`Username must be 3-${config.security.validation.maxUsernameLength} characters`)
            .matches(/^[a-zA-Z0-9_]+$/)
            .withMessage('Username can only contain letters, numbers, and underscores'),
            
        body('bio')
            .optional()
            .isLength({ max: config.security.validation.maxBioLength })
            .withMessage(`Bio cannot exceed ${config.security.validation.maxBioLength} characters`),
            
        body('name')
            .optional()
            .isLength({ max: config.security.validation.maxNameLength })
            .withMessage(`Name cannot exceed ${config.security.validation.maxNameLength} characters`),
            
        body('image')
            .optional()
            .isURL({ require_protocol: true, protocols: ['http', 'https'] })
            .withMessage('Image must be a valid URL')
            .isLength({ max: 500 })
            .withMessage('Image URL cannot exceed 500 characters')
    ],

    getUserById: [
        param('id')
            .notEmpty()
            .withMessage('User ID is required')
            .isString()
            .withMessage('User ID must be a string')
            .isLength({ min: 1, max: 100 })
            .withMessage('User ID must be 1-100 characters')
    ],

    deleteUser: [
        param('id')
            .notEmpty()
            .withMessage('User ID is required')
            .isString()
            .withMessage('User ID must be a string')
    ],

    batchUsers: [
        body('userIds')
            .isArray({ min: 1, max: 100 })
            .withMessage('userIds must be an array with 1-100 elements')
            .custom((userIds) => {
                if (!Array.isArray(userIds)) return false;
                
                // Check each userId
                for (const userId of userIds) {
                    if (typeof userId !== 'string' || userId.length === 0 || userId.length > 100) {
                        throw new Error('Each userId must be a non-empty string with max 100 characters');
                    }
                }
                return true;
            })
    ],

    searchUsers: [
        query('q')
            .notEmpty()
            .withMessage('Search query is required')
            .isLength({ min: 2, max: 100 })
            .withMessage('Search query must be 2-100 characters')
            .matches(/^[a-zA-Z0-9\s_.-]+$/)
            .withMessage('Search query contains invalid characters'),
            
        query('limit')
            .optional()
            .isInt({ min: 1, max: 50 })
            .withMessage('Limit must be between 1 and 50')
            .toInt(),
            
        query('offset')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Offset must be a non-negative integer')
            .toInt()
    ],

    followUser: [
        param('id')
            .notEmpty()
            .withMessage('User ID is required')
            .isString()
            .withMessage('User ID must be a string')
    ],

    unfollowUser: [
        param('id')
            .notEmpty()
            .withMessage('User ID is required')
            .isString()
            .withMessage('User ID must be a string')
    ]
};

/**
 * Sanitize content to prevent XSS
 */
const sanitizeContent = (req, res, next) => {
    const xssOptions = {
        whiteList: {}, // No HTML tags allowed
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script']
    };

    if (req.body.bio) {
        req.body.bio = xss(req.body.bio, xssOptions);
    }
    
    if (req.body.name) {
        req.body.name = xss(req.body.name, xssOptions);
    }
    
    if (req.body.username) {
        req.body.username = xss(req.body.username, xssOptions);
    }
    
    // Sanitize query parameters
    if (req.query.q) {
        req.query.q = xss(req.query.q, xssOptions);
    }
    
    next();
};

/**
 * Rate limiting validation
 */
const validateRateLimit = (req, res, next) => {
    // Add custom rate limiting logic if needed
    const userAgent = req.get('User-Agent') || '';
    const ip = req.ip;
    
    // Block known bot patterns that might be doing aggressive requests
    const botPatterns = [
        /bot/i,
        /crawl/i,
        /spider/i,
        /scraper/i
    ];
    
    const isBot = botPatterns.some(pattern => pattern.test(userAgent));
    
    if (isBot) {
        logger.warn('Bot detected, applying stricter validation', {
            userAgent,
            ip,
            correlationId: req.correlationId
        });
        
        // Could implement stricter validation for bots
    }
    
    next();
};

/**
 * Security validation for sensitive operations
 */
const validateSecurity = [
    // Check for suspicious patterns in request
    (req, res, next) => {
        const suspiciousPatterns = [
            /\b(union|select|insert|update|delete|drop|create|alter)\b/i,
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/i,
            /data:text\/html/i,
            /vbscript:/i
        ];

        const checkString = JSON.stringify(req.body) + JSON.stringify(req.query) + req.url;
        
        const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(checkString));
        
        if (isSuspicious) {
            logger.warn('Suspicious patterns detected in request', {
                method: req.method,
                url: req.url,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                correlationId: req.correlationId
            });
            
            return res.status(400).json({
                success: false,
                error: 'Invalid request content',
                correlationId: req.correlationId
            });
        }
        
        next();
    }
];

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg);
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errorMessages,
            correlationId: req.correlationId
        });
    }
    next();
};

/**
 * Validate content length
 */
const validateContentLength = (req, res, next) => {
    const maxLength = 10000; // 10KB
    const contentLength = req.headers['content-length'];
    
    if (contentLength && parseInt(contentLength) > maxLength) {
        return res.status(413).json({
            success: false,
            error: 'Request entity too large',
            correlationId: req.correlationId
        });
    }
    next();
};

/**
 * Validate request
 */
const validateRequest = (req, res, next) => {
    // Add custom request validation logic
    next();
};

/**
 * Sanitize input
 */
const sanitizeInput = (req, res, next) => {
    // Add custom input sanitization logic
    next();
};

/**
 * Validate user profile
 */
const validateUserProfile = (req, res, next) => {
    // Add custom user profile validation logic
    next();
};

/**
 * Validate pagination parameters
 */
const validatePagination = (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({
                success: false,
                error: 'Invalid page number',
                correlationId: req.correlationId
            });
        }

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                success: false,
                error: 'Invalid limit value',
                correlationId: req.correlationId
            });
        }

        req.query.page = pageNum;
        req.query.limit = limitNum;
        next();
    } catch (error) {
        next(new AppError('Invalid pagination parameters', 400));
    }
};

export {
    userValidation,
    sanitizeContent,
    validateRateLimit,
    validateSecurity,
    handleValidationErrors,
    validateContentLength,
    validateRequest,
    sanitizeInput,
    validateUserProfile,
    validatePagination
};
