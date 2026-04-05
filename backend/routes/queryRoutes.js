const express = require('express');
const { executeQuery, exportData } = require('../controllers/sqlEditor');
const { queryLimiter, exportLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/query', queryLimiter, executeQuery);
router.post('/exportData', exportLimiter, exportData);

module.exports = router;
