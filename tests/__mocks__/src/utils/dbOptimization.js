// Mock for src/utils/dbOptimization.js
export default {
  selectFields: {
    getUserProfile: {
      id: true,
      authUserId: true,
      username: true,
      bio: true,
      image: true,
      createdAt: true,
      updatedAt: true
    },
    getUserBasic: {
      id: true,
      authUserId: true,
      username: true,
      createdAt: true
    }
  }
};
