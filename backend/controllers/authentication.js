
const bcrypt = require('bcrypt');
const { withTransaction } = require('../models/db.js');

const { ErrorCodes, createErrorResponse } = require('../middleware/error_handling.js');

const SALT_ROUNDS = 10;
const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json(createErrorResponse(
            ErrorCodes.MISSING_FIELDS
        ));
    }

    try {
        const responseData = await withTransaction(async (connection) => {
            const [users] = await connection.query(
                `SELECT 
                    u.user_id,
                    u.username,
                    u.email,
                    u.password_hash,
                    u.tier_level,
                    u.status AS user_status,
                    u.client_id,
                    c.company_name AS client_name,
                    c.status AS client_status
                 FROM User u
                 JOIN Client c ON u.client_id = c.client_id
                 WHERE u.email = ?`,
                [email]
            );

            if (users.length === 0) {
                throw { status: 400, code: ErrorCodes.INVALID_CREDENTIALS };
            }

            const user = users[0];

            if (user.user_status !== 'Active') throw { status: 401, code: ErrorCodes.USER_INACTIVE };
            if (user.client_status !== 'Active') throw { status: 401, code: ErrorCodes.CLIENT_INACTIVE };

            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            if (!isPasswordValid) throw { status: 400, code: ErrorCodes.INVALID_CREDENTIALS };

            const [prev_inv] = await connection.query(`
                SELECT i.subscription_id, p.monthly_price FROM 
                Invoice i JOIN Subscription s ON 
                s.subscription_id = i.subscription_id JOIN Plan p ON
                p.plan_id = s.plan_id WHERE s.client_id = ? AND 
                DATEDIFF(CURDATE() ,i.invoice_date) > 30 AND i.status = 'Paid' FOR UPDATE
                `, [user.client_id]);
            
            let hasOverdue = false;
            if (prev_inv.length > 0) {
                await connection.query(`
                    INSERT INTO Invoice(subscription_id, due_date, amount)
                    VALUES(?,DATE_ADD(CURDATE(), INTERVAL 2 DAY),?)
                    `, [prev_inv[0].subscription_id, prev_inv[0].monthly_price]);
            } else {
                const [invoiceDue1] = await connection.query(`
                    SELECT i.invoice_id FROM Invoice i JOIN
                    Subscription s ON i.subscription_id = s.subscription_id
                    AND s.client_id = ? AND i.status = 'Pending' AND 
                    DATEDIFF(CURDATE(),i.due_date) > 0 FOR UPDATE
                    `, [user.client_id]);
                if (invoiceDue1.length > 0) {
                    await connection.query(`
                        UPDATE Invoice SET status = 'Overdue' Where invoice_id = ?
                        `, [invoiceDue1[0].invoice_id]);
                } else {
                    const [overdueResult] = await connection.query(
                        `SELECT 
                            COUNT(*) as overdue_count
                         FROM Invoice i
                         JOIN Subscription s ON i.subscription_id = s.subscription_id
                         JOIN OverduePenalty o ON i.invoice_id = o.invoice_id
                         WHERE s.client_id = ? 
                           AND DATEDIFF(CURDATE(), o.created_at) > 2
                           AND s.status = 'Active'
                           AND i.status = 'Overdue'
                           AND o.applied = False`,
                        [user.client_id]
                    );
                    hasOverdue = overdueResult[0].overdue_count > 0;
                }
            }

            const canAccessEditor = !hasOverdue;
            await connection.query('SET @current_user_id = NULL');
        
            const [sessionResult] = await connection.query(
                `INSERT INTO UserSession (user_id, login_time, canAccessEditor)
                 VALUES (?, NOW(), ?)`,
                [user.user_id, canAccessEditor]
            );

            return {
                session_id: sessionResult.insertId,
                username: user.username,
                tier_level: user.tier_level,
                client_id: user.client_id,
                user_id: user.user_id,
                canAccessEditor
            };
        });

        const response = {
            success: true,
            data: {
                session_id: responseData.session_id,
                username: responseData.username,
                tier_level: responseData.tier_level,
                client_id: responseData.client_id,
                user_id: responseData.user_id
            }
        };

        if (!responseData.canAccessEditor) {
            response.data.warning = `Editor access disabled due to overdue invoices. Please settle outstanding payments.`;
        }
        return res.status(200).json(response);

    } catch (error) {
        if (error.status) return res.status(error.status).json(createErrorResponse(error.code));
        
        if (error.message && error.message.includes('chk_duplicate_user')) {
            return res.status(406).json(createErrorResponse(ErrorCodes.USER_ALREADY_ACTIVE));
        }
        
        console.error('[Login] Error:', error);
        return res.status(500).json(createErrorResponse(ErrorCodes.UNKNOWN_ERROR));
    }
};

