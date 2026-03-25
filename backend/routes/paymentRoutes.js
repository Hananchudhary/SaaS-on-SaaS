const express = require('express');
const { processPayment, getPayment } = require('../controllers/payment');

const router = express.Router();

router.post('/pay', processPayment);
router.get('/pay', getPayment);

module.exports = router;
