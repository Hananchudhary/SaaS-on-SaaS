// server.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './config.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { ErrorCodes, createErrorResponse } = require('./middleware/error_handling');

// Import routes
const authRoutes = require('./routes/authRoutes');
const queryRoutes = require('./routes/queryRoutes');
const infoRoutes = require('./routes/infoRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const healthRoutes = require('./routes/healthRoutes');
const configRoutes = require('./routes/configRoutes');

const app = express();

// Ensure stable client IPs for rate limiting when behind proxies
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', healthRoutes);
app.use('/api/v1', authRoutes);
app.use('/api/v1', queryRoutes);
app.use('/api/v1', infoRoutes);
app.use('/api/v1', paymentRoutes);
app.use('/api/v1', configRoutes);


// ============================================================
// 404 Handler
// ============================================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 404,
            message: `Cannot ${req.method} ${req.originalUrl}`,
            timestamp: new Date().toISOString()
        }
    });
});

// ============================================================
// Global Error Handler
// ============================================================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json(createErrorResponse(
        ErrorCodes.UNKNOWN_ERROR
    ));
});

// ============================================================
// Start Server
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Export for testing
module.exports = app;
