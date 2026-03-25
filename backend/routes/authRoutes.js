const express = require('express');
const { login, logout, signup } = require('../controllers/authentication');

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/signup', signup);

module.exports = router;
