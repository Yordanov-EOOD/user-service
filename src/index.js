import express from 'express';
import cors from 'cors';
import axios from 'axios';
import userRoute from './route/userRoute.js';
import { errorHandler } from './middleware/errorHandler.js';
import verifyJWT from './middleware/verifyJWT.js';
import verifyServiceToken from './middleware/verifyServiceToken.js'; // New middleware
import { createUser } from './controllers/userController.js';

const app = express();

// Configure CORS for frontend/API gateway access
app.use(cors({
  origin: [
    'http://localhost:3000',    // Frontend
    'http://api-gateway:80'     // API Gateway
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware
app.use(express.json());

export const userServiceClient = axios.create({
  baseURL: process.env.AUTH_SERVICE_URL || 'http://auth-service:3000',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'Service-Identifier': 'user-service'
  }
});

// Inner routes
app.post('/internal/users', verifyServiceToken, createUser); // No JWT needed


// Protected routes
app.use('/users', verifyJWT, userRoute);

// Error handling
app.use(errorHandler);

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});