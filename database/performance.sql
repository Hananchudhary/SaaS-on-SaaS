
USE saas_db;

ANALYZE TABLE Client;
ANALYZE TABLE Plan;
ANALYZE TABLE Customer;
ANALYZE TABLE User;
ANALYZE TABLE Subscription;
ANALYZE TABLE Invoice;
ANALYZE TABLE Payment;
ANALYZE TABLE OverduePenalty;

SELECT 
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'saas_db'
ORDER BY TABLE_NAME, INDEX_NAME;

-- 1.1 BEFORE INDEXING (Ignore the index)
EXPLAIN ANALYZE
SELECT invoice_id, invoice_date, due_date, amount, paid_amount, status
FROM Invoice IGNORE INDEX (idx_invoice_dates)
WHERE status = 'Overdue'
  AND due_date < '2024-04-01'
ORDER BY due_date;

-- 1.2 AFTER INDEXING (Let MySQL use the index)
EXPLAIN ANALYZE
SELECT invoice_id, invoice_date, due_date, amount, paid_amount, status
FROM Invoice
WHERE status = 'Overdue'
  AND due_date < '2024-04-01'
ORDER BY due_date;

-- 2.1 BEFORE INDEXING
EXPLAIN ANALYZE
SELECT subscription_id, client_id, customer_id, plan_id, end_date
FROM Subscription IGNORE INDEX (idx_subscription_dates)
WHERE status = 'Active'
  AND end_date BETWEEN '2024-04-01' AND '2024-04-30';

-- 2.2 AFTER INDEXING
EXPLAIN ANALYZE
SELECT subscription_id, client_id, customer_id, plan_id, end_date
FROM Subscription
WHERE status = 'Active'
  AND end_date BETWEEN '2024-04-01' AND '2024-04-30';

-- 3.1 BEFORE INDEXING
EXPLAIN ANALYZE
SELECT customer_id, company_name, email, status
FROM Customer IGNORE INDEX (idx_customer_client)
WHERE client_id = 2
  AND status = 'Active';

-- 3.2 AFTER INDEXING
EXPLAIN ANALYZE
SELECT customer_id, company_name, email, status
FROM Customer
WHERE client_id = 2
  AND status = 'Active';

-- 4.1 BEFORE INDEXING
EXPLAIN ANALYZE
SELECT payment_id, payment_date, amount, payment_method
FROM Payment IGNORE INDEX (idx_payment_invoice, idx_payment_date)
WHERE invoice_id = 1001
  AND payment_date BETWEEN '2024-01-01' AND '2024-03-31'
  AND status = 'Success';

-- 4.2 AFTER INDEXING
EXPLAIN ANALYZE
SELECT payment_id, payment_date, amount, payment_method
FROM Payment
WHERE invoice_id = 1001
  AND payment_date BETWEEN '2024-01-01' AND '2024-03-31'
  AND status = 'Success';


-- 5.1 BEFORE INDEXING
EXPLAIN ANALYZE
SELECT penalty_id, invoice_id, penalty_date
FROM OverduePenalty IGNORE INDEX (idx_penalty_applied, idx_penalty_date)
WHERE applied = FALSE
  AND penalty_date >= '2024-03-01'
ORDER BY penalty_date;

-- 5.2 AFTER INDEXING
EXPLAIN ANALYZE
SELECT penalty_id, invoice_id, penalty_date
FROM OverduePenalty
WHERE applied = FALSE
  AND penalty_date >= '2024-03-01'
ORDER BY penalty_date;
