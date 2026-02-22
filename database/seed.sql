
INSERT INTO Client (client_id, company_name, email, phone, address, status) VALUES
(1, 'SYSTEM', 'system@saasplatform.com', '+1-800-SYSTEM', 'System Records', 'Active');

INSERT INTO User (user_id,client_id, username, email, password_hash, tier_level, status, created_by) VALUES
(1,1, 'system.admin', 'admin@saasplatform.com', '$2a$10$SYSTEMHASHDONOTUSEINPRODUCTION', 3, 'Active', NULL);

INSERT INTO Plan (client_id, plan_name, tier_1_users, tier_2_users, tier_3_users, monthly_price, description) VALUES
(1, 'Basic', 5, 2, 1, 49.99, 'Entry-level plan for small businesses'),
(1, 'Professional', 20, 10, 5, 99.99, 'Mid-tier plan with more features'),
(1, 'Enterprise', 100, 50, 25, 299.99, 'Full-featured plan for large organizations');

INSERT INTO Client (company_name, email, phone, address, status) VALUES
('TechCorp Solutions', 'info@techcorp.com', '+1-212-555-0100', '123 Tech Ave, New York, NY 10001', 'Active'),
('Global Retail Inc', 'contact@globalretail.com', '+1-310-555-0200', '456 Market St, Los Angeles, CA 90001', 'Active'),
('HealthPlus Systems', 'hello@healthplus.com', '+1-312-555-0300', '789 Wellness Blvd, Chicago, IL 60601', 'Active'),
('EduSmart Learning', 'support@edusmart.com', '+1-617-555-0400', '321 Education Dr, Boston, MA 02101', 'Suspended'),
('FinancePro LLC', 'info@financepro.com', '+1-415-555-0500', '654 Money St, San Francisco, CA 94101', 'Active');

INSERT INTO Plan (client_id, plan_name, tier_1_users, tier_2_users, tier_3_users, monthly_price, description) VALUES
(2, 'TechCorp Custom', 50, 25, 10, 199.99, 'Custom plan for TechCorp'),
(3, 'Retail Pro', 30, 15, 8, 149.99, 'Special retail-focused plan'),
(4, 'fdskf', 30, 15, 8, 149.99, 'Special retail-focused plan'),
(5, 'sdfds', 30, 15, 8, 149.99, 'Special retail-focused plan'),
(6, 'Finance Elite', 200, 100, 50, 599.99, 'High-volume plan for FinancePro');

INSERT INTO Customer (client_id, company_name, email, phone, address, status) VALUES
(2, 'StartupX', 'contact@startupx.com', '+1-555-1001', '100 Innovation Way, San Francisco, CA', 'Active'),
(2, 'Digital Dynamics', 'info@digitaldyn.com', '+1-555-1002', '200 Tech Park, Austin, TX', 'Active'),
(2, 'Creative Minds', 'hello@creativeminds.com', '+1-555-1003', '300 Art Blvd, Portland, OR', 'Active'),
(2, 'DataCore Systems', 'sales@datacore.com', '+1-555-1004', '400 Data Dr, Seattle, WA', 'Inactive'),
(2, 'WebWizards', 'support@webwiz.com', '+1-555-1005', '500 Code St, Boulder, CO', 'Active'),
(2, 'CloudNine Solutions', 'info@cloudnine.com', '+1-555-1006', '600 Cloud Ave, Denver, CO', 'Active'),
(2, 'ByteBridges', 'contact@bytebridges.com', '+1-555-1007', '700 Binary Blvd, Boston, MA', 'Active');

INSERT INTO Customer (client_id, company_name, email, phone, address, status) VALUES
(3, 'Fashion Forward', 'info@fashionfwd.com', '+1-555-2001', '100 Style Ave, New York, NY', 'Active'),
(3, 'Home Goods Co', 'contact@homegoods.com', '+1-555-2002', '200 Home St, Chicago, IL', 'Active'),
(3, 'Sports Central', 'sales@sportscentral.com', '+1-555-2003', '300 Field Rd, Miami, FL', 'Active'),
(3, 'Kids Corner', 'hello@kidscorner.com', '+1-555-2004', '400 Play Dr, Orlando, FL', 'Active'),
(3, 'Pet Paradise', 'info@petparadise.com', '+1-555-2005', '500 Pet Ln, Phoenix, AZ', 'Suspended'),
(3, 'Gourmet Grocery', 'orders@gourmetgrocery.com', '+1-555-2006', '600 Food St, Portland, OR', 'Active'),
(3, 'Tech Gadgets', 'support@techgadgets.com', '+1-555-2007', '700 Device Dr, San Jose, CA', 'Active');

