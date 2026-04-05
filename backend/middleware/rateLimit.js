const { rateLimit } = require('express-rate-limit');
const { ErrorCodes, createErrorResponse } = require('./error_handling');

const keyGenerator = (req, res) => {
  return req.headers['x-session-id'] || req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'global';
};

const createLimiter = (options) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    keyGenerator,
    handler: (req, res) => {
      res.status(429).json(createErrorResponse(ErrorCodes.RATE_LIMITED));
    },
    ...options
  });

const loginLimiter = createLimiter({ 
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    return email ? `login:${email}` : keyGenerator(req);
  }
});
const signupLimiter = createLimiter({ windowMs: 60 * 60 * 1000, max: 5 });
const logoutLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 30 });

const queryLimiter = createLimiter({ windowMs: 60 * 1000, max: 60 });
const exportLimiter = createLimiter({ windowMs: 60 * 1000, max: 10 });

const payPostLimiter = createLimiter({ windowMs: 10 * 60 * 1000, max: 10 });
const payGetLimiter = createLimiter({ windowMs: 60 * 1000, max: 40 });

const tablesLimiter = createLimiter({ windowMs: 60 * 1000, max: 60 });
const staticsLimiter = createLimiter({ windowMs: 60 * 1000, max: 60 });
const systemPlansLimiter = createLimiter({ windowMs: 60 * 60 * 1000, max: 120 });

module.exports = {
  loginLimiter,
  signupLimiter,
  logoutLimiter,
  queryLimiter,
  exportLimiter,
  payPostLimiter,
  payGetLimiter,
  tablesLimiter,
  staticsLimiter,
  systemPlansLimiter,
};
