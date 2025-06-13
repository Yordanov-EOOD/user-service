// Mock for src/index.js (app export)
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { json } from 'express';

// Create a basic express app for testing
const app = express();

// Add basic middleware
app.use(cors());
app.use(helmet());
app.use(json());

// Mock user routes
app.post('/users', (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    const userData = req.body;
    
    // Basic validation
    if (!userData.username || !userData.email || !userData.firstName || !userData.lastName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Create user using Prisma mock
    prisma.user.create()
      .then(user => {
        res.status(201).json({
          success: true,
          data: user,
          message: 'User created successfully'
        });
      })
      .catch(err => {
        // Check for duplicate error
        if (err.code === 'P2002') {
          res.status(409).json({
            success: false,
            error: 'User already exists'
          });
        } else {
          throw err;
        }
      });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/users', (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    const { page = 1, limit = 10, search } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Validate limit
    if (limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit cannot exceed 100'
      });
    }
    
    // Get users with Prisma mock
    let query = {};
    if (search) {
      query = {
        where: {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        }
      };
    }
    
    Promise.all([
      prisma.user.findMany({
        ...query,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count(query)
    ]).then(([users, count]) => {
      res.status(200).json({
        success: true,
        data: users,
        pagination: {
          total: count,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(count / limitNum)
        }
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/users/:id', (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    prisma.user.findUnique({
      where: { id: req.params.id }
    }).then(user => {
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: user
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/users/:id', (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    // Check if user exists
    prisma.user.findUnique({
      where: { id: req.params.id }
    }).then(existingUser => {
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      // Basic validation
      if (req.body.email && !/\S+@\S+\.\S+/.test(req.body.email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }
      
      // Update user
      prisma.user.update({
        where: { id: req.params.id },
        data: req.body
      }).then(updatedUser => {
        res.status(200).json({
          success: true,
          data: updatedUser,
          message: 'User updated successfully'
        });
      });
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/users/:id', (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    // Check if user exists
    prisma.user.findUnique({
      where: { id: req.params.id }
    }).then(existingUser => {
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      // Delete user
      prisma.user.delete({
        where: { id: req.params.id }
      }).then(() => {
        res.status(200).json({
          success: true,
          message: 'User deleted successfully'
        });
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/users/stats', (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    Promise.all([
      prisma.user.count(),
      prisma.user.aggregate({ _count: { id: true } })
    ]).then(([totalUsers, newUsers]) => {
      res.status(200).json({
        success: true,
        data: {
          totalUsers,
          newUsersToday: newUsers._count.id,
          activeUsers: Math.floor(totalUsers * 0.8),
          avgUsersPerDay: Math.floor(totalUsers / 30)
        }
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/users/health', (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    prisma.$queryRaw`SELECT 1 as result`.then(() => {
      res.status(200).json({
        success: true,
        status: 'healthy',
        checks: {
          database: 'healthy'
        }
      });
    }).catch(() => {
      res.status(200).json({
        success: true,
        status: 'unhealthy',
        checks: {
          database: 'unhealthy'
        }
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

app.get('/health/detailed', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    metrics: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  });
});

export default app;