INSERT INTO Customer (client_id, company_name, email, phone, address, status) VALUES
(4, 'MediCare Clinics', 'admin@medicare.com', '+1-555-3001', '100 Health Ave, Cleveland, OH', 'Active'),
(4, 'PharmaPlus', 'info@pharmaplus.com', '+1-555-3002', '200 Drug Blvd, Philadelphia, PA', 'Active'),
(4, 'Wellness Centers', 'contact@wellness.com', '+1-555-3003', '300 Yoga Rd, Sedona, AZ', 'Active'),
(4, 'Fitness First', 'info@fitnessfirst.com', '+1-555-3004', '400 Gym St, Dallas, TX', 'Active'),
(4, 'Nutrition Hub', 'hello@nutritionhub.com', '+1-555-3005', '500 Health Dr, San Diego, CA', 'Inactive');

INSERT INTO Customer (client_id, company_name, email, phone, address, status) VALUES
(5, 'EduKids Academy', 'info@edukids.com', '+1-555-4001', '100 Learn St, Atlanta, GA', 'Active'),
(5, 'College Prep', 'admin@collegeprep.com', '+1-555-4002', '200 Study Dr, Princeton, NJ', 'Active'),
(5, 'Language School', 'hello@langschool.com', '+1-555-4003', '300 Word Blvd, Washington DC', 'Inactive'),
(5, 'Math Masters', 'contact@mathmasters.com', '+1-555-4004', '400 Number Ave, Cambridge, MA', 'Active');

INSERT INTO Customer (client_id, company_name, email, phone, address, status) VALUES
(6, 'Investment Group', 'info@investgroup.com', '+1-555-5001', '100 Money Ave, New York, NY', 'Active'),
(6, 'Insurance Plus', 'contact@insuranceplus.com', '+1-555-5002', '200 Policy Dr, Hartford, CT', 'Active'),
(6, 'Wealth Managers', 'hello@wealthmgmt.com', '+1-555-5003', '300 Rich St, Chicago, IL', 'Active'),
(6, 'Tax Experts', 'support@taxexperts.com', '+1-555-5004', '400 Tax Blvd, Miami, FL', 'Active'),
(6, 'Financial Advisors', 'info@financialadv.com', '+1-555-5005', '500 Wealth Ln, Boston, MA', 'Active');

INSERT INTO User (client_id, username, email, password_hash, tier_level, status, created_by) VALUES
(2, 'john.doe', 'john.doe@techcorp.com', '$2a$10$HASH001', 3, 'Active', 1),
(2, 'jane.smith', 'jane.smith@techcorp.com', '$2a$10$HASH002', 3, 'Active', 2),
(2, 'bob.wilson', 'bob.wilson@techcorp.com', '$2a$10$HASH003', 2, 'Active', 2),
(2, 'alice.brown', 'alice.brown@techcorp.com', '$2a$10$HASH004', 2, 'Active', 2),
(2, 'charlie.davis', 'charlie.davis@techcorp.com', '$2a$10$HASH005', 1, 'Inactive', 3),
(2, 'diana.miller', 'diana.miller@techcorp.com', '$2a$10$HASH006', 1, 'Active', 3);

INSERT INTO User (client_id, username, email, password_hash, tier_level, status, created_by) VALUES
(3, 'sarah.jones', 'sarah.jones@globalretail.com', '$2a$10$HASH007', 3, 'Active', 1),
(3, 'mike.taylor', 'mike.taylor@globalretail.com', '$2a$10$HASH008', 3, 'Active', 7),
(3, 'lisa.anderson', 'lisa.anderson@globalretail.com', '$2a$10$HASH009', 2, 'Active', 7),
(3, 'tom.martin', 'tom.martin@globalretail.com', '$2a$10$HASH010', 2, 'Active', 8),
(3, 'emily.white', 'emily.white@globalretail.com', '$2a$10$HASH011', 1, 'Active', 8),
(3, 'kevin.harris', 'kevin.harris@globalretail.com', '$2a$10$HASH012', 1, 'Suspended', 9);

