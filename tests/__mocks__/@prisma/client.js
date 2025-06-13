// Mock for @prisma/client
export const PrismaClient = jest.fn().mockImplementation(() => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn()
  },
  $connect: jest.fn(),
  $disconnect: jest.fn()
}));

export default PrismaClient;
