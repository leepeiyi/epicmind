// backend/middleware/require-teacher.js

const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token AND ensure the user is a teacher or admin
 * Admins can do everything teachers can do
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

    // Check if user role is 'teacher' OR 'admin' (admins can do everything)
    if (decoded.role !== 'teacher' && decoded.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'This action is only available to teachers and administrators'
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
