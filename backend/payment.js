
const pool = require('./db');
const { ErrorCodes, createErrorResponse } = require('./error_handling');
const overDuePricePerday = 0.002;
const getPayment = async (req, res) => {
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
                u.client_id,
                u.user_id,
                u.tier_level,
                u.status as user_status, 
                c.status as client_status
             FROM UserSession us
             JOIN User u ON us.user_id = u.user_id
             JOIN Client c ON c.client_id = u.client_id
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
        const userId = session.user_id;

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

        // Set session variable for triggers
        await connection.query('SET @current_user_id = ?', [userId]);

        console.log(`[Pay] Processing payment for client_id: ${clientId}, user_id: ${userId}`);

        const [planResult] = await connection.query(`
            SELECT p.monthly_price FROM Plan p JOIN Subscription s ON
            p.plan_id = s.plan_id WHERE s.client_id = ? AND s.status = 'Active'
            `, [clientId]);
        const [overdueResult] = await connection.query(
            `SELECT DATEDIFF(CURDATE(),o.penalty_date) as days FROM Invoice i 
            JOIN Subscription s ON i.subscription_id = s.subscription_id JOIN 
            OverduePenalty o ON o.invoice_id = i.invoice_id WHERE s.client_id = ? 
            AND i.status ='Overdue' AND o.applied = False`,
            [clientId]
        );
        if (planResult.length === 0) {
            await connection.rollback();
            return res.status(400).json(createErrorResponse(
                ErrorCodes.INVALID_PLAN_ID
            ));
        }
        const daysSincePenalty = (overdueResult.length > 0) ? overdueResult[0].days : 0;
        const planPrice = parseFloat(planResult[0].monthly_price);
        const OverDueCharges = daysSincePenalty * (overDuePricePerday * planPrice);
        await connection.commit();

        const responseData = {
            success: true,
            plan_amount: planPrice,
            overdue_fine: OverDueCharges
        };

        return res.status(200).json(responseData);

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
                console.log('[Pay] Transaction rolled back due to error');
            } catch (rollbackError) {
                console.error('[Pay] Rollback failed:', rollbackError);
            }
        }

        console.error('[Pay] Error:', {
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
const processPayment = async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    const { payment_amount } = req.body;
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

        // await connection.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        await connection.beginTransaction();

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
             JOIN Client c ON c.client_id = u.client_id
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
        const userId = session.user_id;

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

        // Set session variable for triggers
        if (clientId !== 1) {
            await connection.query('SET @current_user_id = ?', [userId]);
        }

        console.log(`[Pay] Processing payment for client_id: ${clientId}, user_id: ${userId}`);

        const [subscriptions] = await connection.query(
            `SELECT 
                i.status,
                i.invoice_id
             FROM Subscription s JOIN Invoice i ON
             i.subscription_id = s.subscription_id 
             JOIN Plan p ON s.plan_id = p.plan_id
             WHERE s.client_id = ? AND i.status IN('Pending', 'Overdue')
               AND s.status = 'Active' ORDER BY i.invoice_date DESC
             LIMIT 1 
             FOR UPDATE`, // Lock the subscription row
            [clientId]
        );

        if (subscriptions.length === 0) {
            await connection.rollback();
            return res.status(402).json(createErrorResponse(
                ErrorCodes.NO_ACTIVE_SUBSCRIPTION
            ));
        }

        const [paymentResult] = await connection.query(
            `INSERT INTO Payment (
                invoice_id,
                payment_date,
                amount,
                payment_method,
                status,
                created_at
            ) VALUES (?, NOW(), ?, 'Bank Transfer', 'Success', NOW())`,
            [subscriptions[0].invoice_id, payment_amount]
        );

        if (!paymentResult || !paymentResult.insertId) {
            await connection.rollback();
            return res.status(402).json(createErrorResponse(
                ErrorCodes.PAYMENT_PROCESSING_FAILED
            ));
        }
        await connection.query(`
            Update Invoice SET status = 'Paid' Where invoice_id = ?
            `, [subscriptions[0].invoice_id]);
        if (subscriptions[0].status === 'Overdue') {
            await connection.query(`
                Update OverduePenalty SET applied = True Where invoice_id = ?
                `, [subscriptions[0].invoice_id]);
        }

        const newPaymentId = paymentResult.insertId;
        console.log(`[Pay] Payment processed with ID: ${newPaymentId}`);

        await connection.query(
            `UPDATE UserSession 
             SET canAccessEditor = TRUE 
             WHERE session_id = ?`,
            [sessionId]
        );

        await connection.commit();

        const responseData = {
            success: true
        };

        return res.status(200).json(responseData);

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
                console.log('[Pay] Transaction rolled back due to error');
            } catch (rollbackError) {
                console.error('[Pay] Rollback failed:', rollbackError);
            }
        }

        console.error('[Pay] Error:', {
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

module.exports = {
    processPayment,
    getPayment
};