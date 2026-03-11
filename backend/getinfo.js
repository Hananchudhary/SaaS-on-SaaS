
const pool = require('./db.js');
const { ErrorCodes, createErrorResponse } = require('./error_handling.js');

const getTables = async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    let connection;

    try {
        if (!sessionId) {
            return res.status(400).json(createErrorResponse(
                ErrorCodes.SESSION_NOT_FOUND
            ));
        }

        connection = await pool.getConnection();
        if (!connection) {
            return res.status(500).json(createErrorResponse(
                ErrorCodes.INTERNAL_ERROR
            ));
        }

        // await connection.query('SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
        await connection.beginTransaction();

        const [sessions] = await connection.query(
            `SELECT 
                us.*,
                u.client_id as client_id, 
                u.user_id,
                u.tier_level,
                u.status as user_status,
                c.status as client_status
             FROM UserSession us
             JOIN User u ON us.user_id = u.user_id
             JOIN Client c ON u.client_id = c.client_id
             WHERE us.session_id = ? 
               AND us.logout_time IS NULL
             FOR UPDATE`, // Row-level lock to ensure session is valid
            [sessionId]
        );

        if (sessions.length === 0) {
            await connection.rollback();
            return res.status(400).json(createErrorResponse(
                ErrorCodes.SESSION_NOT_FOUND
            ));
        }

        const session = sessions[0];
        const clientId = session.client_id;

        // Check if user is active
        if (session.user_status !== 'Active') {
            await connection.rollback();
            return res.status(401).json(createErrorResponse(
                ErrorCodes.USER_INACTIVE
            ));
        }
        if (session.client_status !== 'Active') {
            await connection.rollback();
            return res.status(401).json(createErrorResponse(
                ErrorCodes.CLIENT_INACTIVE
            ));
        }

        await connection.query('SET @current_user_id = ?', [session.user_id]);

        console.log(`[Tables] Access granted for client_id: ${clientId}, user_id: ${session.user_id}`);

        const [tables] = await connection.query(
            `SELECT 
                TABLE_NAME 
             FROM INFORMATION_SCHEMA.TABLES 
             WHERE TABLE_SCHEMA = ? 
               AND TABLE_NAME NOT IN ('UserSession', 'Client')
             ORDER BY TABLE_NAME`,
            [process.env.DB_NAME]
        );

        const result = [];

        for (const table of tables) {
            const tableName = table.TABLE_NAME;
            
            const [columns] = await connection.query(
                `SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    IS_NULLABLE,
                    COLUMN_KEY,
                    EXTRA
                 FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_SCHEMA = ? 
                   AND TABLE_NAME = ?
                 ORDER BY ORDINAL_POSITION`,
                [process.env.DB_NAME, tableName]
            );

            let dataQuery = '';
            let queryParams = [];

            switch (tableName) {
                case 'Plan':
                    dataQuery = `SELECT * FROM Plan WHERE client_id = ?`;
                    queryParams = [clientId];
                    break;

                case 'Customer':
                    dataQuery = `SELECT * FROM Customer WHERE client_id = ?`;
                    queryParams = [clientId];
                    break;

                case 'User':
                    dataQuery = `SELECT * FROM User WHERE client_id = ?`;
                    queryParams = [clientId];
                    break;

                case 'Subscription':
                    dataQuery = `SELECT * FROM Subscription WHERE client_id = ?`;
                    queryParams = [clientId];
                    break;

                case 'Invoice':
                    dataQuery = `SELECT i.* 
                                 FROM Invoice i
                                 JOIN Subscription s ON i.subscription_id = s.subscription_id
                                 WHERE s.client_id = ?`;
                    queryParams = [clientId];
                    break;

                case 'Payment':
                    dataQuery = `SELECT p.* 
                                 FROM Payment p
                                 JOIN Invoice i ON p.invoice_id = i.invoice_id
                                 JOIN Subscription s ON i.subscription_id = s.subscription_id
                                 WHERE s.client_id = ?`;
                    queryParams = [clientId];
                    break;

                case 'OverduePenalty':
                    dataQuery = `SELECT op.* 
                                 FROM OverduePenalty op
                                 JOIN Invoice i ON op.invoice_id = i.invoice_id
                                 JOIN Subscription s ON i.subscription_id = s.subscription_id
                                 WHERE s.client_id = ?`;
                    queryParams = [clientId];
                    break;

                case 'AccessLog':
                    dataQuery = `SELECT * FROM AccessLog WHERE
                                 user_id IN(SELECT user_id From User Where client_id=?)`;
                    queryParams = [clientId];
                    break;

                default:
                    continue;
            }

            if (dataQuery) {
                
                const [rows] = await connection.query(dataQuery, queryParams);
                
                result.push({
                    table_name: tableName,
                    columns: columns.map(col => ({
                        name: col.COLUMN_NAME,
                        data_type: col.DATA_TYPE,
                        nullable: col.IS_NULLABLE === 'YES',
                        is_primary: col.COLUMN_KEY === 'PRI'
                    })),
                    row_count: rows.length,
                    data: rows
                });
            }
        }

        await connection.query(
            `INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
             VALUES (?, 'SELECT', 'ALL', NOW(), 'Success')`,
            [session.user_id]
        );

        await connection.commit();

        return res.status(200).json({
            success: true,
            data: {
                tables: result
            }
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('[Tables] Rollback failed:', rollbackError);
            }
        }

        console.error('[Tables] Error:', {
            message: error.message,
            stack: error.stack,
            sessionId: sessionId
        });

        return res.status(500).json(createErrorResponse(
            ErrorCodes.UNKNOWN_ERROR
        ));

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

const getStatics = async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    let connection;

    try {
        if (!sessionId) {
            return res.status(400).json(createErrorResponse(
                ErrorCodes.SESSION_NOT_FOUND
            ));
        }

        // Get database connection
        connection = await pool.getConnection();
        if (!connection) {
            return res.status(500).json(createErrorResponse(
                ErrorCodes.INTERNAL_ERROR
            ));
        }
        // await connection.query('SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
        await connection.beginTransaction();

        // Lock the session row to prevent concurrent modifications
        const [sessions] = await connection.query(
            `SELECT 
                us.*,
                u.client_id,
                u.user_id,
                u.tier_level,
                u.status as user_status,
                c.status as client_status
             FROM UserSession us
             JOIN User u ON us.user_id = u.user_id
             JOIN Client c ON u.client_id = c.client_id
             WHERE us.session_id = ? 
               AND us.logout_time IS NULL
             FOR UPDATE`,
            [sessionId]
        );

        if (sessions.length === 0) {
            await connection.rollback();
            return res.status(400).json(createErrorResponse(
                ErrorCodes.SESSION_NOT_FOUND
            ));
        }

        const session = sessions[0];
        const clientId = session.client_id;
        const isSystemClient = clientId === 1;

        // Check if user is active
        if (session.user_status !== 'Active') {
            await connection.rollback();
            return res.status(401).json(createErrorResponse(
                ErrorCodes.USER_INACTIVE
            ));
        }
        if (session.client_status !== 'Active') {
            await connection.rollback();
            return res.status(401).json(createErrorResponse(
                ErrorCodes.CLIENT_INACTIVE
            ));
        }

        await connection.query('SET @current_user_id = ?', [session.user_id]);

        console.log(`[Statics] Access granted for client_id: ${clientId}, isSystem: ${isSystemClient}`);

        const [activeSessions] = await connection.query(
            `SELECT 
                COUNT(*) as active_session_count FROM UserSession us 
                WHERE us.user_id IN(SELECT u.user_id FROM User u WHERE
                u.client_id = ?)`,
            [clientId]
        );

        const [userCounts] = await connection.query(
            `SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN tier_level = 1 THEN 1 ELSE 0 END) as tier_1_count,
                SUM(CASE WHEN tier_level = 2 THEN 1 ELSE 0 END) as tier_2_count,
                SUM(CASE WHEN tier_level = 3 THEN 1 ELSE 0 END) as tier_3_count,
                SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_users,
                SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) as inactive_users,
                SUM(CASE WHEN status = 'Suspended' THEN 1 ELSE 0 END) as suspended_users
             FROM User
             WHERE client_id = ?`,
            [clientId]
        );

        let planLimits = null;
        if (!isSystemClient) {
            // For regular clients, get their current plan limits
            const [plans] = await connection.query(
                `SELECT 
                    p.plan_id,
                    p.plan_name as plan_naam,
                    COUNT(DISTINCT s.customer_id) AS subscribed
                 FROM Plan p
                 LEFT JOIN Subscription s ON s.plan_id = p.plan_id
                 WHERE p.client_id = ?
                 GROUP BY p.plan_id, p.plan_name
                 ORDER BY p.plan_id`,
                [clientId]
            );

            planLimits = plans;
        }
        else {

            const [clientPlans] = await connection.query(
                `SELECT 
                    p.plan_id,
                    p.plan_name,
                    COUNT(DISTINCT s.client_id) AS subscribed
                 FROM Plan p
                 LEFT JOIN Subscription s ON s.plan_id = p.plan_id
                 LEFT JOIN Client c ON s.client_id = c.client_id
                 WHERE c.status = 'Active'
                 GROUP BY p.plan_id, p.plan_name
                 ORDER BY p.plan_id`,
                []
            );
            planLimits = clientPlans;
        }

        const userStats = {
            total_users: userCounts[0].total_users || 0,
            tier_1_count: userCounts[0].tier_1_count || 0,
            tier_2_count: userCounts[0].tier_2_count || 0,
            tier_3_count: userCounts[0].tier_3_count || 0,
            active_users: userCounts[0].active_users || 0
        };

        const planStats = {
            plans: planLimits.map(p => ({
                plan_id: p.plan_id,
                plan_name: p.plan_name,
                subscribed: p.subscribed
            }))
        };
        const storageQueries = [
            { table: 'Customer', query: 'SELECT COUNT(*) as count FROM Customer WHERE client_id = ?' },
            { table: 'User', query: 'SELECT COUNT(*) as count FROM User WHERE client_id = ?' },
            { table: 'Subscription', query: 'SELECT COUNT(*) as count FROM Subscription WHERE client_id = ?' },
            { table: 'Invoice', query: `SELECT COUNT(*) as count FROM Invoice i 
                                         JOIN Subscription s ON i.subscription_id = s.subscription_id 
                                         WHERE s.client_id = ?` },
            { table: 'Payment', query: `SELECT COUNT(*) as count FROM Payment p 
                                        JOIN Invoice i ON p.invoice_id = i.invoice_id
                                        JOIN Subscription s ON i.subscription_id = s.subscription_id 
                                        WHERE s.client_id = ?` },
            { table: 'OverduePenalty', query: `SELECT COUNT(*) as count FROM OverduePenalty op
                                               JOIN Invoice i ON op.invoice_id = i.invoice_id
                                               JOIN Subscription s ON i.subscription_id = s.subscription_id 
                                               WHERE s.client_id = ?` },
            { table: 'AccessLog', query: `SELECT COUNT(*) as count FROM AccessLog al
                                          JOIN User u ON al.user_id = u.user_id
                                          WHERE u.client_id = ?` }
        ];

        let storag = 0;
        for (const item of storageQueries) {
            const [result] = await connection.query(item.query, [clientId]);
            const count = result[0].count || 0;
            
            const [rows] = await connection.query(
                `SELECT * FROM ${item.table} LIMIT 1`
            );

            storag += (Buffer.byteLength(JSON.stringify(rows)) * count);
        }
        await connection.query(
            `INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
             VALUES (?, 'SELECT', 'ALL', NOW(), 'Success')`,
            [session.user_id]
        );

        // Commit the transaction
        await connection.commit();

        const responseData = {
            success: true,
            data: {
                active_sessions: activeSessions[0].active_session_count || 0,
                users: userStats,
                storage: storag,
                plans: planStats
            }
        };

        return res.status(200).json(responseData);

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('[Statics] Rollback failed:', rollbackError);
            }
        }

        console.error('[Statics] Error:', {
            message: error.message,
            stack: error.stack,
            sessionId: sessionId
        });

        // Handle MySQL specific errors
        if (error.code === 'ER_LOCK_DEADLOCK') {
            return res.status(500).json(createErrorResponse(
                ErrorCodes.INTERNAL_ERROR
            ));
        }

        if (error.code === 'ER_LOCK_WAIT_TIMEOUT') {
            return res.status(500).json(createErrorResponse(
                ErrorCodes.INTERNAL_ERROR
            ));
        }

        return res.status(500).json(createErrorResponse(
            ErrorCodes.UNKNOWN_ERROR
        ));

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = {
    getTables,
    getStatics
};