const express = require('express');
const { login, logout, signup, changePassword, requestOTP } = require('../controllers/authentication');
const { loginLimiter, signupLimiter, logoutLimiter, OTPLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/login', loginLimiter, login);
router.post('/logout', logoutLimiter, logout);
router.post('/signup', signupLimiter, signup);
router.post('/signup/request-otp', signupLimiter, requestOTP);
router.post('/change-password', changePassword);

module.exports = router;
