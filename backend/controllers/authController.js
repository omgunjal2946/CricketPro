
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { sign } = require('../utils/token');
const { asyncHandler, cleanStr } = require('../utils/helpers');

const strongEnough = (p) =>
  typeof p === 'string' &&
  p.length >= 8 &&
  /[A-Za-z]/.test(p) &&
  /\d/.test(p);

const PASSWORD_RULE =
  'Password must be at least 8 characters and include a letter and a number';

// ========================================
// SETUP STATUS
// ========================================

exports.setupStatus = asyncHandler(async (req, res) => {
  res.json({
    needsSetup: (await User.countDocuments()) === 0
  });
});

// ========================================
// REGISTER
// Public registration always creates USER.
// Existing ADMIN accounts remain unchanged.
// ========================================

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body || {};

  const cleanName = cleanStr(name);
  const cleanEmail = cleanStr(email).toLowerCase();

  if (!cleanName || !cleanEmail || !password) {
    throw new AppError(
      'Name, email and password are required',
      400
    );
  }

  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    throw new AppError(
      'Enter a valid email address',
      400
    );
  }

  if (!strongEnough(password)) {
    throw new AppError(PASSWORD_RULE, 400);
  }

  const existingUser = await User.findOne({
    email: cleanEmail
  });

  if (existingUser) {
    throw new AppError(
      'An account with this email already exists',
      409
    );
  }

  // Never accept role from public registration.
  // All newly registered accounts are normal users.
  const user = await User.create({
    name: cleanName,
    email: cleanEmail,
    password,
    role: 'user'
  });

  res.status(201).json({
    message: 'Registration successful. Please sign in.',
    user
  });
});

// ========================================
// LOGIN
// ========================================

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!cleanStr(email) || !password) {
    throw new AppError(
      'Email and password are required',
      400
    );
  }

  const user = await User.findOne({
    email: cleanStr(email).toLowerCase()
  }).select('+password');

  if (
    !user ||
    !(await user.comparePassword(String(password)))
  ) {
    throw new AppError(
      'Incorrect email or password',
      401
    );
  }

  user.lastLoginAt = new Date();
  await user.save();

  res.json({
    message: 'Logged in',
    token: sign(user),
    user
  });
});

// ========================================
// GET CURRENT USER
// ========================================

exports.me = asyncHandler(async (req, res) => {
  res.json({
    user: req.user
  });
});

// ========================================
// UPDATE PROFILE
// Users can update their name only.
// Role and email cannot be changed here.
// ========================================

exports.updateProfile = asyncHandler(async (req, res) => {
  const name = cleanStr((req.body || {}).name);

  if (!name) {
    throw new AppError(
      'Name is required',
      400
    );
  }

  req.user.name = name;

  await req.user.save();

  res.json({
    message: 'Profile updated',
    user: req.user
  });
});

// ========================================
// CHANGE PASSWORD
// ========================================

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    throw new AppError(
      'Current and new password are required',
      400
    );
  }

  if (!strongEnough(newPassword)) {
    throw new AppError(PASSWORD_RULE, 400);
  }

  const user = await User.findById(req.user._id)
    .select('+password');

  if (!user) {
    throw new AppError(
      'User account not found',
      404
    );
  }

  if (
    !(await user.comparePassword(String(currentPassword)))
  ) {
    throw new AppError(
      'Current password is incorrect',
      401
    );
  }

  user.password = newPassword;

  await user.save();

  res.json({
    message: 'Password changed'
  });
});
