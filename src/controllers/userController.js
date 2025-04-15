import {
    createUserService,
    getAllUsersService,
    getUserByIdService,
    updateUserService,
    deleteUserService,
  } from '../services/userService.js';
  

export const createUser = async (req, res) => {
  const { authUserId, username } = req.body;

  try {
    const userProfile = await createUserService({
      authUserId,  // Directly pass fields (no nested "data")
      username,
      bio: '',
      image: '',
    });
    res.status(201).json(userProfile);
  } catch (error) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'User already exists' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
};
  
  export const getAllUsers = async (req, res) => {
    try {
      const users = await getAllUsersService();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  };
  
  export const getUserById = async (req, res) => {
    const { id } = req.params;
  
    try {
      const user = await getUserByIdService(id);
      res.json(user);
    } catch (error) {
      res.status(404).json({ error: 'User not found' });
    }
  };
  
  export const updateUser = async (req, res) => {
    const { id } = req.params;
    const { bio, image, name } = req.body;
  
    try {
      const user = await updateUserService(id, { bio, image, name });
      res.json(user);
    } catch (error) {
      res.status(404).json({ error: 'User not found' });
    }
  };
  
  export const deleteUser = async (req, res) => {
    const { id } = req.params;
  
    try {
      await deleteUserService(id);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ error: 'User not found' });
    }
  };