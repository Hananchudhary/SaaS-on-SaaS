const express = require('express');
const { login, logout, signup, changePassword } = require('../controllers/authentication');
const { loginLimiter, signupLimiter, logoutLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/login', loginLimiter, login);
router.post('/logout', logoutLimiter, logout);
router.post('/signup', signupLimiter, signup);
router.post('/change-password', changePassword);

module.exports = router;
