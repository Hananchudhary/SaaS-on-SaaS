const express = require('express');
const { getTables, getStatics } = require('../controllers/getinfo');
const { tablesLimiter, staticsLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.get('/tables', tablesLimiter, getTables);
router.get('/statics', staticsLimiter, getStatics);

module.exports = router;
