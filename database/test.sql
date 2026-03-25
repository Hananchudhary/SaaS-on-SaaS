DROP DATABASE saas_db;
CREATE DATABASE saas_db;
USE saas_db;
SOURCE /home/hanan/Projects/c++/SaaS-on-SaaS/database/schema.sql;

INSERT INTO Client (client_id, company_name, email, phone, address, status) VALUES
(1, 'SYSTEM', 'system@saasplatform.com', '+1-800-SYSTEM', 'System Records', 'Active');

INSERT INTO User (user_id,client_id, username, email, password_hash, tier_level, status, created_by) VALUES
(1,1, 'system.admin', 'admin@saasplatform.com', '$2b$10$gSTY99CeRRdL9sMIqZh9MO3YKJDLV5efUWpdSvFdV4xbGRcE3hJ3W', 3, 'Active', NULL);

INSERT INTO Plan (client_id, plan_name, tier_1_users, tier_2_users, tier_3_users, monthly_price, description) VALUES
(1, 'Basic', 5, 2, 1, 49.99, 'Entry-level plan for small businesses'),
(1, 'Professional', 20, 10, 5, 99.99, 'Mid-tier plan with more features'),
(1, 'Enterprise', 100, 50, 25, 299.99, 'Full-featured plan for large organizations');