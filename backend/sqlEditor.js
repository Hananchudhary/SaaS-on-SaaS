// controllers/queryController.js
const pool = require('./db');
const { ErrorCodes, createErrorResponse } = require('./error_handling');
const sqlParser = require('node-sql-parser');

const parser = new sqlParser.Parser();

// Statement types that are disallowed entirely (DDL, administrative commands)
const DISALLOWED_STATEMENT_TYPES = [
    'create', 'alter', 'drop', 'truncate', 'rename',
    'lock', 'unlock', 'grant', 'revoke',
    'commit', 'rollback', 'savepoint',
    'prepare', 'execute', 'deallocate',
    'set', 'show', 'describe', 'explain',  // show/desc/explain are allowed but handled separately
];

// Allowed DML operations per tier (tier1: read-only, tier2: update, tier3: full)
const TIER_PERMISSIONS = {
    3: ['SELECT', 'SHOW', 'DESCRIBE'],
    2: ['SELECT', 'SHOW', 'DESCRIBE', 'UPDATE'],
    1: ['SELECT', 'SHOW', 'DESCRIBE', 'INSERT', 'UPDATE', 'DELETE']
};

// ----------------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------------

/**
 * Check if the query contains any disallowed DDL statements.
 * Uses the AST to detect statement types.
 */
const containsDisallowedDDL = (ast) => {
    const statements = Array.isArray(ast) ? ast : [ast];
    for (const stmt of statements) {
        if (DISALLOWED_STATEMENT_TYPES.includes(stmt.type)) {
            return true;
        }
        // Additional checks for CREATE variants (view, trigger, etc.)
        if (stmt.type === 'create' && (stmt.view || stmt.trigger || stmt.procedure || stmt.function)) {
            return true;
        }
    }
    return false;
};

/**
 * Validate SQL syntax and return AST.
 */
