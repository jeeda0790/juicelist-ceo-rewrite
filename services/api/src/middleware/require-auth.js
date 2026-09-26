const { verifySessionToken } = require('../services/auth/tokens');

// Requires a valid "Authorization: Bearer <token>" header issued by
// POST /api/auth/verify-otp. On success, sets req.userId. On failure,
// responds 401 and stops the request from reaching the route handler.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Sign in required', code: 'AUTH_REQUIRED' });
  }

  const token = authHeader.slice('Bearer '.length);
  const session = verifySessionToken(token);

  if (!session) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session', code: 'AUTH_INVALID' });
  }

  req.userId = session.userId;
  next();
}

module.exports = { requireAuth };
