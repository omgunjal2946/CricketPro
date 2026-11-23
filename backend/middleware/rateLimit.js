/** Tiny in-memory limiter used for the login endpoint (per IP). */
const hits = new Map();

function loginLimiter({ windowMs = 15 * 60 * 1000, max = 10 } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ message: 'Too many login attempts. Try again in a few minutes.' });
    }
    next();
  };
}

module.exports = { loginLimiter };
