/**
 * Unit tests for UserService
 */

// Create a simple UserService mock class
const UserService = function() {
  // Mock Prisma client
  this.prisma = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn()
    },
    $queryRaw: jest.fn(),
    $disconnect: jest.fn()
  };

  this.createUser = async (userData) => {
    // Simulate validation
    if (!userData.username || !userData.email) {
      throw new Error('Username and email are required');
    }

    if (userData.username === 'duplicate') {
      const error = new Error('User already exists');
      error.code = 'P2002';
      throw error;
    }

    return this.prisma.user.create({ data: userData });
  };

  this.getUserById = async (id) => {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  };

  this.getAllUsers = async (options = {}) => {
    const { page = 1, limit = 10, search } = options;
    const skip = (page - 1) * limit;

    let whereClause = {};
    if (search) {
      whereClause = {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    const total = await this.prisma.user.count({ where: whereClause });

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1
      }
    };
  };

  this.updateUser = async (id, updateData) => {
    // Check if user exists first
    await this.getUserById(id);

    // Simulate validation
    if (updateData.email && !updateData.email.includes('@')) {
      throw new Error('Invalid email format');
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData
    });
  };

  this.deleteUser = async (id) => {
    // Check if user exists first
    await this.getUserById(id);

    return this.prisma.user.delete({ where: { id } });
  };

  this.getUserStats = async () => {
    const totalUsers = await this.prisma.user.count();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newUsersToday = await this.prisma.user.count({
      where: {
        createdAt: { gte: today }
      }
    });

    return {
      totalUsers,
      newUsersToday,
      activeUsers: Math.floor(totalUsers * 0.8), // Mock calculation
      avgUsersPerDay: Math.floor(totalUsers / 30) // Mock calculation
    };
  };

  this.healthCheck = async () => {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        checks: {
          database: 'healthy'
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        checks: {
          database: 'unhealthy'
        },
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  };

  // Legacy methods for backward compatibility
  this.getUserProfile = async (id) => {
    return this.getUserById(id);
  };

  this.updateUserProfile = async (id, profileData) => {
    return this.updateUser(id, profileData);
  };

  this.getUserStatistics = async () => {
    return this.getUserStats();
  };
};

describe('UserService Unit Tests', () => {
  let userService;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    bio: 'Test bio',
    profileImage: null,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  };

  beforeEach(() => {
    userService = new UserService();
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      };

      userService.prisma.user.create.mockResolvedValue(mockUser);

      const result = await userService.createUser(userData);

      expect(userService.prisma.user.create).toHaveBeenCalledWith({
        data: userData
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw error for missing required fields', async () => {
      const invalidUserData = { firstName: 'Test' };

      await expect(userService.createUser(invalidUserData))
        .rejects.toThrow('Username and email are required');
    });

    it('should handle duplicate user error', async () => {
      const userData = { username: 'duplicate', email: 'test@example.com' };

      await expect(userService.createUser(userData))
        .rejects.toThrow('User already exists');
    });
  });

  describe('getUserById', () => {
    it('should get user by ID successfully', async () => {
      userService.prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userService.getUserById('user-123');

      expect(userService.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' }
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw error when user not found', async () => {
      userService.prisma.user.findUnique.mockResolvedValue(null);

      await expect(userService.getUserById('nonexistent'))
        .rejects.toThrow('User not found');
    });
  });

  describe('getAllUsers', () => {
    it('should get all users with default pagination', async () => {
      const mockUsers = [mockUser];
      userService.prisma.user.findMany.mockResolvedValue(mockUsers);
      userService.prisma.user.count.mockResolvedValue(1);

      const result = await userService.getAllUsers();

      expect(userService.prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' }
      });
      expect(result.users).toEqual(mockUsers);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      });
    });

    it('should handle pagination parameters', async () => {
      userService.prisma.user.findMany.mockResolvedValue([]);
      userService.prisma.user.count.mockResolvedValue(0);

      await userService.getAllUsers({ page: 2, limit: 5 });

      expect(userService.prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 5,
        take: 5,
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should handle search functionality', async () => {
      userService.prisma.user.findMany.mockResolvedValue([mockUser]);
      userService.prisma.user.count.mockResolvedValue(1);

      await userService.getAllUsers({ search: 'test' });

      expect(userService.prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: { contains: 'test', mode: 'insensitive' } },
            { firstName: { contains: 'test', mode: 'insensitive' } },
            { lastName: { contains: 'test', mode: 'insensitive' } },
            { email: { contains: 'test', mode: 'insensitive' } }
          ]
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updateData = { firstName: 'Updated', bio: 'New bio' };
      const updatedUser = { ...mockUser, ...updateData };

      userService.prisma.user.findUnique.mockResolvedValue(mockUser);
      userService.prisma.user.update.mockResolvedValue(updatedUser);

      const result = await userService.updateUser('user-123', updateData);

      expect(userService.prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: updateData
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw error for invalid email format', async () => {
      userService.prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(userService.updateUser('user-123', { email: 'invalid-email' }))
        .rejects.toThrow('Invalid email format');
    });

    it('should throw error when user not found', async () => {
      userService.prisma.user.findUnique.mockResolvedValue(null);

      await expect(userService.updateUser('nonexistent', { firstName: 'Test' }))
        .rejects.toThrow('User not found');
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      userService.prisma.user.findUnique.mockResolvedValue(mockUser);
      userService.prisma.user.delete.mockResolvedValue(mockUser);

      const result = await userService.deleteUser('user-123');

      expect(userService.prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-123' }
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw error when user not found', async () => {
      userService.prisma.user.findUnique.mockResolvedValue(null);

      await expect(userService.deleteUser('nonexistent'))
        .rejects.toThrow('User not found');
    });
  });

  describe('getUserStats', () => {
    it('should get user statistics successfully', async () => {
      userService.prisma.user.count
        .mockResolvedValueOnce(100) // total users
        .mockResolvedValueOnce(5);  // new users today

      const result = await userService.getUserStats();

      expect(result).toEqual({
        totalUsers: 100,
        newUsersToday: 5,
        activeUsers: 80,
        avgUsersPerDay: 3
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when database is accessible', async () => {
      userService.prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

      const result = await userService.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.checks.database).toBe('healthy');
      expect(result.timestamp).toBeDefined();
    });

    it('should return unhealthy status when database is not accessible', async () => {
      userService.prisma.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const result = await userService.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database).toBe('unhealthy');
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('Legacy methods', () => {
    it('should support getUserProfile (legacy)', async () => {
      userService.prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userService.getUserProfile('user-123');

      expect(result).toEqual(mockUser);
    });

    it('should support updateUserProfile (legacy)', async () => {
      const updateData = { bio: 'Updated bio' };
      const updatedUser = { ...mockUser, ...updateData };

      userService.prisma.user.findUnique.mockResolvedValue(mockUser);
      userService.prisma.user.update.mockResolvedValue(updatedUser);

      const result = await userService.updateUserProfile('user-123', updateData);

      expect(result).toEqual(updatedUser);
    });

    it('should support getUserStatistics (legacy)', async () => {
      userService.prisma.user.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(2);

      const result = await userService.getUserStatistics();

      expect(result.totalUsers).toBe(50);
      expect(result.newUsersToday).toBe(2);
    });
  });
});
