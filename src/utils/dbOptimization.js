/**
 * Database optimization utilities for user-service
 * Provides optimized queries and batch operations
 */

import logger from '../config/logger.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Optimized query configurations
 */
const queryOptimizations = {
    // Optimized user queries with strategic field selection
    getUserProfile: {
        select: {
            id: true,
            username: true,
            name: true,
            bio: true,
            image: true,
            createdAt: true,
            updatedAt: true
        }
    },

    // Basic user info for lists and searches
    getUserBasic: {
        select: {
            id: true,
            username: true,
            name: true,
            image: true
        }
    },

    // User info with follow counts (if relationships exist)
    getUserWithStats: {
        select: {
            id: true,
            authUserId: true,
            username: true,
            bio: true,
            image: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            // Add relationship counts if available
            _count: {
                select: {
                    followers: true,
                    following: true
                }
            }
        }
    },

    // Batch user lookup optimization
    getBatchUsers: (userIds) => ({
        where: { 
            authUserId: { in: userIds } 
        },
        select: {
            id: true,
            authUserId: true,
            username: true,
            bio: true,
            image: true,
            name: true
        }
    }),

    // Search users optimization
    searchUsers: (searchTerm) => ({
        where: {
            OR: [
                { username: { contains: searchTerm, mode: 'insensitive' } },
                { name: { contains: searchTerm, mode: 'insensitive' } }
            ]
        },
        select: {
            id: true,
            authUserId: true,
            username: true,
            name: true,
            image: true,
            bio: true
        },
        take: 20 // Limit search results
    })
};

/**
 * Batch operations for efficient data processing
 */
const batchOperations = {
    /**
     * Batch fetch multiple users efficiently
     */
    async getBatchUsers(prisma, userIds) {
        if (!userIds || userIds.length === 0) return [];
        
        const startTime = Date.now();
        
        try {
            // Remove duplicates and limit batch size
            const uniqueUserIds = [...new Set(userIds)].slice(0, 100);
            
            const users = await prisma.user.findMany(
                queryOptimizations.getBatchUsers(uniqueUserIds)
            );
            
            const duration = Date.now() - startTime;
            logger.debug('Batch users retrieved', {
                requestedCount: userIds.length,
                uniqueCount: uniqueUserIds.length,
                retrievedCount: users.length,
                duration
            });
            
            return users;
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('Error in batch user retrieval', {
                error: error.message,
                userIdsCount: userIds.length,
                duration
            });
            throw error;
        }
    },

    /**
     * Batch update user information
     */
    async batchUpdateUsers(prisma, updates) {
        if (!updates || updates.length === 0) return [];
        
        const startTime = Date.now();
        
        try {
            const results = await Promise.allSettled(
                updates.map(async ({ authUserId, data }) => {
                    return await prisma.user.update({
                        where: { authUserId },
                        data,
                        select: queryOptimizations.getUserProfile.select
                    });
                })
            );

            const successful = results
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value);

            const failed = results
                .filter(result => result.status === 'rejected')
                .map(result => result.reason);

            const duration = Date.now() - startTime;
            logger.info('Batch update completed', {
                totalUpdates: updates.length,
                successful: successful.length,
                failed: failed.length,
                duration
            });

            if (failed.length > 0) {
                logger.warn('Some batch updates failed', {
                    failedCount: failed.length,
                    errors: failed.map(err => err.message)
                });
            }

            return successful;
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('Error in batch user update', {
                error: error.message,
                updatesCount: updates.length,
                duration
            });
            throw error;
        }
    },

    /**
     * Search users with optimization
     */
    async searchUsers(prisma, searchTerm, limit = 20) {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }

        const startTime = Date.now();
        
        try {
            const cleanSearchTerm = searchTerm.trim().toLowerCase();
            
            const users = await prisma.user.findMany({
                ...queryOptimizations.searchUsers(cleanSearchTerm),
                take: Math.min(limit, 50) // Cap at 50 results
            });

            const duration = Date.now() - startTime;
            logger.debug('User search completed', {
                searchTerm: cleanSearchTerm,
                resultsCount: users.length,
                duration
            });

            return users;
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('Error in user search', {
                error: error.message,
                searchTerm,
                duration
            });
            throw error;
        }
    }
};

/**
 * Database connection management
 */
