
-- DROP DATABASE IF EXISTS saas_db;
-- CREATE DATABASE saas_db;
-- USE saas_db;

CREATE TABLE Client (
    client_id INT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(100) NOT NULL,
    email VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    status ENUM('Active', 'Suspended', 'Inactive') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unq_client_email UNIQUE (email),
    CONSTRAINT chk_client_status CHECK (status IN ('Active', 'Suspended', 'Inactive'))
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Plan (
    plan_id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    tier_1_users INT NOT NULL,
    tier_2_users INT NOT NULL,
    tier_3_users INT NOT NULL,
    monthly_price DECIMAL(10,2) NOT NULL,
    description VARCHAR(300),
    
    CONSTRAINT fk_plan_client FOREIGN KEY (client_id) 
        REFERENCES Client(client_id) ON DELETE CASCADE,
    CONSTRAINT chk_tier_users CHECK (
        tier_1_users >= 0 AND 
        tier_2_users >= 0 AND 
        tier_3_users >= 0
    ),
    CONSTRAINT chk_monthly_price CHECK (monthly_price >= 0),
    CONSTRAINT unq_plan_name_per_client UNIQUE (plan_name, client_id)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Customer (
    customer_id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    company_name VARCHAR(100) NOT NULL,
    email VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    registration_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    status ENUM('Active', 'Inactive', 'Suspended') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_customer_client FOREIGN KEY (client_id) 
        REFERENCES Client(client_id) ON DELETE CASCADE,
    CONSTRAINT unq_customer_email_per_client UNIQUE (client_id, email),
    CONSTRAINT chk_customer_status CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    CONSTRAINT chk_customer_not_system CHECK (client_id > 1)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE User (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL, 
    username VARCHAR(50) NOT NULL,
    email VARCHAR(50) NOT NULL,
    password_hash VARCHAR(80) NOT NULL,
    tier_level INT NOT NULL,
    status ENUM('Active', 'Inactive', 'Suspended') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INT NULL,
    
    CONSTRAINT fk_user_client FOREIGN KEY (client_id) 
        REFERENCES Client(client_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_created_by FOREIGN KEY (created_by) 
        REFERENCES User(user_id) ON DELETE SET NULL,
    CONSTRAINT unq_user_email UNIQUE (client_id, email),
    CONSTRAINT unq_username_per_client UNIQUE (username),
    CONSTRAINT chk_tier_level CHECK (tier_level IN (1, 2, 3)),
    CONSTRAINT chk_user_status CHECK (status IN ('Active', 'Inactive', 'Suspended'))
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Subscription (
    subscription_id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    customer_id INT NULL,
    plan_id INT NOT NULL,
    start_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    end_date DATE NULL,
    status ENUM('Active', 'Expired', 'Cancelled') NOT NULL DEFAULT 'Active',
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_subscription_client FOREIGN KEY (client_id) 
        REFERENCES Client(client_id) ON DELETE CASCADE,
    CONSTRAINT fk_subscription_customer FOREIGN KEY (customer_id) 
        REFERENCES Customer(customer_id) ON DELETE CASCADE,
    CONSTRAINT fk_subscription_plan FOREIGN KEY (plan_id) 
        REFERENCES Plan(plan_id) ON DELETE CASCADE,
    CONSTRAINT chk_subscription_dates CHECK (
        end_date IS NULL OR end_date > start_date
    ),
    CONSTRAINT chk_subscription_status CHECK (
        status IN ('Active', 'Expired', 'Cancelled')
    ),
    CONSTRAINT chk_subscription_client_not_system CHECK (
        client_id > 1
    ),
    CONSTRAINT chk_subscription_plan_with_client CHECK (
        customer_id IS NOT NULL OR plan_id IN(1,2,3)
    )
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Invoice (
    invoice_id INT PRIMARY KEY AUTO_INCREMENT,
    subscription_id INT NOT NULL,
    invoice_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    due_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('Paid', 'Pending', 'Overdue', 'Partial') NOT NULL DEFAULT 'Pending',
    paid_date DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_invoice_subscription FOREIGN KEY (subscription_id) 
        REFERENCES Subscription(subscription_id) ON DELETE CASCADE,
    CONSTRAINT chk_invoice_amount CHECK (amount >= 0),
    CONSTRAINT chk_paid_amount CHECK (paid_amount >= 0),
    CONSTRAINT chk_invoice_dates CHECK (due_date >= invoice_date),
    CONSTRAINT chk_invoice_status CHECK (
        status IN ('Paid', 'Pending', 'Overdue', 'Partial')
    ),
    CONSTRAINT chk_paid_date_logic CHECK (
        (status = 'Paid' AND paid_date IS NOT NULL) OR
        (status != 'Paid' AND paid_date IS NULL)
    )
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Payment (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id INT NOT NULL,
    payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(12,2) NOT NULL,
    payment_method ENUM('Credit Card', 'Bank Transfer', 'Cash', 'Cheque') NOT NULL,
    status ENUM('Success', 'Failed', 'Pending') NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id) 
        REFERENCES Invoice(invoice_id) ON DELETE CASCADE,
    CONSTRAINT chk_payment_amount CHECK (amount > 0),
    CONSTRAINT chk_payment_method CHECK (
        payment_method IN ('Credit Card', 'Bank Transfer', 'Cash', 'Cheque')
    ),
    CONSTRAINT chk_payment_status CHECK (
        status IN ('Success', 'Failed', 'Pending')
    )
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE OverduePenalty (
    penalty_id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id INT NOT NULL,
    penalty_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    applied BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_penalty_invoice FOREIGN KEY (invoice_id) 
        REFERENCES Invoice(invoice_id) ON DELETE CASCADE
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE AccessLog (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    action ENUM('INSERT', 'UPDATE', 'DELETE', 'SELECT', 'SHOW', 'DESCRIBE') NOT NULL,
    table_name VARCHAR(15) NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Success', 'Failure') NOT NULL,
    
    CONSTRAINT fk_accesslog_user FOREIGN KEY (user_id) 
        REFERENCES User(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_action CHECK (
        action IN ('INSERT', 'UPDATE', 'DELETE', 'SELECT', 'SHOW', 'DESCRIBE')
    ),
    CONSTRAINT chk_log_status CHECK (
        status IN ('Success', 'Failure')
    )
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE UserSession (
    session_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    canAccessEditor BOOLEAN DEFAULT TRUE,
    login_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_time DATETIME NULL,
    
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) 
        REFERENCES User(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_session_times CHECK (
        logout_time IS NULL OR logout_time > login_time
    ),
    CONSTRAINT chk_duplicatae_user UNIQUE (user_id, logout_time)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_plan_client ON Plan(client_id);

CREATE INDEX idx_customer_client ON Customer(client_id);

CREATE INDEX idx_user ON User(username);
CREATE INDEX idx_user_client ON User(client_id, status);

CREATE INDEX idx_subscription_client ON Subscription(client_id, status);
CREATE INDEX idx_subscription_customer ON Subscription(customer_id, status);
CREATE INDEX idx_subscription_plan ON Subscription(plan_id, client_id);

CREATE INDEX idx_invoice_subscription ON Invoice(subscription_id, status, invoice_date);
CREATE INDEX idx_invoice_dates ON Invoice(status, due_date, subscription_id);

CREATE INDEX idx_payment_date ON Payment(payment_date);

CREATE INDEX idx_penalty_applied ON OverduePenalty(invoice_id, applied, created_at);
CREATE INDEX idx_penalty_date ON OverduePenalty(penalty_date);

DELIMITER $$

CREATE TRIGGER tr_subscription_plan_check
BEFORE INSERT ON Subscription
FOR EACH ROW
BEGIN
    IF NEW.customer_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM Plan
            WHERE plan_id = NEW.plan_id
              AND client_id = NEW.client_id
        ) THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'plan_id does not belong to client_id';
        END IF;
    END IF;
END$$

CREATE TRIGGER update_invoice_status_overdue
BEFORE UPDATE ON Invoice
FOR EACH ROW
BEGIN
    IF NEW.due_date < CURDATE() AND NEW.status NOT IN ('Paid', 'Overdue') THEN
        SET NEW.status = 'Overdue';
    END IF;
END$$

CREATE TRIGGER create_subscription_invoice
AFTER INSERT ON Subscription
FOR EACH ROW
BEGIN
    DECLARE plan_price DECIMAL(12,2);
    
    SELECT monthly_price INTO plan_price 
    FROM Plan WHERE plan_id = NEW.plan_id;
    
    INSERT INTO Invoice (
        subscription_id, 
        invoice_date, 
        due_date, 
        amount
    ) VALUES (
        NEW.subscription_id,
        NEW.start_date,
        DATE_ADD(NEW.start_date, INTERVAL 2 DAY),
        plan_price
    );
END$$

CREATE TRIGGER update_invoice_on_payment
AFTER INSERT ON Payment
FOR EACH ROW
BEGIN
    
    IF NEW.status = 'Success' THEN
        
        UPDATE Invoice
        SET paid_amount = NEW.amount,
            status = 'Paid',
            paid_date = NEW.payment_date
        WHERE invoice_id = NEW.invoice_id;
    END IF;
END$$

CREATE TRIGGER update_overdue_on_payment
AFTER UPDATE ON Invoice
FOR EACH ROW
BEGIN
    IF NEW.status = 'Paid' THEN
        UPDATE OverduePenalty
        SET applied = True
        WHERE invoice_id = NEW.invoice_id;
    END IF;
END$$

CREATE TRIGGER apply_overdue_penalty
AFTER UPDATE ON Invoice
FOR EACH ROW
BEGIN
    DECLARE days_late INT;
    DECLARE penalty DECIMAL(12,2);
    DECLARE unpaid_amount DECIMAL(12,2);
    
    IF NEW.status = 'Overdue' AND OLD.status != 'Overdue' THEN
        
        INSERT INTO OverduePenalty (
            invoice_id,
            penalty_date,
            applied
        ) VALUES (
            NEW.invoice_id,
            CURDATE(),
            FALSE
        );
    END IF;
END$$

CREATE TRIGGER log_client_insert
AFTER INSERT ON Client
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;

    IF NEW.client_id != 1 THEN
        

        IF @current_user_id IS NOT NULL THEN
            SET v_user_id = @current_user_id;
        END IF;

        INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
        VALUES (v_user_id, 'INSERT', 'Client', NOW(), 'Success');
    END IF;
END$$

CREATE TRIGGER log_client_update
AFTER UPDATE ON Client
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;

    IF NEW.client_id != 1 AND OLD.status <> NEW.status THEN
        IF NEW.status IN ('Inactive', 'Suspended') THEN
            UPDATE User
            SET status = NEW.status
            WHERE client_id = NEW.client_id;

            IF NEW.status = 'Inactive' THEN
                UPDATE Subscription
                SET status = 'Expired',
                    end_date = CURDATE()
                WHERE client_id = NEW.client_id
                  AND status = 'Active';
            ELSEIF NEW.status = 'Suspended' THEN
                UPDATE Subscription
                SET status = 'Cancelled',
                    end_date = CURDATE()
                WHERE client_id = NEW.client_id
                  AND status = 'Active';
            END IF;
        END IF;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'UPDATE', 'Client', NOW(), 'Success');
END$$

CREATE TRIGGER log_client_delete
AFTER DELETE ON Client
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'DELETE', 'Client', NOW(), 'Success');
END$$

CREATE TRIGGER log_plan_insert
AFTER INSERT ON Plan
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;

    IF NEW.client_id != 1 THEN

        IF @current_user_id IS NOT NULL THEN
            SET v_user_id = @current_user_id;
        END IF;

        INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
        VALUES (v_user_id, 'INSERT', 'Plan', NOW(), 'Success');
    END IF;
END$$

CREATE TRIGGER log_plan_update
AFTER UPDATE ON Plan
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'UPDATE', 'Plan', NOW(), 'Success');
END$$

CREATE TRIGGER log_plan_delete
AFTER DELETE ON Plan
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'DELETE', 'Plan', NOW(), 'Success');
END$$

CREATE TRIGGER log_customer_insert
AFTER INSERT ON Customer
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'INSERT', 'Customer', NOW(), 'Success');
END$$

CREATE TRIGGER log_customer_update
AFTER UPDATE ON Customer
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;

    IF OLD.status <> NEW.status THEN
        IF NEW.status = 'Inactive' THEN
            UPDATE Subscription
            SET status = 'Expired',
                end_date = CURDATE()
            WHERE customer_id = NEW.customer_id
              AND status = 'Active';
        ELSEIF NEW.status = 'Suspended' THEN
            UPDATE Subscription
            SET status = 'Cancelled',
                end_date = CURDATE()
            WHERE customer_id = NEW.customer_id
              AND status = 'Active';
        END IF;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'UPDATE', 'Customer', NOW(), 'Success');
END$$

CREATE TRIGGER log_customer_delete
AFTER DELETE ON Customer
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'DELETE', 'Customer', NOW(), 'Success');
END$$

CREATE TRIGGER enforce_user_limit_before_insert
BEFORE INSERT ON User
FOR EACH ROW
BEGIN
    DECLARE v_plan_id INT;
    DECLARE v_limit INT;
    DECLARE v_active_count INT;

    -- Skip system client
    IF NEW.client_id != 1 THEN
        IF NEW.status = 'Active' THEN
            SELECT s.plan_id INTO v_plan_id
            FROM Subscription s
            WHERE s.client_id = NEW.client_id
              AND s.customer_id IS NULL
              AND s.status = 'Active'
            ORDER BY s.start_date DESC
            LIMIT 1;

            IF v_plan_id IS NULL THEN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'No active subscription for client';
            END IF;

            IF NEW.tier_level = 1 THEN
                SELECT p.tier_1_users INTO v_limit FROM Plan p WHERE p.plan_id = v_plan_id;
            ELSEIF NEW.tier_level = 2 THEN
                SELECT p.tier_2_users INTO v_limit FROM Plan p WHERE p.plan_id = v_plan_id;
            ELSE
                SELECT p.tier_3_users INTO v_limit FROM Plan p WHERE p.plan_id = v_plan_id;
            END IF;

            IF v_limit IS NULL THEN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Plan limits not found for active subscription';
            END IF;

            SELECT COUNT(*) INTO v_active_count
            FROM User u
            WHERE u.client_id = NEW.client_id
              AND u.tier_level = NEW.tier_level
              AND u.status = 'Active';

            IF v_active_count >= v_limit THEN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Active user limit reached for this tier';
            END IF;
        END IF;
    END IF;
END$$

CREATE TRIGGER log_user_insert
AFTER INSERT ON User
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT;
    
    IF NEW.client_id != 1 THEN

        IF NEW.created_by IS NOT NULL THEN
            SET v_user_id = NEW.created_by;
        ELSEIF @current_user_id IS NOT NULL THEN
            SET v_user_id = @current_user_id;
        ELSE
            SET v_user_id = 1;
        END IF;

        INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
        VALUES (v_user_id, 'INSERT', 'User', NOW(), 'Success');
    END IF;
END$$

CREATE TRIGGER enforce_user_limit_before_update
BEFORE UPDATE ON User
FOR EACH ROW
BEGIN
    DECLARE v_plan_id INT;
    DECLARE v_limit INT;
    DECLARE v_active_count INT;

    -- Skip system client
    IF NEW.client_id != 1 THEN
        IF NEW.status = 'Active' THEN
            -- Only enforce when activating or changing tier/client
            IF NOT (OLD.status = 'Active' AND OLD.client_id = NEW.client_id AND OLD.tier_level = NEW.tier_level) THEN
                SELECT s.plan_id INTO v_plan_id
                FROM Subscription s
                WHERE s.client_id = NEW.client_id
                  AND s.customer_id IS NULL
                  AND s.status = 'Active'
                ORDER BY s.start_date DESC
                LIMIT 1;

                IF v_plan_id IS NULL THEN
                    SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'No active subscription for client';
                END IF;

                IF NEW.tier_level = 1 THEN
                    SELECT p.tier_1_users INTO v_limit FROM Plan p WHERE p.plan_id = v_plan_id;
                ELSEIF NEW.tier_level = 2 THEN
                    SELECT p.tier_2_users INTO v_limit FROM Plan p WHERE p.plan_id = v_plan_id;
                ELSE
                    SELECT p.tier_3_users INTO v_limit FROM Plan p WHERE p.plan_id = v_plan_id;
                END IF;

                IF v_limit IS NULL THEN
                    SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'Plan limits not found for active subscription';
                END IF;

                SELECT COUNT(*) INTO v_active_count
                FROM User u
                WHERE u.client_id = NEW.client_id
                  AND u.tier_level = NEW.tier_level
                  AND u.status = 'Active'
                  AND u.user_id <> OLD.user_id;

                IF v_active_count >= v_limit THEN
                    SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'Active user limit reached for this tier';
                END IF;
            END IF;
        END IF;
    END IF;
END$$

CREATE TRIGGER log_user_update
AFTER UPDATE ON User
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'UPDATE', 'User', NOW(), 'Success');
END$$

CREATE TRIGGER log_user_delete
AFTER DELETE ON User
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'DELETE', 'User', NOW(), 'Success');
END$$

CREATE TRIGGER log_subscription_insert
AFTER INSERT ON Subscription
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'INSERT', 'Subscription', NOW(), 'Success');
END$$

