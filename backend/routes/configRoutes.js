const express = require('express');
const { getSystemPlans } = require('../controllers/configController');
const { systemPlansLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.get('/system-plans', systemPlansLimiter, getSystemPlans);

module.exports = router;
