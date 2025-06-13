// Mock for src/utils/performance.js
export default {
  startTimer: jest.fn(() => ({
    end: jest.fn(() => 100) // Mock 100ms duration
  })),
  trackOperation: jest.fn(),
  trackEndpoint: jest.fn(),
  getMetrics: jest.fn(() => ({
    operations: {},
    endpoints: {},
    memory: process.memoryUsage(),
    uptime: process.uptime()
  })),
  reset: jest.fn()
};
