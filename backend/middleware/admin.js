
const AppError = require('../utils/AppError');

const adminOnly = (req, res, next) => {
  if (!req.user) {
    return next(
      new AppError('Please log in first.', 401)
    );
  }

  if (req.user.role !== 'admin') {
    return next(
      new AppError(
        'Access denied. Administrator privileges required.',
        403
      )
    );
  }

  next();
};

module.exports = { adminOnly };