INSERT INTO User (client_id, username, email, password_hash, tier_level, status, created_by) VALUES
(4, 'david.clark', 'david.clark@healthplus.com', '$2a$10$HASH013', 3, 'Active', 1),
(4, 'nancy.lee', 'nancy.lee@healthplus.com', '$2a$10$HASH014', 3, 'Active', 13),
(4, 'kevin.hall', 'kevin.hall@healthplus.com', '$2a$10$HASH015', 2, 'Suspended', 13),
(4, 'rachel.adams', 'rachel.adams@healthplus.com', '$2a$10$HASH016', 1, 'Active', 14),
(4, 'steven.king', 'steven.king@healthplus.com', '$2a$10$HASH017', 2, 'Active', 14);

INSERT INTO User (client_id, username, email, password_hash, tier_level, status, created_by) VALUES
(5, 'peter.parker', 'peter.parker@edusmart.com', '$2a$10$HASH018', 3, 'Active', 1),
(5, 'mary.jane', 'mary.jane@edusmart.com', '$2a$10$HASH019', 2, 'Active', 18),
(5, 'harry.osborn', 'harry.osborn@edusmart.com', '$2a$10$HASH020', 1, 'Active', 18);

INSERT INTO User (client_id, username, email, password_hash, tier_level, status, created_by) VALUES
(6, 'jack.morgan', 'jack.morgan@financepro.com', '$2a$10$HASH021', 3, 'Active', 1),
(6, 'emma.stone', 'emma.stone@financepro.com', '$2a$10$HASH022', 3, 'Active', 21),
(6, 'oliver.reed', 'oliver.reed@financepro.com', '$2a$10$HASH023', 2, 'Active', 21),
(6, 'sophia.chen', 'sophia.chen@financepro.com', '$2a$10$HASH024', 2, 'Active', 22),
(6, 'liam.wong', 'liam.wong@financepro.com', '$2a$10$HASH025', 1, 'Active', 22),
(6, 'ava.brown', 'ava.brown@financepro.com', '$2a$10$HASH026', 1, 'Active', 23);

INSERT INTO Subscription (client_id, customer_id, plan_id, start_date, end_date, status, auto_renew) VALUES
(2, NULL, 1, '2024-01-01', '2024-12-31', 'Active', TRUE),    
(3, NULL, 2, '2024-01-15', '2025-01-15', 'Active', TRUE),      
(4, NULL, 3, '2024-02-01', '2025-02-01', 'Active', TRUE),      
(5, NULL, 1, '2024-01-01', '2024-06-30', 'Expired', FALSE),    
(6, NULL, 2, '2024-03-01', '2025-03-01', 'Active', TRUE);      

INSERT INTO Subscription (client_id, customer_id, plan_id, start_date, end_date, status, auto_renew) VALUES
(2, 1, 4, '2024-01-15', '2024-07-15', 'Expired', FALSE),       
(2, 1, 4, '2024-07-16', '2025-01-16', 'Active', TRUE),         
(2, 2, 4, '2024-02-01', '2025-02-01', 'Active', TRUE),         
(2, 3, 4, '2024-02-15', '2024-08-15', 'Active', TRUE),         
(2, 4, 4, '2024-03-01', '2024-09-01', 'Cancelled', FALSE),     
(2, 5, 4, '2024-04-01', '2025-04-01', 'Active', TRUE),         
(2, 6, 4, '2024-05-01', '2024-11-01', 'Active', TRUE),         
(2, 7, 4, '2024-06-01', '2024-12-01', 'Active', TRUE);         

INSERT INTO Subscription (client_id, customer_id, plan_id, start_date, end_date, status, auto_renew) VALUES
(3, 8, 5, '2024-01-20', '2025-01-20', 'Active', TRUE),         
(3, 9, 5, '2024-02-10', '2024-08-10', 'Active', TRUE),         
(3, 10, 5, '2024-03-05', '2025-03-05', 'Active', TRUE),        
(3, 11, 5, '2024-03-15', '2024-09-15', 'Active', TRUE),        
(3, 12, 5, '2024-04-01', '2024-10-01', 'Active', TRUE),        
(3, 13, 5, '2024-05-01', '2024-11-01', 'Active', TRUE),        
(3, 14, 5, '2024-06-01', '2024-12-01', 'Active', TRUE);        