const logout = async (req, res) => {
    const sessionId = req.headers['x-session-id'];

    if (!sessionId) {
        return res.status(401).json(createErrorResponse(
            ErrorCodes.SESSION_NOT_FOUND
        ));
    }

    try {
        await withTransaction(async (connection) => {
            await connection.query('SET @current_user_id = NULL');

            const [sessions] = await connection.query(
                `SELECT * FROM UserSession WHERE session_id = ? FOR UPDATE`, 
                [sessionId]
            );

            if (sessions.length === 0) {
                throw { status: 401, code: ErrorCodes.SESSION_NOT_FOUND };
            }

            const [updateResult] = await connection.query(
                `UPDATE UserSession SET logout_time = GREATEST(NOW(), DATE_ADD(login_time, INTERVAL 1 SECOND)) WHERE session_id = ?`,
                [sessionId]
            );

            if (updateResult.affectedRows === 0) {
                throw { status: 500, code: ErrorCodes.LOGOUT_FAILED };
            }
        }, { isolationLevel: 'REPEATABLE READ' });

        return res.status(200).json({ success: true });

    } catch (error) {
        if (error.status) return res.status(error.status).json(createErrorResponse(error.code));
        console.error('[Logout] Error:', error);
        return res.status(500).json(createErrorResponse(ErrorCodes.UNKNOWN_ERROR));
    }
};

const signup = async (req, res) => {
    const {
        company_name, email, phone, address,
        plan_id,
        plan_name1, tier1_users_plan1, tier2_users_plan1, tier3_users_plan1, price_plan1,
        plan_name2, tier1_users_plan2, tier2_users_plan2, tier3_users_plan2, price_plan2,
        plan_name3, tier1_users_plan3, tier2_users_plan3, tier3_users_plan3, price_plan3,
        username, admin_email, password
    } = req.body;

    try {
    const requiredFields = [
        'company_name', 'email', 'plan_id',
        'plan_name1', 'tier1_users_plan1', 'tier2_users_plan1', 'tier3_users_plan1', 'price_plan1',
        'plan_name2', 'tier1_users_plan2', 'tier2_users_plan2', 'tier3_users_plan2', 'price_plan2',
        'plan_name3', 'tier1_users_plan3', 'tier2_users_plan3', 'tier3_users_plan3', 'price_plan3',
        'username', 'admin_email', 'password'
    ];

    for (const field of requiredFields) {
        if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
            return res.status(400).json(createErrorResponse(
                ErrorCodes.MISSING_FIELDS,
                `Missing required field: ${field}`
            ));
        }
    }
        await withTransaction(async (connection) => {
            await connection.query('SET @current_user_id = NULL');

            const [existingClient] = await connection.query(
                `SELECT client_id FROM Client WHERE email = ? FOR UPDATE`, [email]
            );
            if (existingClient.length > 0) throw { status: 400, code: ErrorCodes.CLIENT_ALREADY_EXISTS };

            const [existingUser] = await connection.query(
                `SELECT user_id FROM User WHERE username = ? FOR UPDATE`, [username]
            );
            if (existingUser.length > 0) throw { status: 400, code: ErrorCodes.USERNAME_ALREADY_EXISTS };

            const [existingAdminEmail] = await connection.query(
                `SELECT user_id FROM User WHERE email = ? FOR UPDATE`, [admin_email]
            );
            if (existingAdminEmail.length > 0) throw { status: 400, code: ErrorCodes.EMAIL_ALREADY_EXISTS };

            const [clientResult] = await connection.query(
                `INSERT INTO Client (company_name, email, phone, address) VALUES (?, ?, ?, ?)`,
                [company_name, email, phone || null, address || null]
            );
            const newClientId = clientResult.insertId;

            const planValues = [
                [plan_name1, tier1_users_plan1, tier2_users_plan1, tier3_users_plan1, price_plan1],
                [plan_name2, tier1_users_plan2, tier2_users_plan2, tier3_users_plan2, price_plan2],
                [plan_name3, tier1_users_plan3, tier2_users_plan3, tier3_users_plan3, price_plan3]
            ];

            for (const plan of planValues) {
                await connection.query(
                    `INSERT INTO Plan (client_id, plan_name, tier_1_users, tier_2_users, tier_3_users, monthly_price) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [newClientId, plan[0], plan[1], plan[2], plan[3], plan[4]]
                );
            }

            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            await connection.query(
                `INSERT INTO User (client_id, username, email, password_hash, tier_level, status, created_by) 
                 VALUES (?, ?, ?, ?, ?, 'Active', 1)`,
                [newClientId, username, admin_email, hashedPassword, 1]
            );

            await connection.query(
                `INSERT INTO Subscription (client_id, plan_id, end_date) 
                 VALUES (?, ?, DATE_ADD(CURRENT_DATE(), INTERVAL 1 month))`,
                [newClientId, plan_id]
            );
        }, { isolationLevel: 'SERIALIZABLE' });

        return res.status(200).json({ success: true });

    } catch (error) {
        if (error.status) return res.status(error.status).json(createErrorResponse(error.code));
        
        if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || (error.message && error.message.includes('Check constraint'))) {
            return res.status(400).json(createErrorResponse(ErrorCodes.CHECK_CONSTRAINT_VIOLATION));
        }
        
        console.error('[Signup] Error:', error);
        return res.status(500).json(createErrorResponse(ErrorCodes.UNKNOWN_ERROR));
    }
};

module.exports = {
    login,
    logout,
    signup
};
