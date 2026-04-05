const express = require('express');
const { login, logout, signup, changePassword, requestOTP } = require('../controllers/authentication');
const { loginLimiter, signupLimiter, logoutLimiter, OTPLimiter, changePasswordLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/login', loginLimiter, login);
router.post('/logout', logoutLimiter, logout);
router.post('/signup', signupLimiter, signup);
router.post('/signup/request-otp', OTPLimiter, requestOTP);
router.post('/change-password',changePasswordLimiter, changePassword);

module.exports = router;