const connectionManager = {
    /**
     * Test database connectivity
     */
    async testConnection(prisma) {
        const startTime = Date.now();
        
        try {
            await prisma.$queryRaw`SELECT 1`;
            const duration = Date.now() - startTime;
            
            logger.debug('Database connection test successful', { duration });
            return { healthy: true, responseTime: duration };
        } catch (error) {
            const duration = Date.now() - startTime;
            
            logger.error('Database connection test failed', {
                error: error.message,
                duration
            });
            
            return { healthy: false, error: error.message, responseTime: duration };
        }
    },

    /**
     * Get database metrics
     */
    async getDatabaseMetrics(prisma) {
        const startTime = Date.now();
        
        try {
            const [userCount] = await Promise.all([
                prisma.user.count()
            ]);

            const duration = Date.now() - startTime;
            
            return {
                healthy: true,
                metrics: {
                    totalUsers: userCount,
                    queryTime: duration
                }
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            
            logger.error('Error getting database metrics', {
                error: error.message,
                duration
            });
            
            return {
                healthy: false,
                error: error.message,
                queryTime: duration
            };
        }
    },

    /**
     * Close database connections gracefully
     */
    async closeConnections(prisma) {
        try {
            await prisma.$disconnect();
            logger.info('Database connections closed successfully');
        } catch (error) {
            logger.error('Error closing database connections', {
                error: error.message
            });
            throw error;
        }
    }
};

/**
 * Query performance tracking
 */
const queryPerformance = {
    /**
     * Track slow queries
     */
    trackQuery(operation, duration, details = {}) {
        if (duration > 1000) { // Log queries over 1 second
            logger.warn('Slow query detected', {
                operation,
                duration,
                ...details
            });
        } else if (duration > 500) {
            logger.debug('Moderate query duration', {
                operation,
                duration,
                ...details
            });
        }
    },

    /**
     * Wrapper for timing database operations
     */
    async timeOperation(operation, operationName, details = {}) {
        const startTime = Date.now();
        
        try {
            const result = await operation();
            const duration = Date.now() - startTime;
            
            this.trackQuery(operationName, duration, details);
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            logger.error('Database operation failed', {
                operation: operationName,
                duration,
                error: error.message,
                ...details
            });
            
            throw error;
        }
    }
};

// Batch fetch user profiles
const batchUserProfiles = async (prisma, userIds) => {
    try {
        return await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: queryOptimizations.getUserProfile.select
        });
    } catch (error) {
        logger.error('Error in batchUserProfiles', { error, userIds });
        throw error;
    }
};

// Optimized user update
const optimizedUpdateUser = async (prisma, userId, updateData) => {
    try {
        return await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: queryOptimizations.getUserProfile.select
        });
    } catch (error) {
        logger.error('Error in optimizedUpdateUser', { error, userId, updateData });
        throw error;
    }
};

// Execute query with retry logic
const executeWithRetry = async (operation, maxRetries = 3, delay = 1000) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (!isTransientError(error)) {
                throw error;
            }
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }
    throw lastError;
};

const isTransientError = (error) => {
    const transientErrors = [
        'P1001', // Connection error
        'P1002', // Connection timed out
        'P1008', // Operations timed out
        'P1017', // Server closed the connection
        'P2024', // Connection pool timeout
        'P2034', // Transaction deadlock
        'P2035', // Transaction timeout
        'P2036', // Transaction conflict
        'P2037', // Transaction serialization failure
        'P2038'  // Transaction isolation level conflict
    ];
    return transientErrors.includes(error.code);
};

// Measure query performance
const measureQueryPerformance = async (operation, queryName) => {
    const start = process.hrtime();
    try {
        const result = await operation();
        const [seconds, nanoseconds] = process.hrtime(start);
        const duration = seconds * 1000 + nanoseconds / 1000000;
        
        logger.info('Query performance', {
            queryName,
            duration: `${duration.toFixed(2)}ms`
        });
        
        return result;
    } catch (error) {
        const [seconds, nanoseconds] = process.hrtime(start);
        const duration = seconds * 1000 + nanoseconds / 1000000;
        
        logger.error('Query performance error', {
            queryName,
            duration: `${duration.toFixed(2)}ms`,
            error: error.message
        });
        
        throw error;
    }
};

const dbOptimization = {
    // For backward compatibility, expose selectFields as expected by userService
    selectFields: {
        getUserProfile: queryOptimizations.getUserProfile.select,
        getUserBasic: queryOptimizations.getUserBasic.select
    },
    queryOptimizations,
    batchUserProfiles,
    optimizedUpdateUser,
    executeWithRetry,
    measureQueryPerformance,
    batchOperations,
    connectionManager,
    queryPerformance
};

export default dbOptimization;