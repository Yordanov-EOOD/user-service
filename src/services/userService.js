import prisma from '../config/db.js';

// userService.js
export const createUserService = async (userData) => {
  // Remove password logic (handled by Auth Service)
  return await prisma.user.create({
    data: {
      authUserId: userData.authUserId,  // From Auth Service
      username: userData.username,
      bio: userData.bio || '',
      image: userData.image || '',
    },
  });
};

export const getAllUsersService = async () => {
  return await prisma.user.findMany();
};

export const getUserByIdService = async (authUserId) => {
  const user = await prisma.user.findUnique({ where: { authUserId } });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

export const updateUserService = async (authUserId, userData) => {
  return await prisma.user.update({
    where: { authUserId },
    data: userData,
  });
};

export const deleteUserService = async (id) => {
  return await prisma.user.delete({ where: { id } });
};