CREATE TRIGGER log_subscription_update
AFTER UPDATE ON Subscription
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'UPDATE', 'Subscription', NOW(), 'Success');
END$$

CREATE TRIGGER log_subscription_delete
AFTER DELETE ON Subscription
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'DELETE', 'Subscription', NOW(), 'Success');
END$$

CREATE TRIGGER log_invoice_insert
AFTER INSERT ON Invoice
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'INSERT', 'Invoice', NOW(), 'Success');
END$$

CREATE TRIGGER log_invoice_update
AFTER UPDATE ON Invoice
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'UPDATE', 'Invoice', NOW(), 'Success');
END$$

CREATE TRIGGER log_invoice_delete
AFTER DELETE ON Invoice
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'DELETE', 'Invoice', NOW(), 'Success');
END$$

CREATE TRIGGER log_payment_insert
AFTER INSERT ON Payment
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'INSERT', 'Payment', NOW(), 'Success');
END$$

CREATE TRIGGER log_payment_update
AFTER UPDATE ON Payment
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'UPDATE', 'Payment', NOW(), 'Success');
END$$

CREATE TRIGGER log_payment_delete
AFTER DELETE ON Payment
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'DELETE', 'Payment', NOW(), 'Success');
END$$

CREATE TRIGGER log_overdue_penalty_insert
AFTER INSERT ON OverduePenalty
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'INSERT', 'OverduePenalty', NOW(), 'Success');
END$$

