
const { pool, withTransaction } = require('../models/db.js');
const { ErrorCodes, createErrorResponse } = require('../middleware/error_handling.js');

const getTables = async (req, res) => {
    const sessionId = req.headers['x-session-id'];

    if (!sessionId) {
        return res.status(400).json(createErrorResponse(
            ErrorCodes.SESSION_NOT_FOUND
        ));
    }

    try {
        const responseData = await withTransaction(async (connection) => {
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
                 FOR UPDATE`,
                [sessionId]
            );

            if (sessions.length === 0) throw { status: 400, code: ErrorCodes.SESSION_NOT_FOUND };

            const session = sessions[0];
            const clientId = session.client_id;

            if (session.user_status !== 'Active') throw { status: 401, code: ErrorCodes.USER_INACTIVE };
            if (session.client_status !== 'Active') throw { status: 401, code: ErrorCodes.CLIENT_INACTIVE };

            await connection.query('SET @current_user_id = ?', [session.user_id]);

            const [tablesResult] = await connection.query(
                `SELECT 
                    TABLE_NAME 
                 FROM INFORMATION_SCHEMA.TABLES 
                 WHERE TABLE_SCHEMA = ? 
                   AND TABLE_NAME NOT IN ('UserSession', 'Client')
                 ORDER BY TABLE_NAME`,
                [process.env.DB_NAME]
            );

            const result = [];

            for (const table of tablesResult) {
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
                        dataQuery = `SELECT i.* FROM Invoice i JOIN Subscription s ON i.subscription_id = s.subscription_id WHERE s.client_id = ?`;
                        queryParams = [clientId];
                        break;
                    case 'Payment':
                        dataQuery = `SELECT p.* FROM Payment p JOIN Invoice i ON p.invoice_id = i.invoice_id JOIN Subscription s ON i.subscription_id = s.subscription_id WHERE s.client_id = ?`;
                        queryParams = [clientId];
                        break;
                    case 'OverduePenalty':
                        dataQuery = `SELECT op.* FROM OverduePenalty op JOIN Invoice i ON op.invoice_id = i.invoice_id JOIN Subscription s ON i.subscription_id = s.subscription_id WHERE s.client_id = ?`;
                        queryParams = [clientId];
                        break;
                    case 'AccessLog':
                        dataQuery = `SELECT * FROM AccessLog WHERE user_id IN(SELECT user_id From User Where client_id=?) AND table_name != 'UserSession'`;
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

            return { tables: result };
        }, { isolationLevel: 'READ COMMITTED' });

        return res.status(200).json({ success: true, data: responseData });

    } catch (error) {
        if (error.status) return res.status(error.status).json(createErrorResponse(error.code));
        console.error('[Tables] Error:', error);
        return res.status(500).json(createErrorResponse(ErrorCodes.UNKNOWN_ERROR));
    }
};

const getStatics = async (req, res) => {
    const sessionId = req.headers['x-session-id'];

    if (!sessionId) {
        return res.status(400).json(createErrorResponse(
            ErrorCodes.SESSION_NOT_FOUND
        ));
    }

    try {
        const responseData = await withTransaction(async (connection) => {
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

            if (sessions.length === 0) throw { status: 400, code: ErrorCodes.SESSION_NOT_FOUND };

            const session = sessions[0];
            const clientId = session.client_id;

            if (session.user_status !== 'Active') throw { status: 401, code: ErrorCodes.USER_INACTIVE };
            if (session.client_status !== 'Active') throw { status: 401, code: ErrorCodes.CLIENT_INACTIVE };

            await connection.query('SET @current_user_id = ?', [session.user_id]);
            
            let activeSessions = [{ active_session_count: 0 }];
            let userCounts = [{
                total_users: 0,
                tier_1_count: 0,
                tier_2_count: 0,
                tier_3_count: 0,
                active_users: 0
            }];

            if (clientId !== 1) {
                [activeSessions] = await connection.query(
                    `SELECT COALESCE(active_sessions, 0) as active_session_count
                     FROM ClientActiveSessions
                     WHERE client_id = ?`,
                    [clientId]
                );

                [userCounts] = await connection.query(
                    `SELECT 
                        COALESCE(total_users, 0) as total_users,
                        COALESCE(tier_1_count, 0) as tier_1_count,
                        COALESCE(tier_2_count, 0) as tier_2_count,
                        COALESCE(tier_3_count, 0) as tier_3_count,
                        COALESCE(active_users, 0) as active_users
                     FROM ClientUserStats
                     WHERE client_id = ?`,
                    [clientId]
                );
            } else {
                [activeSessions] = await connection.query(
                    `SELECT COALESCE(SUM(active_sessions), 0) as active_session_count
                     FROM ClientActiveSessions`,
                    []
                );
                [userCounts] = await connection.query(
                    `SELECT 
                        COALESCE(SUM(total_users), 0) as total_users,
                        COALESCE(SUM(tier_1_count), 0) as tier_1_count,
                        COALESCE(SUM(tier_2_count), 0) as tier_2_count,
                        COALESCE(SUM(tier_3_count), 0) as tier_3_count,
                        COALESCE(SUM(active_users), 0) as active_users
                     FROM ClientUserStats`,
                    []
                );
            }
            let planLimits = [];
            if (clientId !== 1) {
                const [plans] = await connection.query(
                    `SELECT p.plan_id, p.plan_name, COUNT(DISTINCT s.customer_id) AS subscribed
                     FROM Plan p LEFT JOIN Subscription s ON s.plan_id = p.plan_id LEFT JOIN Customer c
                     ON c.client_id = s.client_id WHERE p.client_id = ? AND s.status = 'Active' AND
                     c.status = 'Active' GROUP BY p.plan_id, p.plan_name`,
                    [clientId]
                );
                planLimits = plans;
            } else {
                const [clientPlans] = await connection.query(
                    `SELECT p.plan_id, p.plan_name, COUNT(DISTINCT s.client_id) AS subscribed
                     FROM Plan p LEFT JOIN Subscription s ON s.plan_id = p.plan_id LEFT JOIN Client c
                     ON s.client_id = c.client_id WHERE c.status = 'Active' AND p.client_id = ?
                     AND s.status = 'Active' GROUP BY p.plan_id, p.plan_name`,
                    [clientId]
                );
                planLimits = clientPlans;
            }

            let storage = 0;
            if (clientId !== 1) {
                const [storageRow] = await connection.query(
                    `SELECT 
                        customer_count,
                        user_count,
                        subscription_count,
                        invoice_count,
                        payment_count,
                        accesslog_count
                     FROM ClientStorageStats
                     WHERE client_id = ?`,
                    [clientId]
                );
                const s = storageRow?.[0] || {};
                storage =
                    (s.customer_count || 0) * 1.736 +
                    (s.user_count || 0) * 0.641 +
                    (s.subscription_count || 0) * 0.048 +
                    (s.invoice_count || 0) * 0.054 +
                    (s.payment_count || 0) * 0.048 +
                    (s.accesslog_count || 0) * 0.098 +
                    (s.plan_count || 0) * 1.645 +
                    (s.overdue_count || 0) * 0.036;
            } else {
                const [storageRow] = await connection.query(
                    `SELECT 
                        COALESCE(SUM(customer_count), 0) as customer_count,
                        COALESCE(SUM(user_count), 0) as user_count,
                        COALESCE(SUM(subscription_count), 0) as subscription_count,
                        COALESCE(SUM(invoice_count), 0) as invoice_count,
                        COALESCE(SUM(payment_count), 0) as payment_count,
                        COALESCE(SUM(accesslog_count), 0) as accesslog_count
                     FROM ClientStorageStats`,
                    []
                );
                const s = storageRow?.[0] || {};
                storage =
                    (s.customer_count || 0) * 1.736 +
                    (s.user_count || 0) * 0.641 +
                    (s.subscription_count || 0) * 0.048 +
                    (s.invoice_count || 0) * 0.054 +
                    (s.payment_count || 0) * 0.048 +
                    (s.accesslog_count || 0) * 0.098 +
                    (s.client_count || 0) * 1.729 +
                    (s.plan_count || 0) * 1.645 +
                    (s.overdue_count || 0) * 0.036;
            }

            await connection.query(
                `INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
                 VALUES (?, 'SELECT', 'ALL', NOW(), 'Success')`,
                [session.user_id]
            );

            return {
                active_sessions: activeSessions[0].active_session_count || 0,
                users: userCounts[0],
                plans: { plans: planLimits },
                storage: storage
            };
        }, { isolationLevel: 'READ COMMITTED' });

        return res.status(200).json({ success: true, data: responseData });

    } catch (error) {
        if (error.status) return res.status(error.status).json(createErrorResponse(error.code));
        console.error('[Statics] Error:', error);
        return res.status(500).json(createErrorResponse(ErrorCodes.UNKNOWN_ERROR));
    }
};

module.exports = {
    getTables,
    getStatics
};