const validateQueryStructure = (sql) => {
    try {
        const ast = parser.astify(sql);
        return { valid: true, ast };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

/**
 * Extract all table names and aliases from AST (including subqueries and joins).
 */
const getTableNamesFromAST = (ast) => {
    const tables = [];

    const extractFromNode = (node) => {
        if (!node) return;

        // Handle SELECT, DELETE, UPDATE
        if (
            (node.type === 'select' && node.from) ||
            (node.type === 'delete' && node.from) ||
            (node.type === 'update' && node.table)
        ) {
            // normalize from clause to array
            const fromItems = node.from
                ? Array.isArray(node.from)
                    ? node.from
                    : [node.from]
                : [];

            fromItems.forEach(item => {
                if (item?.table) {
                    tables.push({ name: item.table, alias: item.as || null });
                }

                // normalize joins to array
                const joins = item?.join
                    ? Array.isArray(item.join)
                        ? item.join
                        : [item.join]
                    : [];

                joins.forEach(join => {
                    if (join?.table) {
                        tables.push({ name: join.table, alias: join.as || null });
                    }
                });
            });
        }

        // Recurse into WHERE clause
        if (node.where) extractFromWhere(node.where);
    };

    const extractFromWhere = (whereNode) => {
        if (!whereNode) return;

        // handle subqueries safely
        if (whereNode.type === 'subquery' && whereNode.value?.from) {
            const fromArr = Array.isArray(whereNode.value.from)
                ? whereNode.value.from
                : [whereNode.value.from];

            fromArr.forEach(item => {
                if (item?.table) {
                    tables.push({ name: item.table, alias: item.as || null, isSubquery: true });
                }
            });
        }

        if (whereNode.left) extractFromWhere(whereNode.left);
        if (whereNode.right) extractFromWhere(whereNode.right);
    };

    extractFromNode(ast);
    return tables;
};


/**
 * Generate a tenant isolation WHERE condition for a specific table.
 * clientId is already an integer from session, but we cast to be safe.
 */
const generateTenantCondition = (tableName, clientId, tableAliases = {}) => {
    if (clientId === 1) return null; // system sees all
    const safeClientId = parseInt(clientId, 10);
    switch (tableName) {
        case 'plan':
        case 'customer':
        case 'user':
        case 'subscription':
            return `${alias}client_id = ${safeClientId}`;
        case 'invoice':
            return `${alias}subscription_id IN (
                SELECT subscription_id FROM Subscription WHERE client_id = ${safeClientId}
            )`;
        case 'payment':
        case 'overduepenalty':
            return `${alias}invoice_id IN (
                SELECT i.invoice_id FROM Invoice i
                JOIN Subscription s ON i.subscription_id = s.subscription_id
                WHERE s.client_id = ${safeClientId}
            )`;
        case 'accesslog':
            return `${alias}user_id IN (
                SELECT user_id FROM User WHERE client_id = ${safeClientId}
            )`;
        default:
            return null;
    }
};

/**
 * Build combined tenant conditions for all tables in the query.
 */
const buildTenantConditions = (tables, clientId) => {
    if (clientId === 1) return null;
    const conditions = [];
    for (const table of tables) {
        const cond = generateTenantCondition(table.name, clientId, table.alias);
        if (cond) conditions.push(cond);
    }
    return conditions.length ? conditions.join(' AND ') : null;
};

/**
 * Inject tenant conditions into the AST's WHERE clause.
 */
const injectTenantConditions = (ast, tenantCondition, clientId) => {
    if (!tenantCondition || clientId === 1) return ast;

    try {
        // Wrap tenantCondition in a dummy SELECT to parse it
        const dummySQL = `SELECT * FROM dummy WHERE ${tenantCondition}`;
        const dummyAST = parser.astify(dummySQL);
        const tenantExpr = dummyAST.where; // AST node for the tenant condition

        if (!ast.where) {
            ast.where = tenantExpr;
        } else {
            ast.where = {
                type: 'binary_expr',
                operator: 'AND',
                left: ast.where,
                right: tenantExpr
            };
        }

        return ast;
    } catch (error) {
        console.error('Error modifying WHERE clause:', error);
        throw error;
    }
};

/**
 * Main function to enforce tenant isolation on a query.
 * Takes the original SQL, clientId, and pre‑extracted table list.
 */
const enforceTenantIsolation = (sql, clientId, tables) => {
    if (clientId === 1) return sql; // system client sees all

    try {
        const parsed = parseQuery(sql); // we reuse parseQuery to get ast/type
        if (!parsed.success) throw new Error(parsed.error);
        const ast = parsed.ast;

        // For INSERT, we cannot easily rewrite, but constraints will catch invalid client_id.
        // We return original SQL; validation is done by DB.
        if (parsed.type === 'INSERT') {
            return sql;
        }

        const tenantCondition = buildTenantConditions(tables, clientId);
        if (!tenantCondition) return sql;

        const modifiedAst = injectTenantConditions(ast, tenantCondition, clientId);
        return parser.sqlify(modifiedAst);
    } catch (error) {
        console.error('Error in enforceTenantIsolation:', error);
        throw new Error(`Failed to enforce tenant isolation: ${error.message}`);
    }
};

/**
 * Parse SQL and classify statement type.
 */
const parseQuery = (sql) => {
    try {
        const ast = parser.astify(sql);
        let type = null;
        if (ast.type) {
            if (ast.type === 'select') type = 'SELECT';
            else if (ast.type === 'insert') type = 'INSERT';
            else if (ast.type === 'update') type = 'UPDATE';
            else if (ast.type === 'delete') type = 'DELETE';
            else if (ast.type === 'show') type = 'SHOW';
            else if (ast.type === 'desc') type = 'DESCRIBE';
            else type = ast.type.toUpperCase();
        }
        return { success: true, ast, type };
    } catch (error) {
        // Try to detect META commands that the parser might not handle
        const upper = sql.trim().toUpperCase();
        if (upper.startsWith('SHOW') || upper.startsWith('DESC') || upper.startsWith('EXPLAIN')) {
            return { success: true, type: 'META', sql };
        }
        return { success: false, error: error.message };
    }
};

/**
 * Check if the operation is allowed for the given tier.
 */
const checkTierPermission = (tierLevel, operation) => {
    const allowed = TIER_PERMISSIONS[tierLevel] || [];
    return allowed.includes(operation);
};

// ----------------------------------------------------------------------
// Main endpoint handler
// ----------------------------------------------------------------------

const executeQuery = async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    const { query } = req.body;
    let connection;

    try {
        // Validate input
        if (!sessionId) {
            return res.status(401).json(createErrorResponse(ErrorCodes.SESSION_NOT_FOUND));
        }
        if (!query || typeof query !== 'string') {
            return res.status(400).json(createErrorResponse(ErrorCodes.INVALID_QUERY));
        }

        connection = await pool.getConnection();
        if (!connection) {
            return res.status(500).json(createErrorResponse(ErrorCodes.INTERNAL_ERROR));
        }

        // Set transaction isolation and begin
        // await connection.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        await connection.beginTransaction();

        // Verify session and get user/client details with row lock
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
             JOIN Client c ON u.client_id = c.client_id
             WHERE us.session_id = ? 
               AND us.logout_time IS NULL 
             FOR UPDATE`,
            [sessionId]
        );

        if (sessions.length === 0) {
            await connection.rollback();
            return res.status(401).json(createErrorResponse(ErrorCodes.SESSION_NOT_FOUND));
        }

        const session = sessions[0];
        const clientId = session.client_id;
        const userId = session.user_id;
        const tierLevel = session.tier_level;

        // Check account status
        if (session.user_status !== 'Active') {
            await connection.rollback();
            return res.status(401).json(createErrorResponse(ErrorCodes.USER_INACTIVE));
        }
        if (session.client_status !== 'Active') {
            await connection.rollback();
            return res.status(401).json(createErrorResponse(ErrorCodes.CLIENT_INACTIVE));
        }
        if (!session.canAccessEditor) {
            await connection.rollback();
            return res.status(403).json(createErrorResponse(ErrorCodes.EDITOR_ACCESS_DISABLED));
        }

        // Set session variable for triggers
        await connection.query('SET @current_user_id = ?', [userId]);

        // Parse and validate SQL
        const validation = validateQueryStructure(query);
        if (!validation.valid) {
            await connection.rollback();
            return res.status(400).json(createErrorResponse(ErrorCodes.INVALID_QUERY));
        }
        const ast = validation.ast;

        // Check for disallowed DDL
        if (containsDisallowedDDL(ast)) {
            await connection.rollback();
            return res.status(403).json(createErrorResponse(ErrorCodes.CREATE_ALTER_DROP_NOT_ALLOWED));
        }

        // Determine operation type
        const parsed = parseQuery(query);
        if (!parsed.type) {
            await connection.rollback();
            return res.status(400).json(createErrorResponse(ErrorCodes.INVALID_QUERY));
        }
        const operation = parsed.type;

        // Extract all tables from AST
        const tables = getTableNamesFromAST(ast);

        // Block access to system tables for non‑system clients
        if (clientId !== 1) {
            const blocked = tables.some(t => {
                const name = t && typeof t.name === 'string' ? t.name.toLowerCase() : '';
                return name === 'client' || name === 'usersession';
            });
            if (blocked) {
                await connection.rollback();
                return res.status(403).json(createErrorResponse(ErrorCodes.CROSS_TENANT_ACCESS_DENIED));
            }
        }

        console.log(`[Query] Operation: ${operation}, Tables:`, tables);

        // RBAC check
        if (!checkTierPermission(tierLevel, operation)) {
            await connection.rollback();
            if (tierLevel === 3) {
                return res.status(403).json(createErrorResponse(ErrorCodes.TIER3_OPERATION_DENIED));
            } else if (tierLevel === 2) {
                return res.status(403).json(createErrorResponse(ErrorCodes.TIER2_OPERATION_DENIED));
            } else {
                return res.status(403).json(createErrorResponse(ErrorCodes.QUERY_NOT_ALLOWED));
            }
        }

        // Apply tenant isolation
        const finalQuery = enforceTenantIsolation(query, clientId, tables);
        console.log(`[Query] Modified query: ${finalQuery}`);

        // Execute the query
        try {
            const [results] = await connection.query(finalQuery);

            // Log success
            const tableNames = tables.map(t => t.name).join(',');
            await connection.query(
                `INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
                 VALUES (?, ?, ?, NOW(), 'Success')`,
                [userId, operation, tableNames]
            );

            await connection.commit();
            const response = { success: true, data: {} };

            if (operation === 'SELECT') {
                response.data.rows_count = result.length;
                response.data.rows = result;  // actual rows returned
            } 
            else if (operation === 'INSERT') {
                response.data.insertId = result.insertId;
            } 
            else if (operation === 'UPDATE' || operation === 'DELETE') {
                response.data.affectedRows = result.affectedRows;
            } 
            else {
                response.data.message = 'Query executed';
            }
            return res.status(200).json(response);
        } catch (queryError) {
            console.error('[Query] Execution error:', queryError);

            await connection.rollback();

            // Log failure
            const tableNames = tables.map(t => t.name).join(',');
            await connection.query(
                `INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
                 VALUES (?, ?, ?, NOW(), 'Failure')`,
                [userId, operation, tableNames]
            );

            return res.status(400).json(createErrorResponse(
                ErrorCodes.QUERY_EXECUTION_FAILED,
                queryError.message
            ));
        }
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (rollbackError) {
                console.error('[Query] Rollback failed:', rollbackError);
            }
        }

        console.error('[Query] System error:', {
            message: error.message,
            stack: error.stack,
            sessionId
        });

        return res.status(500).json(createErrorResponse(ErrorCodes.UNKNOWN_ERROR));
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = { executeQuery };