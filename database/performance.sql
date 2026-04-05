USE saas_db;

-- Refresh table stats for fair EXPLAIN ANALYZE
ANALYZE TABLE Client;
ANALYZE TABLE Plan;
ANALYZE TABLE Customer;
ANALYZE TABLE User;
ANALYZE TABLE Subscription;
ANALYZE TABLE Invoice;
ANALYZE TABLE Payment;
ANALYZE TABLE OverduePenalty;
ANALYZE TABLE AccessLog;
ANALYZE TABLE UserSession;

-- Index inventory (for reference)
SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'saas_db' ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- ============================================================
-- INDEX PERFORMANCE: BEFORE vs AFTER (EXPLAIN + elapsed time + delta)
-- ============================================================

-- Plan.idx_plan_client
EXPLAIN ANALYZE
SELECT * FROM Plan IGNORE INDEX (idx_plan_client) WHERE client_id = 2 LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Plan IGNORE INDEX (idx_plan_client) WHERE client_id = 2 LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM Plan WHERE client_id = 2 LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Plan WHERE client_id = 2 LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- Customer.idx_customer_client
EXPLAIN ANALYZE
SELECT * FROM Customer IGNORE INDEX (idx_customer_client) WHERE client_id = 2 LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Customer IGNORE INDEX (idx_customer_client) WHERE client_id = 2 LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM Customer WHERE client_id = 2 LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Customer WHERE client_id = 2 LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- User.idx_user
EXPLAIN ANALYZE
SELECT * FROM User IGNORE INDEX (idx_user) WHERE username = 'john.doe' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM User IGNORE INDEX (idx_user) WHERE username = 'john.doe' LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM User WHERE username = 'john.doe' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM User WHERE username = 'john.doe' LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- User.idx_user_client
EXPLAIN ANALYZE
SELECT * FROM User IGNORE INDEX (idx_user_client) WHERE client_id = 2 AND status = 'Active' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM User IGNORE INDEX (idx_user_client) WHERE client_id = 2 AND status = 'Active' LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM User WHERE client_id = 2 AND status = 'Active' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM User WHERE client_id = 2 AND status = 'Active' LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- Subscription.idx_subscription_client
EXPLAIN ANALYZE
SELECT * FROM Subscription IGNORE INDEX (idx_subscription_client) WHERE client_id = 2 AND status = 'Active' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Subscription IGNORE INDEX (idx_subscription_client) WHERE client_id = 2 AND status = 'Active' LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM Subscription WHERE client_id = 2 AND status = 'Active' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Subscription WHERE client_id = 2 AND status = 'Active' LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- Subscription.idx_subscription_customer
EXPLAIN ANALYZE
SELECT * FROM Subscription IGNORE INDEX (idx_subscription_customer) WHERE customer_id = 2 AND status = 'Active' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Subscription IGNORE INDEX (idx_subscription_customer) WHERE customer_id = 2 AND status = 'Active' LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM Subscription WHERE customer_id = 2 AND status = 'Active' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Subscription WHERE customer_id = 2 AND status = 'Active' LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- Subscription.idx_subscription_plan
EXPLAIN ANALYZE
SELECT * FROM Subscription IGNORE INDEX (idx_subscription_plan) WHERE plan_id = 2 AND client_id = 2 LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Subscription IGNORE INDEX (idx_subscription_plan) WHERE plan_id = 2 AND client_id = 2 LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM Subscription WHERE plan_id = 2 AND client_id = 2 LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Subscription WHERE plan_id = 2 AND client_id = 2 LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- Invoice.idx_invoice_subscription
EXPLAIN ANALYZE
SELECT * FROM Invoice IGNORE INDEX (idx_invoice_subscription) WHERE subscription_id = 2 AND status = 'Active' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Invoice IGNORE INDEX (idx_invoice_subscription) WHERE subscription_id = 2 AND status = 'Active' LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM Invoice WHERE subscription_id = 2 AND status = 'Active' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Invoice WHERE subscription_id = 2 AND status = 'Active' LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- Invoice.idx_invoice_dates
EXPLAIN ANALYZE
SELECT * FROM Invoice IGNORE INDEX (idx_invoice_dates) WHERE status = 'Active' AND due_date < '2024-04-01' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Invoice IGNORE INDEX (idx_invoice_dates) WHERE status = 'Active' AND due_date < '2024-04-01' LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM Invoice WHERE status = 'Active' AND due_date < '2024-04-01' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Invoice WHERE status = 'Active' AND due_date < '2024-04-01' LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- Payment.idx_payment_date
EXPLAIN ANALYZE
SELECT * FROM Payment IGNORE INDEX (idx_payment_date) WHERE payment_date >= '2024-02-01' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Payment IGNORE INDEX (idx_payment_date) WHERE payment_date >= '2024-02-01' LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM Payment WHERE payment_date >= '2024-02-01' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Payment WHERE payment_date >= '2024-02-01' LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- OverduePenalty.idx_penalty_applied
EXPLAIN ANALYZE
SELECT * FROM OverduePenalty IGNORE INDEX (idx_penalty_applied) WHERE invoice_id = 2 AND applied = 2 LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM OverduePenalty IGNORE INDEX (idx_penalty_applied) WHERE invoice_id = 2 AND applied = 2 LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM OverduePenalty WHERE invoice_id = 2 AND applied = 2 LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM OverduePenalty WHERE invoice_id = 2 AND applied = 2 LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- OverduePenalty.idx_penalty_date
EXPLAIN ANALYZE
SELECT * FROM OverduePenalty IGNORE INDEX (idx_penalty_date) WHERE penalty_date >= '2024-03-01' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM OverduePenalty IGNORE INDEX (idx_penalty_date) WHERE penalty_date >= '2024-03-01' LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM OverduePenalty WHERE penalty_date >= '2024-03-01' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM OverduePenalty WHERE penalty_date >= '2024-03-01' LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- Client.unq_client_email
EXPLAIN ANALYZE
SELECT * FROM Client IGNORE INDEX (unq_client_email) WHERE email = 'info@techcorp.com' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Client IGNORE INDEX (unq_client_email) WHERE email = 'info@techcorp.com' LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM Client WHERE email = 'info@techcorp.com' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Client WHERE email = 'info@techcorp.com' LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- Plan.unq_plan_name_per_client
EXPLAIN ANALYZE
SELECT * FROM Plan IGNORE INDEX (unq_plan_name_per_client) WHERE plan_name = 2 AND client_id = 2 LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Plan IGNORE INDEX (unq_plan_name_per_client) WHERE plan_name = 2 AND client_id = 2 LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM Plan WHERE plan_name = 2 AND client_id = 2 LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Plan WHERE plan_name = 2 AND client_id = 2 LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- Customer.unq_customer_email_per_client
EXPLAIN ANALYZE
SELECT * FROM Customer IGNORE INDEX (unq_customer_email_per_client) WHERE client_id = 2 AND email = 'info@techcorp.com' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Customer IGNORE INDEX (unq_customer_email_per_client) WHERE client_id = 2 AND email = 'info@techcorp.com' LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM Customer WHERE client_id = 2 AND email = 'info@techcorp.com' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM Customer WHERE client_id = 2 AND email = 'info@techcorp.com' LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- User.unq_user_email
EXPLAIN ANALYZE
SELECT * FROM User IGNORE INDEX (unq_user_email) WHERE client_id = 2 AND email = 'info@techcorp.com' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM User IGNORE INDEX (unq_user_email) WHERE client_id = 2 AND email = 'info@techcorp.com' LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM User WHERE client_id = 2 AND email = 'info@techcorp.com' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM User WHERE client_id = 2 AND email = 'info@techcorp.com' LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- User.unq_username_per_client
EXPLAIN ANALYZE
SELECT * FROM User IGNORE INDEX (unq_username_per_client) WHERE username = 'john.doe' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM User IGNORE INDEX (unq_username_per_client) WHERE username = 'john.doe' LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM User WHERE username = 'john.doe' LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM User WHERE username = 'john.doe' LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;

-- UserSession.chk_duplicatae_user
EXPLAIN ANALYZE
SELECT * FROM UserSession IGNORE INDEX (chk_duplicatae_user) WHERE user_id = 2 AND logout_time IS NULL LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM UserSession IGNORE INDEX (chk_duplicatae_user) WHERE user_id = 2 AND logout_time IS NULL LIMIT 100;
SET @elapsed_us_before = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_before AS elapsed_us_before;

EXPLAIN ANALYZE
SELECT * FROM UserSession WHERE user_id = 2 AND logout_time IS NULL LIMIT 100;
SET @t_start = NOW(6);
SELECT SQL_NO_CACHE * FROM UserSession WHERE user_id = 2 AND logout_time IS NULL LIMIT 100;
SET @elapsed_us_after = TIMESTAMPDIFF(MICROSECOND, @t_start, NOW(6));
SELECT @elapsed_us_after AS elapsed_us_after;
SELECT (@elapsed_us_after - @elapsed_us_before) AS elapsed_us_delta;