-- Customer subscriptions for HealthPlus (client_id=4)
INSERT INTO Subscription (client_id, customer_id, plan_id, start_date, end_date, status, auto_renew) VALUES
(4, 15, 6, '2024-01-10', '2025-01-10', 'Active', TRUE),        -- MediCare Clinics: Enterprise ✓
(4, 16, 6, '2024-02-20', '2024-08-20', 'Active', TRUE),        -- PharmaPlus: Professional ✓
(4, 17, 6, '2024-03-25', '2025-03-25', 'Active', TRUE),        -- Wellness Centers: Basic ✓
(4, 18, 6, '2024-04-15', '2024-10-15', 'Active', TRUE),        -- Fitness First: Professional ✓
(4, 19, 6, '2024-05-10', '2024-11-10', 'Active', TRUE);        -- Nutrition Hub: Basic ✓

-- Customer subscriptions for EduSmart (client_id=5)
INSERT INTO Subscription (client_id, customer_id, plan_id, start_date, end_date, status, auto_renew) VALUES
(5, 20, 7, '2024-01-05', '2024-07-05', 'Expired', FALSE),      -- EduKids Academy: Basic ✓
(5, 21, 7, '2024-02-15', '2024-08-15', 'Cancelled', FALSE),    -- College Prep: Professional ✓
(5, 22, 7, '2024-03-10', '2024-09-10', 'Active', TRUE);        -- Language School: Basic ✓

-- Customer subscriptions for FinancePro (client_id=6)
INSERT INTO Subscription (client_id, customer_id, plan_id, start_date, end_date, status, auto_renew) VALUES
(6, 23, 8, '2024-01-01', '2025-01-01', 'Active', TRUE),        -- Investment Group: Finance Elite ✓
(6, 24, 8, '2024-02-01', '2024-08-01', 'Active', TRUE),        -- Insurance Plus: Enterprise ✓
(6, 25, 8, '2024-03-01', '2025-03-01', 'Active', TRUE),        -- Wealth Managers: Professional ✓
(6, 26, 8, '2024-04-01', '2024-10-01', 'Active', TRUE),        -- Tax Experts: Basic ✓
(6, 27, 8, '2024-05-01', '2024-11-01', 'Active', TRUE);        -- Financial Advisors: Finance Elite ✓

INSERT INTO Invoice (subscription_id, invoice_date, due_date, amount, paid_amount, status, paid_date) VALUES
(1, '2024-01-01', '2024-01-15', 49.99, 49.99, 'Paid', '2024-01-10'),
(2, '2024-01-15', '2024-01-30', 99.99, 99.99, 'Paid', '2024-01-25'),
(3, '2024-02-01', '2024-02-15', 299.99, 299.99, 'Paid', '2024-02-10'),
(6, '2024-01-15', '2024-01-30', 99.99, 99.99, 'Paid', '2024-01-28'),
(14, '2024-01-20', '2024-02-04', 149.99, 149.99, 'Paid', '2024-02-01'),
(22, '2024-01-10', '2024-01-25', 299.99, 299.99, 'Paid', '2024-01-20'),
(31, '2024-01-01', '2024-01-15', 599.99, 599.99, 'Paid', '2024-01-12'),
(1, '2024-02-01', '2024-02-15', 49.99, 49.99, 'Paid', '2024-02-14'),
(2, '2024-02-15', '2024-03-01', 99.99, 0.00, 'Overdue', NULL),
(7, '2024-02-01', '2024-02-15', 199.99, 100.00, 'Partial', NULL),
(8, '2024-02-01', '2024-02-15', 49.99, 49.99, 'Paid', '2024-02-10'),
(9, '2024-02-15', '2024-02-29', 49.99, 0.00, 'Overdue', NULL),
(15, '2024-02-10', '2024-02-25', 99.99, 0.00, 'Pending', NULL),
(23, '2024-02-20', '2024-03-06', 99.99, 0.00, 'Pending', NULL),
(32, '2024-02-01', '2024-02-15', 299.99, 299.99, 'Paid', '2024-02-14'),
(1, '2024-03-01', '2024-03-15', 49.99, 0.00, 'Pending', NULL),
(3, '2024-03-01', '2024-03-15', 299.99, 299.99, 'Paid', '2024-03-10'),
(4, '2024-03-01', '2024-03-15', 149.99, 149.99, 'Paid', '2024-03-12'),
(10, '2024-03-01', '2024-03-15', 49.99, 25.00, 'Partial', NULL),
(11, '2024-03-05', '2024-03-20', 29.99, 0.00, 'Pending', NULL),
(16, '2024-03-05', '2024-03-20', 49.99, 0.00, 'Pending', NULL),
(24, '2024-03-25', '2024-04-09', 49.99, 0.00, 'Pending', NULL),
(33, '2024-03-01', '2024-03-15', 99.99, 99.99, 'Paid', '2024-03-12'),
(1, '2024-04-01', '2024-04-15', 49.99, 0.00, 'Pending', NULL),
(5, '2024-04-01', '2024-04-15', 199.99, 0.00, 'Pending', NULL),
(12, '2024-04-01', '2024-04-15', 199.99, 0.00, 'Pending', NULL),
(17, '2024-04-01', '2024-04-15', 49.99, 0.00, 'Pending', NULL),
(18, '2024-04-01', '2024-04-15', 99.99, 0.00, 'Pending', NULL),
(25, '2024-04-01', '2024-04-15', 49.99, 0.00, 'Pending', NULL),
(26, '2024-04-01', '2024-04-15', 99.99, 0.00, 'Pending', NULL);

