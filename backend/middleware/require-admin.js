// backend/middleware/require-admin.js

const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token AND ensure the user is an admin
 * Must be used after verifyToken or can be used standalone
 */
module.exports = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Verify token using the JWT_SECRET from environment variables
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user role is 'admin'
    if (decoded.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'This action is only available to administrators'
      });
    }

    // Attach user info to the request object
    req.user = decoded;

    // Continue to the next middleware or route handler
    next();
  } catch (err) {
    console.error('❌ Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
