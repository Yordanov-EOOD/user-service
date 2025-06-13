// Mock Prisma Client for testing
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  },
  $disconnect: jest.fn(),
  $on: jest.fn(), // Mock the $on method for query logging
  $connect: jest.fn()
};

const PrismaClient = jest.fn(() => mockPrisma);

module.exports = {
  PrismaClient,
  mockPrisma
};