CREATE TRIGGER log_overdue_penalty_update
AFTER UPDATE ON OverduePenalty
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'UPDATE', 'OverduePenalty', NOW(), 'Success');
END$$

CREATE TRIGGER log_overdue_penalty_delete
AFTER DELETE ON OverduePenalty
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    IF @current_user_id IS NOT NULL THEN
        SET v_user_id = @current_user_id;
    END IF;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'DELETE', 'OverduePenalty', NOW(), 'Success');
END$$

CREATE TRIGGER log_user_session_insert
AFTER INSERT ON UserSession
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'INSERT', 'UserSession', NOW(), 'Success');
END$$

CREATE TRIGGER log_user_session_update
AFTER UPDATE ON UserSession
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'UPDATE', 'UserSession', NOW(), 'Success');
END$$

CREATE TRIGGER log_user_session_delete
AFTER DELETE ON UserSession
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'DELETE', 'UserSession', NOW(), 'Success');
END$$

DELIMITER ;

CREATE VIEW ClientUserStats AS
SELECT
    u.client_id,
    COUNT(*) AS total_users,
    SUM(CASE WHEN u.tier_level = 1 THEN 1 ELSE 0 END) AS tier_1_count,
    SUM(CASE WHEN u.tier_level = 2 THEN 1 ELSE 0 END) AS tier_2_count,
    SUM(CASE WHEN u.tier_level = 3 THEN 1 ELSE 0 END) AS tier_3_count,
    SUM(CASE WHEN u.status = 'Active' THEN 1 ELSE 0 END) AS active_users
