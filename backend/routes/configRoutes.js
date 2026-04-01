const express = require('express');
const { getSystemPlans } = require('../controllers/configController');

const router = express.Router();

router.get('/system-plans', getSystemPlans);

module.exports = router;
