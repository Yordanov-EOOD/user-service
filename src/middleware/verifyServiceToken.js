import jwt from 'jsonwebtoken';

import 'dotenv/config';


const verifyServiceToken = (req, res, next) => {
  const serviceToken = req.headers['x-service-token'];

  if (!serviceToken) {
    return res.status(401).json({ error: 'Service token missing' });
  }

  try {
    // Verify the token using a shared secret (e.g., from environment variables)
    const decoded = jwt.verify(serviceToken, process.env.ACCESS_TOKEN_SECRET);
    req.service = decoded.service;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid service token' });
  }
};

export default verifyServiceToken;