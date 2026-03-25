const express = require('express');
const { executeQuery, exportData } = require('../controllers/sqlEditor');

const router = express.Router();

router.post('/query', executeQuery);
router.post('/exportData', exportData);

module.exports = router;