INSERT INTO Payment (invoice_id, payment_date, amount, payment_method, status) VALUES
-- January payments
(1, '2024-01-10 10:30:00', 49.99, 'Credit Card', 'Success'),
(2, '2024-01-25 14:20:00', 99.99, 'Bank Transfer', 'Success'),
(3, '2024-02-10 09:15:00', 299.99, 'Credit Card', 'Success'),
(4, '2024-01-28 11:45:00', 99.99, 'Credit Card', 'Success'),
(5, '2024-02-01 16:30:00', 149.99, 'Cheque', 'Success'),
(6, '2024-01-20 13:10:00', 299.99, 'Bank Transfer', 'Success'),
(7, '2024-01-12 10:00:00', 599.99, 'Credit Card', 'Success'),

-- February payments
(8, '2024-02-14 15:45:00', 49.99, 'Credit Card', 'Success'),
(10, '2024-02-10 12:30:00', 100.00, 'Cash', 'Success'),
(11, '2024-02-10 09:00:00', 49.99, 'Credit Card', 'Success'),
(13, '2024-02-14 11:30:00', 299.99, 'Bank Transfer', 'Success'),
(15, '2024-02-28 16:45:00', 49.99, 'Credit Card', 'Failed'),
(15, '2024-03-01 09:30:00', 49.99, 'Credit Card', 'Success'),

-- March payments
(16, '2024-03-10 11:20:00', 299.99, 'Bank Transfer', 'Success'),
(17, '2024-03-12 14:15:00', 149.99, 'Credit Card', 'Success'),
(18, '2024-03-10 10:00:00', 49.99, 'Credit Card', 'Success'),
(19, '2024-03-15 13:30:00', 25.00, 'Cash', 'Success'),
(20, '2024-03-25 09:45:00', 99.99, 'Credit Card', 'Success'),
(22, '2024-03-12 16:20:00', 99.99, 'Bank Transfer', 'Success'),

-- April payments
(24, '2024-04-05 10:15:00', 49.99, 'Credit Card', 'Success'),
(25, '2024-04-10 14:30:00', 199.99, 'Bank Transfer', 'Pending'),
(26, '2024-04-12 11:00:00', 199.99, 'Credit Card', 'Failed'),
(27, '2024-04-15 09:30:00', 49.99, 'Credit Card', 'Pending'),
(28, '2024-04-18 15:45:00', 99.99, 'Cheque', 'Pending'),
(29, '2024-04-20 13:20:00', 49.99, 'Cash', 'Success'),
(30, '2024-04-22 10:00:00', 99.99, 'Credit Card', 'Success'),
(31, '2024-04-25 16:10:00', 199.99, 'Bank Transfer', 'Pending');

-- ============================================================
-- SECTION 9: OVERDUE PENALTIES (Simplified - no days/amount columns)
-- ============================================================

INSERT INTO OverduePenalty (invoice_id, penalty_date, applied) VALUES
-- Invoice 9 (overdue)
(9, '2024-03-15', TRUE),
(9, '2024-03-16', FALSE),
(9, '2024-03-17', FALSE),

-- Invoice 10 (partial payment, overdue)
(10, '2024-03-01', TRUE),