FROM User u
WHERE u.client_id > 1
GROUP BY u.client_id;

CREATE VIEW ClientActiveSessions AS
SELECT
    u.client_id,
    COUNT(*) AS active_sessions
FROM UserSession us
JOIN User u ON us.user_id = u.user_id
WHERE us.logout_time IS NULL
  AND u.client_id > 1
GROUP BY u.client_id;

CREATE VIEW ClientStorageStats AS
SELECT
    c.client_id,
    COALESCE(cc.client_count, 0) AS client_count,
    COALESCE(cu.customer_count, 0) AS customer_count,
    COALESCE(u.user_count, 0) AS user_count,
    COALESCE(pl.plan_count, 0) AS plan_count,
    COALESCE(s.subscription_count, 0) AS subscription_count,
    COALESCE(i.invoice_count, 0) AS invoice_count,
    COALESCE(p.payment_count, 0) AS payment_count,
    COALESCE(al.accesslog_count, 0) AS accesslog_count,
    COALESCE(op.overduepenalty_count, 0) AS overduepenalty_count
FROM Client c
LEFT JOIN (
    SELECT client_id, COUNT(*) AS customer_count
    FROM Customer
    GROUP BY client_id
) cu ON cu.client_id = c.client_id
LEFT JOIN (
    SELECT client_id, COUNT(*) AS user_count
    FROM User
    GROUP BY client_id
) u ON u.client_id = c.client_id
LEFT JOIN (
    SELECT client_id, COUNT(*) AS plan_count
    FROM Plan
    GROUP BY client_id
) pl ON pl.client_id = c.client_id
LEFT JOIN (
    SELECT client_id, COUNT(*) AS subscription_count
    FROM Subscription
    GROUP BY client_id
) s ON s.client_id = c.client_id
LEFT JOIN (
    SELECT s.client_id, COUNT(*) AS invoice_count
    FROM Invoice i
    JOIN Subscription s ON i.subscription_id = s.subscription_id
    GROUP BY s.client_id
) i ON i.client_id = c.client_id
LEFT JOIN (
    SELECT s.client_id, COUNT(*) AS payment_count
    FROM Payment p
    JOIN Invoice i ON p.invoice_id = i.invoice_id
    JOIN Subscription s ON i.subscription_id = s.subscription_id
    GROUP BY s.client_id
) p ON p.client_id = c.client_id
LEFT JOIN (
    SELECT u.client_id, COUNT(*) AS accesslog_count
    FROM AccessLog al
    JOIN User u ON al.user_id = u.user_id
    GROUP BY u.client_id
) al ON al.client_id = c.client_id
LEFT JOIN (
    SELECT s.client_id, COUNT(*) AS overduepenalty_count
    FROM OverduePenalty op
    JOIN Invoice i ON op.invoice_id = i.invoice_id
    JOIN Subscription s ON i.subscription_id = s.subscription_id
    GROUP BY s.client_id
) op ON op.client_id = c.client_id
LEFT JOIN (
    SELECT COUNT(*) AS client_count
    FROM Client
    WHERE client_id > 1
) cc ON 1 = 1
WHERE c.client_id > 1;

ALTER TABLE Client AUTO_INCREMENT = 2;

ALTER TABLE User AUTO_INCREMENT = 2;
