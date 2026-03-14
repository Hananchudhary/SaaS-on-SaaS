// config/db.js
require('dotenv').config({ path: './config.env' });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

/**
 * Execute a callback within a transaction with optional automatic retries for deadlocks.
 * @param {Function} callback - Function(connection) returning a Promise.
 * @param {Object} options - { isolationLevel: 'SERIALIZABLE'|'REPEATABLE READ'|..., maxRetries: 3 }
 */
const withTransaction = async (callback, options = {}) => {
    const { isolationLevel, maxRetries = 3 } = options;
    let attempt = 0;

    while (attempt < maxRetries) {
        let connection;
        try {
            connection = await pool.getConnection();
            
            if (isolationLevel) {
                await connection.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
            }
            
            await connection.query('START TRANSACTION');
            
            const result = await callback(connection);
            
            await connection.query('COMMIT');
            return result;
        } catch (error) {
            if (connection) {
                try {
                    await connection.query('ROLLBACK');
                } catch (rollbackError) {
                    console.error('[Transaction] Rollback failed:', rollbackError);
                }
            }

            const isDeadlock = error.code === 'ER_LOCK_DEADLOCK' || error.errno === 1213;
            if (isDeadlock && attempt < maxRetries - 1) {
                attempt++;
                console.warn(`[Transaction] Deadlock detected. Retrying attempt ${attempt}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, Math.random() * 100 * attempt));
                continue;
            }
            if (!isDeadlock || attempt === maxRetries - 1) {
                if (error.code !== 503 && error.status !== 503 && (error.code && error.code.code !== 503)) {
                     console.error('[Transaction] Error occurred:', error);
                }
            }
            
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
};

module.exports = {
    pool,
    withTransaction
};