-- Invoice 14 (pending, overdue)
(14, '2024-03-10', TRUE),
(14, '2024-03-11', FALSE),

-- Invoice 15 (overdue)
(15, '2024-03-15', TRUE),

-- Invoice 23 (overdue)
(23, '2024-03-20', TRUE),

-- Invoice 24 (just became overdue)
(24, '2024-04-15', FALSE),

-- Additional penalties
(11, '2024-03-20', TRUE),
(18, '2024-04-01', TRUE),
(26, '2024-04-20', FALSE),
(27, '2024-04-20', FALSE),
(28, '2024-04-25', FALSE);

-- ============================================================
-- SECTION 10: ACCESS LOGS (Simplified - no record_id/ip_address)
-- ============================================================

INSERT INTO AccessLog (user_id, action, table_name, timestamp, status) VALUES
-- TechCorp users
(2, 'INSERT', 'Customer', '2024-01-01 09:00:00', 'Success'),
(2, 'UPDATE', 'Subscription', '2024-01-01 10:30:00', 'Success'),
(3, 'SELECT', 'Invoice', '2024-01-02 14:20:00', 'Success'),
(3, 'INSERT', 'Customer', '2024-01-05 11:15:00', 'Success'),
(4, 'UPDATE', 'Plan', '2024-01-10 09:30:00', 'Failure'),

-- Global Retail users
(8, 'INSERT', 'Customer', '2024-01-15 11:00:00', 'Success'),
(9, 'UPDATE', 'Subscription', '2024-01-16 15:30:00', 'Success'),
(10, 'SELECT', 'Invoice', '2024-01-20 10:45:00', 'Success'),
(8, 'DELETE', 'Customer', '2024-02-01 14:20:00', 'Failure'),

-- HealthPlus users
(14, 'INSERT', 'Customer', '2024-02-05 09:15:00', 'Success'),
(15, 'UPDATE', 'Subscription', '2024-02-10 13:40:00', 'Success'),
(16, 'SELECT', 'Invoice', '2024-02-15 16:30:00', 'Success'),

-- EduSmart users
(19, 'INSERT', 'Customer', '2024-02-20 10:00:00', 'Success'),
(20, 'UPDATE', 'Subscription', '2024-03-01 11:30:00', 'Success'),

-- FinancePro users
(22, 'INSERT', 'Customer', '2024-03-05 09:45:00', 'Success'),
(23, 'UPDATE', 'Subscription', '2024-03-10 14:15:00', 'Success'),
(24, 'SELECT', 'Invoice', '2024-03-15 10:30:00', 'Success'),
(25, 'UPDATE', 'Payment', '2024-03-20 16:00:00', 'Success'),
(22, 'INSERT', 'Customer', '2024-04-01 09:30:00', 'Success');

-- ============================================================
-- SECTION 11: USER SESSIONS (Simplified - no ip_address)
-- ============================================================

INSERT INTO UserSession (user_id, login_time, logout_time) VALUES
-- TechCorp sessions
(2, '2024-01-01 08:00:00', '2024-01-01 18:00:00'),
(2, '2024-01-02 08:15:00', '2024-01-02 17:30:00'),
(3, '2024-01-01 09:00:00', '2024-01-01 17:00:00'),
(3, '2024-01-02 08:45:00', '2024-01-02 16:30:00'),
(4, '2024-01-03 10:00:00', '2024-01-03 15:45:00'),
(4, '2024-01-04 09:30:00', NULL),

-- Global Retail sessions
(8, '2024-01-15 08:30:00', '2024-01-15 19:00:00'),
(9, '2024-01-16 09:00:00', '2024-01-16 18:30:00'),
(10, '2024-01-17 08:45:00', NULL),

-- HealthPlus sessions
(14, '2024-02-05 09:00:00', '2024-02-05 17:30:00'),
(15, '2024-02-10 08:30:00', '2024-02-10 16:45:00'),
(16, '2024-02-15 09:15:00', NULL),

-- FinancePro sessions
(22, '2024-03-05 08:45:00', '2024-03-05 18:15:00'),
(23, '2024-03-10 09:30:00', '2024-03-10 17:45:00'),
(24, '2024-03-15 08:00:00', NULL),
(25, '2024-03-20 09:15:00', '2024-03-20 18:30:00'),
(22, '2024-04-01 08:30:00', '2024-04-01 17:00:00'),
(23, '2024-04-02 09:00:00', NULL);
