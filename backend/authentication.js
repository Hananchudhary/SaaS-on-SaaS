
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('./db.js');

const { ErrorCodes, createErrorResponse } = require('./error_handling.js');

const SALT_ROUNDS = 10;
const login = async (req, res) => {
    const { email, password } = req.body;
    let connection;

    try {
        if (!email || !password) {
            return res.status(400).json(createErrorResponse(
                ErrorCodes.MISSING_FIELDS
            ));
        }
        // Get database connection
        connection = await pool.getConnection();
        if (!connection) {
            return res.status(500).json(createErrorResponse(
                ErrorCodes.INTERNAL_ERROR
            ));
        }
        // await connection.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        await connection.beginTransaction();

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

        // Check if user exists
        if (users.length === 0) {
            return res.status(400).json(createErrorResponse(
                ErrorCodes.INVALID_CREDENTIALS
            ));
        }

        const user = users[0];

        if (user.user_status !== 'Active') {
            return res.status(401).json(createErrorResponse(
                ErrorCodes.USER_INACTIVE
            ));
        }

        if (user.client_status !== 'Active') {
            return res.status(401).json(createErrorResponse(
                ErrorCodes.CLIENT_INACTIVE
            ));
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(400).json(createErrorResponse(
                ErrorCodes.INVALID_CREDENTIALS
            ));
        }

        const [prev_inv] = await connection.query(`
            SELECT i.subscription_id, p.monthly_price FROM 
            Invoice i JOIN Subscription s ON 
            s.subscription_id = i.subscription_id JOIN Plan p ON
            p.plan_id = s.plan_id WHERE s.client_id = ? AND 
            DATEDIFF(CURDATE() ,i.invoice_date) > 30 AND i.status = 'Paid' FOR UPDATE
            `, [user.client_id]);

        let hasOverdue = null;
        if (prev_inv.length > 0) {
            await connection.query(`
                INSERT INTO Invoice(subscription_id, due_date, amount)
                VALUES(?,DATE_ADD(CURDATE(), INTERVAL 2 DAY),?)
                `, [prev_inv[0].subscription_id, prev_inv[0].monthly_price]);
        }
        else {
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
            }
            else {
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
                hasOverdue = overdueResult[0].overdue_count > 0

            }
        }

        // Determine if user can access editor
        const canAccessEditor = !hasOverdue
        await connection.query('SET @current_user_id = NULL');

        // Insert session
        const [sessionResult] = await connection.query(
            `INSERT INTO UserSession (user_id, login_time, canAccessEditor)
             VALUES (?, NOW(), ?)`,
            [user.user_id, canAccessEditor]
        );

        await connection.commit();


        const sessionID = sessionResult.insertId;

        const responseData = {
            success: true,
            data: {
                session_id: sessionID,
                username: user.username,
                tier_level: user.tier_level,
                client_id: user.client_id,
                user_id: user.user_id
            }
        };

        if (!canAccessEditor) {
            responseData.data.warning = `Editor access disabled due to overdue invoices. Please settle outstanding payments.`;
        }

        return res.status(200).json(responseData);

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
                console.log(`[Login] Transaction rolled back due to error: ${error.message}`);
            } catch (rollbackError) {
                console.error('[Login] Rollback failed:', rollbackError);
            }
        }
        if (error.message.includes('chk_duplicate_user')) {
            return res.status(406).json(createErrorResponse(
                ErrorCodes.USER_ALREADY_ACTIVE
            ));
        }

        if (error.code === 'ER_NO_SUCH_TABLE') {
            return res.status(500).json(createErrorResponse(
                ErrorCodes.LOGIN_FAILED
            ));
        }

        if (error.message.includes('Failed to insert session')) {
            return res.status(500).json(createErrorResponse(
                ErrorCodes.SESSION_CREATION_FAILED
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

const logout = async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    let connection;

    try {
        if (!sessionId) {
            return res.status(401).json(createErrorResponse(
                ErrorCodes.SESSION_NOT_FOUND
            ));
        }

        connection = await pool.getConnection();
        if (!connection) {
            return res.status(500).json(createErrorResponse(
                ErrorCodes.INTERNAL_ERROR
            ));
        }
        // await connection.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

        await connection.beginTransaction();
        await connection.query('SET @current_user_id = NULL');

        const [sessions] = await connection.query(
            `SELECT *
             FROM UserSession
             WHERE session_id = ? 
             FOR UPDATE`,
            [sessionId]
        );

        if (sessions.length === 0) {
            await connection.rollback();
            return res.status(401).json(createErrorResponse(
                ErrorCodes.SESSION_NOT_FOUND
            ));
        }


        const [updateResult] = await connection.query(
            `UPDATE UserSession 
             SET logout_time = NOW() 
             WHERE session_id = ?`,
            [sessionId]
        );

        if (updateResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(500).json(createErrorResponse(
                ErrorCodes.LOGOUT_FAILED
            ));
        }

        await connection.commit();
        console.log(`[Logout] Transaction committed for session: ${sessionId}`);

        return res.status(200).json({
            success: true
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
                console.log(`[Logout] Transaction rolled back due to error: ${error.message}`);
            } catch (rollbackError) {
                console.error('[Logout] Rollback failed:', rollbackError);
            }
        }

        console.error('[Logout] Error:', {
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
            console.log(`[Logout] Connection released for session: ${sessionId}`);
        }
    }
};

const signup = async (req, res) => {
    const {
        company_name,
        email,
        phone,
        address,

        // Selected plan ID for subscription
        plan_id,

        // Custom plan 1 details
        plan_name1,
        tier1_users_plan1,
        tier2_users_plan1,
        tier3_users_plan1,
        price_plan1,

        // Custom plan 2 details
        plan_name2,
        tier1_users_plan2,
        tier2_users_plan2,
        tier3_users_plan2,
        price_plan2,

        // Custom plan 3 details
        plan_name3,
        tier1_users_plan3,
        tier2_users_plan3,
        tier3_users_plan3,
        price_plan3,

        // Admin user details
        username,
        admin_email,
        password
    } = req.body;
    let connection;

    try {
        const requiredFields = {
            company_name,
            email,
            plan_id,
            plan_name1, tier1_users_plan1, tier2_users_plan1, tier3_users_plan1, price_plan1,
            plan_name2, tier1_users_plan2, tier2_users_plan2, tier3_users_plan2, price_plan2,
            plan_name3, tier1_users_plan3, tier2_users_plan3, tier3_users_plan3, price_plan3,
            username,
            admin_email,
            password
        };

        const missingFields = [];
        for (const [field, value] of Object.entries(requiredFields)) {
            if (!value && value !== 0) { // Allow 0 for numeric fields
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            // ERROR: REQUIRED_FIELDS_MISSING (new error code needed)
            return res.status(400).json(createErrorResponse(
                ErrorCodes.MISSING_FIELDS
            ));
        }

        connection = await pool.getConnection();
        if (!connection) {
            return res.status(500).json(createErrorResponse(
                ErrorCodes.INTERNAL_ERROR
            ));
        }

        // await connection.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        await connection.beginTransaction();
        await connection.query('SET @current_user_id = NULL');

        const [existingClient] = await connection.query(
            `SELECT client_id FROM Client WHERE email = ? FOR UPDATE`,
            [email]
        );

        if (existingClient.length > 0) {
            await connection.query('ROLLBACK');
            return res.status(400).json(createErrorResponse(
                ErrorCodes.CLIENT_ALREADY_EXISTS
            ));
        }

        const [existingUser] = await connection.query(
            `SELECT user_id FROM User WHERE username = ? FOR UPDATE`,
            [username]
        );

        if (existingUser.length > 0) {
            await connection.query('ROLLBACK');
            return res.status(400).json(createErrorResponse(
                ErrorCodes.USERNAME_ALREADY_EXISTS
            ));
        }

        const [existingAdminEmail] = await connection.query(
            `SELECT user_id FROM User WHERE email = ? FOR UPDATE`,
            [admin_email]
        );

        if (existingAdminEmail.length > 0) {
            await connection.query('ROLLBACK');
            return res.status(400).json(createErrorResponse(
                ErrorCodes.EMAIL_ALREADY_EXISTS
            ));
        }

        const [clientResult] = await connection.query(
            `INSERT INTO Client (
                company_name, 
                email, 
                phone, 
                address
            ) VALUES (?, ?, ?, ?)`,
            [company_name, email, phone || null, address || null]
        );

        const newClientId = clientResult.insertId;
        console.log(`[Signup] Client inserted with ID: ${newClientId}`);

        const planValues = [
            [plan_name1, tier1_users_plan1, tier2_users_plan1, tier3_users_plan1, price_plan1],
            [plan_name2, tier1_users_plan2, tier2_users_plan2, tier3_users_plan2, price_plan2],
            [plan_name3, tier1_users_plan3, tier2_users_plan3, tier3_users_plan3, price_plan3]
        ];

        const planIds = [];

        for (let i = 0; i < planValues.length; i++) {
            const plan = planValues[i];
            const [planResult] = await connection.query(
                `INSERT INTO Plan (
                    client_id, 
                    plan_name,
                    tier_1_users, 
                    tier_2_users, 
                    tier_3_users, 
                    monthly_price,
                    description
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [newClientId, plan[0], plan[1], plan[2], plan[3], plan[4], null]
            );

            planIds.push(planResult.insertId);
            console.log(`[Signup] Plan ${i + 1} inserted with ID: ${planResult.insertId}`);
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const [userResult] = await connection.query(
            `INSERT INTO User (
                client_id,
                username,
                email,
                password_hash,
                tier_level,
                status,
                created_at,
                created_by
            ) VALUES (?, ?, ?, ?, ?, 'Active', CURRENT_TIMESTAMP, ?)`,
            [newClientId, username, admin_email, hashedPassword, 1, 1] // tier_level = 1 for admin
        );

        const newUserId = userResult.insertId;
        console.log(`[Signup] Admin user inserted with ID: ${newUserId}`);

        const [subscriptionResult] = await connection.query(
            `INSERT INTO Subscription (
                client_id,
                customer_id,
                plan_id,
                end_date
            ) VALUES (?, NULL, ?, DATE_ADD(CURRENT_DATE(), INTERVAL 1 month))`,
            [newClientId, plan_id]
        );

        const newSubscriptionId = subscriptionResult.insertId;
        console.log(`[Signup] Subscription inserted with ID: ${newSubscriptionId}`);

        await connection.commit();

        const responseData = {
            success: true
        };
        console.log('sign up successfully done')
        return res.status(200).json(responseData);

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
                console.log('[Signup] Transaction rolled back due to error');
            } catch (rollbackError) {
                console.error('[Signup] Rollback failed:', rollbackError);
            }
        }

        console.error('[Signup] Error:', {
            message: error.message,
            stack: error.stack,
            company_email: email
        });

        if (error.code === '40001') { // PostgreSQL serialization failure
            return res.status(500).json(createErrorResponse(
                { code: 409, message: 'Concurrent signup detected. Please try again.' }
            ));
        }

        if (error.code === '23503') { // PostgreSQL foreign key violation
            if (error.constraint === 'fk_subscription_plan') {
                return res.status(400).json(createErrorResponse(
                    ErrorCodes.CHECK_CONSTRAINT_VIOLATION
                ));
            }
        }

        if (error.code === '23514' || error.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || (error.message && error.message.includes('Check constraint'))) { // PostgreSQL or MySQL check violation
            // ERROR: CHECK_CONSTRAINT_VIOLATION (new error code needed)
            return res.status(400).json(createErrorResponse(
                ErrorCodes.CHECK_CONSTRAINT_VIOLATION
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
    login,
    logout,
    signup
};
