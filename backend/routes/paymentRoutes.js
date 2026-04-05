const express = require('express');
const { processPayment, getPayment } = require('../controllers/payment');
const { payPostLimiter, payGetLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/pay', payPostLimiter, processPayment);
router.get('/pay', payGetLimiter, getPayment);

module.exports = router;
