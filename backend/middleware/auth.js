const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { asyncHandler } = require('../utils/helpers');

/** Requires a valid "Authorization: Bearer <token>" header. */
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError('Authentication required. Please log in.', 401);

  const decoded = jwt.verify(token, process.env.JWT_SECRET); // throws -> errorHandler -> 401
  const user = await User.findById(decoded.id);
  if (!user) throw new AppError('The account for this token no longer exists.', 401);
  req.user = user;
  next();
});

module.exports = { protect };
