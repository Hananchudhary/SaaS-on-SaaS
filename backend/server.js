// server.js
require('dotenv').config({ path: './config.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { ErrorCodes, createErrorResponse } = require('./error_handling');

// Import route handlers
const { login, logout, signup } = require('./authentication');
const { executeQuery } = require('./sqlEditor');
const { getTables, getStatics } = require('./getinfo');
const { processPayment, getPayment } = require('./payment');

const app = express();

// ============================================================
// Security & Utility Middleware
// ============================================================
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting (optional but recommended)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: {
            code: 429,
            message: 'Too many requests, please try again later.',
            timestamp: new Date().toISOString()
        }
    }
});
app.use('/api/', limiter);

app.get('/health', (req, res) => {
    res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// Authentication
app.post('/api/v1/login', login);
app.post('/api/v1/logout', logout);
app.post('/api/v1/signup', signup);

// Query execution
app.post('/api/v1/query', executeQuery);

// Metadata endpoints
app.get('/api/v1/tables', getTables);
app.get('/api/v1/statics', getStatics);

// Payment
app.post('/api/v1/pay', processPayment);
app.get('/api/v1/pay', getPayment);


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