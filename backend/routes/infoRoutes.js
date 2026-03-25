const express = require('express');
const { getTables, getStatics } = require('../controllers/getinfo');

const router = express.Router();

router.get('/tables', getTables);
router.get('/statics', getStatics);

module.exports = router;
