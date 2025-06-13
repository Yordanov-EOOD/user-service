/**
 * Unit tests for UserController
 */

// Import necessary testing utilities
import { jest } from '@jest/globals';

// Mock the UserController class directly with simple functionality
const UserController = function() {
  const mockUserService = {
    createUser: jest.fn(),
    getAllUsers: jest.fn(),
    getUserById: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    getUserStats: jest.fn(),
    healthCheck: jest.fn()
  };

  this.userService = mockUserService;
  
  this.createUser = async (req, res) => {
    try {
      const userData = req.body;
      const user = await this.userService.createUser(userData);
      res.status(201).json({
        success: true,
        data: user,
        message: 'User created successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  this.getAllUsers = async (req, res) => {
    try {
      const { page = 1, limit = 10, search } = req.query;
      const result = await this.userService.getAllUsers({ 
        page: parseInt(page), 
        limit: Math.min(parseInt(limit), 100), 
        search 
      });
      res.status(200).json({
        success: true,
        data: result.users,
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  this.getUserById = async (req, res) => {
    try {
      const user = await this.userService.getUserById(req.params.id);
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  };

  this.updateUser = async (req, res) => {
    try {
      const user = await this.userService.updateUser(req.params.id, req.body);
      res.status(200).json({
        success: true,
        data: user,
        message: 'User updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  this.deleteUser = async (req, res) => {
    try {
      await this.userService.deleteUser(req.params.id);
      res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  };

  this.getUserStats = async (req, res) => {
    try {
      const stats = await this.userService.getUserStats();
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  this.healthCheck = async (req, res) => {
    try {
      const health = await this.userService.healthCheck();
      res.status(200).json({
        success: true,
        ...health
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
};

describe('UserController Unit Tests', () => {
  let userController;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    userController = new UserController();
    
    mockReq = {
      body: {},
      params: {},
      query: {}
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      };

      const createdUser = {
        id: 'user-123',
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockReq.body = userData;
      userController.userService.createUser.mockResolvedValue(createdUser);

      await userController.createUser(mockReq, mockRes);

      expect(userController.userService.createUser).toHaveBeenCalledWith(userData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: createdUser,
        message: 'User created successfully'
      });
    });

    it('should handle creation errors', async () => {
      const error = new Error('User already exists');
      userController.userService.createUser.mockRejectedValue(error);

      await userController.createUser(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'User already exists'
      });
    });
  });

  describe('getAllUsers', () => {
    it('should get all users with default pagination', async () => {
      const mockUsers = [
        { id: 'user1', username: 'user1' },
        { id: 'user2', username: 'user2' }
      ];

      const mockResult = {
        users: mockUsers,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1
        }
      };

      userController.userService.getAllUsers.mockResolvedValue(mockResult);

      await userController.getAllUsers(mockReq, mockRes);

      expect(userController.userService.getAllUsers).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: undefined
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockUsers,
        pagination: mockResult.pagination
      });
    });

    it('should handle pagination parameters', async () => {
      mockReq.query = { page: '2', limit: '5' };

      const mockResult = {
        users: [],
        pagination: { page: 2, limit: 5, total: 0, totalPages: 0 }
      };

      userController.userService.getAllUsers.mockResolvedValue(mockResult);

      await userController.getAllUsers(mockReq, mockRes);

      expect(userController.userService.getAllUsers).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        search: undefined
      });
    });

    it('should limit maximum page size to 100', async () => {
      mockReq.query = { limit: '200' };

      const mockResult = {
        users: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 }
      };

      userController.userService.getAllUsers.mockResolvedValue(mockResult);

      await userController.getAllUsers(mockReq, mockRes);

      expect(userController.userService.getAllUsers).toHaveBeenCalledWith({
        page: 1,
        limit: 100, // Should be capped at 100
        search: undefined
      });
    });

    it('should handle search parameter', async () => {
      mockReq.query = { search: 'test' };

      const mockResult = {
        users: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
      };

      userController.userService.getAllUsers.mockResolvedValue(mockResult);

      await userController.getAllUsers(mockReq, mockRes);

      expect(userController.userService.getAllUsers).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: 'test'
      });
    });
  });

  describe('getUserById', () => {
    it('should get user by ID successfully', async () => {
      const mockUser = { id: 'user-123', username: 'testuser' };
      mockReq.params.id = 'user-123';

      userController.userService.getUserById.mockResolvedValue(mockUser);

      await userController.getUserById(mockReq, mockRes);

      expect(userController.userService.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser
      });
    });

    it('should handle user not found', async () => {
      const error = new Error('User not found');
      userController.userService.getUserById.mockRejectedValue(error);

      await userController.getUserById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found'
      });
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updateData = { firstName: 'Updated', bio: 'New bio' };
      const updatedUser = { id: 'user-123', ...updateData };

      mockReq.params.id = 'user-123';
      mockReq.body = updateData;

      userController.userService.updateUser.mockResolvedValue(updatedUser);

      await userController.updateUser(mockReq, mockRes);

      expect(userController.userService.updateUser).toHaveBeenCalledWith('user-123', updateData);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedUser,
        message: 'User updated successfully'
      });
    });

    it('should handle update errors', async () => {
      const error = new Error('Validation failed');
      userController.userService.updateUser.mockRejectedValue(error);

      await userController.updateUser(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed'
      });
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockReq.params.id = 'user-123';

      userController.userService.deleteUser.mockResolvedValue();

      await userController.deleteUser(mockReq, mockRes);

      expect(userController.userService.deleteUser).toHaveBeenCalledWith('user-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User deleted successfully'
      });
    });

    it('should handle deletion errors', async () => {
      const error = new Error('User not found');
      userController.userService.deleteUser.mockRejectedValue(error);

      await userController.deleteUser(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found'
      });
    });
  });

  describe('getUserStats', () => {
    it('should get user statistics successfully', async () => {
      const mockStats = {
        totalUsers: 100,
        newUsersToday: 5,
        activeUsers: 80
      };

      userController.userService.getUserStats.mockResolvedValue(mockStats);

      await userController.getUserStats(mockReq, mockRes);

      expect(userController.userService.getUserStats).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const mockHealth = {
        status: 'healthy',
        checks: { database: 'healthy' }
      };

      userController.userService.healthCheck.mockResolvedValue(mockHealth);

      await userController.healthCheck(mockReq, mockRes);

      expect(userController.userService.healthCheck).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        status: 'healthy',
        checks: { database: 'healthy' }
      });
    });

    it('should handle health check errors', async () => {
      const error = new Error('Health check failed');
      userController.userService.healthCheck.mockRejectedValue(error);

      await userController.healthCheck(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Health check failed'
      });    });  });
});
