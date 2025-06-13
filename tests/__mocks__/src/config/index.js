// Mock for src/config/index.js
export default {
  features: {
    kafkaEnabled: false
  },
  jwt: {
    accessSecret: 'test-secret',
    refreshSecret: 'test-refresh-secret'
  },
  database: {
    url: 'test-db-url'
  }
};
