
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
                        dataQuery = `SELECT * FROM AccessLog WHERE user_id IN(SELECT user_id From User Where client_id=?) AND TABLE_NAME != 'UserSession'`;
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

            const [activeSessions] = await connection.query(
                `SELECT COUNT(*) as active_session_count FROM UserSession us 
                 WHERE us.user_id IN(SELECT u.user_id FROM User u WHERE u.client_id = ?)
                 AND us.logout_time IS NULL`,
                [clientId]
            );

            const [userCounts] = await connection.query(
                `SELECT 
                    COUNT(*) as total_users,
                    SUM(CASE WHEN tier_level = 1 THEN 1 ELSE 0 END) as tier_1_count,
                    SUM(CASE WHEN tier_level = 2 THEN 1 ELSE 0 END) as tier_2_count,
                    SUM(CASE WHEN tier_level = 3 THEN 1 ELSE 0 END) as tier_3_count,
                    SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_users
                 FROM User WHERE client_id = ?`,
                [clientId]
            );

            let planLimits = [];
            if (clientId !== 1) {
                const [plans] = await connection.query(
                    `SELECT p.plan_id, p.plan_name, COUNT(DISTINCT s.customer_id) AS subscribed
                     FROM Plan p LEFT JOIN Subscription s ON s.plan_id = p.plan_id
                     WHERE p.client_id = ? GROUP BY p.plan_id, p.plan_name`,
                    [clientId]
                );
                planLimits = plans;
            } else {
                const [clientPlans] = await connection.query(
                    `SELECT p.plan_id, p.plan_name, COUNT(DISTINCT s.client_id) AS subscribed
                     FROM Plan p LEFT JOIN Subscription s ON s.plan_id = p.plan_id
                     LEFT JOIN Client c ON s.client_id = c.client_id WHERE c.status = 'Active'
                     GROUP BY p.plan_id, p.plan_name`,
                    []
                );
                planLimits = clientPlans;
            }

            const storageQueries = [
                { table: 'Customer', query: 'SELECT COUNT(*) as count FROM Customer WHERE client_id = ?' },
                { table: 'User', query: 'SELECT COUNT(*) as count FROM User WHERE client_id = ?' },
                { table: 'Subscription', query: 'SELECT COUNT(*) as count FROM Subscription WHERE client_id = ?' },
                { table: 'Invoice', query: 'SELECT COUNT(*) as count FROM Invoice i JOIN Subscription s ON i.subscription_id = s.subscription_id WHERE s.client_id = ?' },
                { table: 'Payment', query: 'SELECT COUNT(*) as count FROM Payment p JOIN Invoice i ON p.invoice_id = i.invoice_id JOIN Subscription s ON i.subscription_id = s.subscription_id WHERE s.client_id = ?' },
                { table: 'AccessLog', query: 'SELECT COUNT(*) as count FROM AccessLog al JOIN User u ON al.user_id = u.user_id WHERE u.client_id = ?' }
            ];

            let storage = 0;
            for (const item of storageQueries) {
                const [result] = await connection.query(item.query, [clientId]);
                storage += (result[0].count || 0) * 100; // Simplified storage estimation
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
