
DROP DATABASE IF EXISTS saas_db;
CREATE DATABASE saas_db;
USE saas_db;
DROP TRIGGER IF EXISTS log_client_insert;


DROP TABLE IF EXISTS UserSession;
DROP TABLE IF EXISTS AccessLog;
DROP TABLE IF EXISTS OverduePenalty;
DROP TABLE IF EXISTS Payment;
DROP TABLE IF EXISTS Invoice;
DROP TABLE IF EXISTS Subscription;
DROP TABLE IF EXISTS Customer;
DROP TABLE IF EXISTS User;
DROP TABLE IF EXISTS Plan;
DROP TABLE IF EXISTS Client;

CREATE TABLE Client (
    client_id INT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    registration_date DATE NOT NULL DEFAULT (CURRENT_DATE),
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
    description TEXT,
    
    CONSTRAINT fk_plan_client FOREIGN KEY (client_id) 
        REFERENCES Client(client_id) ON DELETE CASCADE,
    CONSTRAINT chk_tier_users CHECK (
        tier_1_users >= 0 AND 
        tier_2_users >= 0 AND 
        tier_3_users >= 0
    ),
    CONSTRAINT chk_monthly_price CHECK (monthly_price >= 0),
    CONSTRAINT unq_plan_name_per_client UNIQUE (plan_name, client_id), 
    CONSTRAINT unq_plan_id_per_client UNIQUE (plan_id, client_id)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Customer (
    customer_id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
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
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    tier_level INT NOT NULL,
    status ENUM('Active', 'Inactive', 'Suspended') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INT NULL,
    
    CONSTRAINT fk_user_client FOREIGN KEY (client_id) 
        REFERENCES Client(client_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_created_by FOREIGN KEY (created_by) 
        REFERENCES User(user_id) ON DELETE SET NULL,
    CONSTRAINT unq_user_email UNIQUE (email),
    CONSTRAINT unq_username_per_client UNIQUE (client_id, username),
    CONSTRAINT chk_tier_level CHECK (tier_level IN (1, 2, 3)),
    CONSTRAINT chk_user_status CHECK (status IN ('Active', 'Inactive', 'Suspended'))
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Subscription (
    subscription_id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    customer_id INT NULL,
    plan_id INT NOT NULL,
    start_date DATE NOT NULL,
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
    action ENUM('INSERT', 'UPDATE', 'DELETE', 'SELECT') NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Success', 'Failure') NOT NULL,
    
    CONSTRAINT fk_accesslog_user FOREIGN KEY (user_id) 
        REFERENCES User(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_action CHECK (
        action IN ('INSERT', 'UPDATE', 'DELETE', 'SELECT')
    ),
    CONSTRAINT chk_log_status CHECK (
        status IN ('Success', 'Failure')
    )
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE UserSession (
    session_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    login_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_time DATETIME NULL,
    
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) 
        REFERENCES User(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_session_times CHECK (
        logout_time IS NULL OR logout_time > login_time
    )
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_plan_client ON Plan(client_id);

CREATE INDEX idx_customer_client ON Customer(client_id);

CREATE INDEX idx_user_client ON User(client_id, username);
CREATE INDEX idx_user_created_by ON User(created_by);

CREATE INDEX idx_subscription_client ON Subscription(client_id);
CREATE INDEX idx_subscription_customer ON Subscription(customer_id);
CREATE INDEX idx_subscription_dates ON Subscription(status, end_date);

CREATE INDEX idx_invoice_subscription ON Invoice(subscription_id);
CREATE INDEX idx_invoice_dates ON Invoice(status, due_date);

CREATE INDEX idx_payment_invoice ON Payment(invoice_id);
CREATE INDEX idx_payment_date ON Payment(payment_date);

CREATE INDEX idx_penalty_applied ON OverduePenalty(applied);
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
        DATE_ADD(NEW.start_date, INTERVAL 15 DAY),
        plan_price
    );
END$$

CREATE TRIGGER update_invoice_on_payment
AFTER INSERT ON Payment
FOR EACH ROW
BEGIN
    DECLARE total_paid DECIMAL(12,2);
    DECLARE invoice_amount DECIMAL(12,2);
    DECLARE new_status VARCHAR(20);
    
    IF NEW.status = 'Success' THEN
        SELECT SUM(amount) INTO total_paid
        FROM Payment
        WHERE invoice_id = NEW.invoice_id AND status = 'Success';
        
        SELECT amount INTO invoice_amount
        FROM Invoice
        WHERE invoice_id = NEW.invoice_id;
        
        IF total_paid >= invoice_amount THEN
            SET new_status = 'Paid';
        ELSEIF total_paid > 0 THEN
            SET new_status = 'Partial';
        ELSE
            SET new_status = 'Pending';
        END IF;
        
        UPDATE Invoice
        SET paid_amount = total_paid,
            status = new_status,
            paid_date = CASE 
                WHEN total_paid >= amount THEN NEW.payment_date
                ELSE NULL
            END
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
    
    SET v_user_id = NEW.user_id;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'INSERT', 'UserSession', NOW(), 'Success');
END$$

CREATE TRIGGER log_user_session_update
AFTER UPDATE ON UserSession
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    SET v_user_id = NEW.user_id;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'UPDATE', 'UserSession', NOW(), 'Success');
END$$

CREATE TRIGGER log_user_session_delete
AFTER DELETE ON UserSession
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT DEFAULT 1;
    
    SET v_user_id = OLD.user_id;
    
    INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
    VALUES (v_user_id, 'DELETE', 'UserSession', NOW(), 'Success');
END$$

CREATE PROCEDURE SetCurrentUser(IN p_user_id INT)
BEGIN
    SET @current_user_id = p_user_id;
END$$

CREATE FUNCTION GetCurrentUser() RETURNS INT
DETERMINISTIC
BEGIN
    RETURN @current_user_id;
END$$

DELIMITER ;

CREATE VIEW ActiveSubscriptions AS
SELECT 
    s.subscription_id,
    cl.client_id,
    cl.company_name AS client_company,
    cu.customer_id,
    cu.company_name AS customer_company,
    p.plan_name,
    p.monthly_price,
    s.start_date,
    s.end_date,
    s.auto_renew,
    DATEDIFF(s.end_date, CURDATE()) AS days_remaining,
    CASE 
        WHEN s.end_date IS NULL THEN 'No end date'
        WHEN s.end_date > CURDATE() THEN 'Active'
        WHEN s.end_date <= CURDATE() THEN 'Expired'
    END AS subscription_status
FROM Subscription s
JOIN Client cl ON s.client_id = cl.client_id
LEFT JOIN Customer cu ON s.customer_id = cu.customer_id
JOIN Plan p ON s.plan_id = p.plan_id
WHERE s.status = 'Active'
  AND cl.client_id > 1;


CREATE VIEW OverdueInvoicesWithPenalty AS
SELECT 
    i.invoice_id,
    cl.client_id,
    cl.company_name AS client_company,
    cu.company_name AS customer_company,
    i.invoice_date,
    i.due_date,
    i.amount,
    i.paid_amount,
    i.amount - i.paid_amount AS unpaid_amount,
    DATEDIFF(CURDATE(), i.due_date) AS days_overdue,
    ROUND(
        (i.amount - i.paid_amount) * 0.01 *
        GREATEST(DATEDIFF(CURDATE(), i.due_date), 0),
        2
    ) AS current_penalty,
    i.status,
    EXISTS (
        SELECT 1 
        FROM OverduePenalty op 
        WHERE op.invoice_id = i.invoice_id 
          AND op.applied = TRUE
    ) AS has_applied_penalty
FROM Invoice i
JOIN Subscription s ON i.subscription_id = s.subscription_id
JOIN Client cl ON s.client_id = cl.client_id
LEFT JOIN Customer cu ON s.customer_id = cu.customer_id
WHERE (
        i.status = 'Overdue'
        OR (i.status = 'Pending' AND i.due_date < CURDATE())
      )
  AND cl.client_id > 1;


ALTER TABLE Client AUTO_INCREMENT = 2;

ALTER TABLE User AUTO_INCREMENT = 2;