
const { pool, withTransaction } = require('../models/db');
const { ErrorCodes, createErrorResponse } = require('../middleware/error_handling');
const overDuePricePerday = 0.002;
const getPayment = async (req, res) => {
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
                 JOIN Client c ON c.client_id = u.client_id
                 WHERE us.session_id = ? 
                   AND us.logout_time IS NULL
                 FOR UPDATE`,
                [sessionId]
            );

            if (sessions.length === 0) throw { status: 400, code: ErrorCodes.SESSION_NOT_FOUND };

            const session = sessions[0];
            const clientId = session.client_id;
            const userId = session.user_id;

            if (session.user_status !== 'Active') throw { status: 401, code: ErrorCodes.USER_INACTIVE };
            if (session.client_status !== 'Active') throw { status: 401, code: ErrorCodes.CLIENT_INACTIVE };

            await connection.query('SET @current_user_id = ?', [userId]);

            console.log(`[Pay] Processing payment for client_id: ${clientId}, user_id: ${userId}`);

            const [planResult] = await connection.query(`
                SELECT p.monthly_price FROM Plan p JOIN Subscription s ON
                p.plan_id = s.plan_id WHERE s.client_id = ? AND s.status = 'Active'
                `, [clientId]);

            if (planResult.length === 0) throw { status: 402, code: ErrorCodes.NO_ACTIVE_SUBSCRIPTION };

            const [overdueResult] = await connection.query(
                `SELECT DATEDIFF(CURDATE(),o.penalty_date) as days FROM Invoice i 
                JOIN Subscription s ON i.subscription_id = s.subscription_id JOIN 
                OverduePenalty o ON o.invoice_id = i.invoice_id WHERE s.client_id = ? 
                AND i.status ='Overdue' AND o.applied = False`,
                [clientId]
            );

            const daysSincePenalty = (overdueResult.length > 0) ? overdueResult[0].days : 0;
            const planPrice = parseFloat(planResult[0].monthly_price);
            const OverDueCharges = daysSincePenalty * (overDuePricePerday * planPrice);

            return {
                success: true,
                plan_amount: planPrice,
                overdue_fine: OverDueCharges
            };
        }, { isolationLevel: 'READ COMMITTED' });

        return res.status(200).json(responseData);

    } catch (error) {
        if (error.status) {
            return res.status(error.status).json(createErrorResponse(error.code));
        }
        console.error('[Pay] Error:', error);
        return res.status(500).json(createErrorResponse(ErrorCodes.UNKNOWN_ERROR));
    }
};
const processPayment = async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    const { payment_amount } = req.body;

    if (!sessionId) {
        return res.status(400).json(createErrorResponse(
            ErrorCodes.SESSION_NOT_FOUND
        ));
    }

    try {
        await withTransaction(async (connection) => {
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

            if (sessions.length === 0) throw { status: 400, code: ErrorCodes.SESSION_NOT_FOUND };

            const session = sessions[0];
            const clientId = session.client_id;
            const userId = session.user_id;

            if (session.user_status !== 'Active') throw { status: 401, code: ErrorCodes.USER_INACTIVE };
            if (session.client_status !== 'Active') throw { status: 401, code: ErrorCodes.CLIENT_INACTIVE };

            if (clientId !== 1) {
                await connection.query('SET @current_user_id = ?', [userId]);
            }

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
                 FOR UPDATE`,
                [clientId]
            );

            if (subscriptions.length === 0) throw { status: 402, code: ErrorCodes.NO_ACTIVE_SUBSCRIPTION };

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

            if (!paymentResult || !paymentResult.insertId) throw { status: 402, code: ErrorCodes.PAYMENT_PROCESSING_FAILED };
             

            await connection.query(
                `UPDATE UserSession 
                 SET canAccessEditor = TRUE 
                 WHERE session_id = ?`,
                [sessionId]
            );
        }, { isolationLevel: 'SERIALIZABLE' });

        return res.status(200).json({ success: true });

    } catch (error) {
        if (error.status) {
            return res.status(error.status).json(createErrorResponse(error.code));
        }
        console.error('[Pay] Error:', error);
        return res.status(500).json(createErrorResponse(ErrorCodes.UNKNOWN_ERROR));
    }
};

module.exports = {
    processPayment,
    getPayment
};
