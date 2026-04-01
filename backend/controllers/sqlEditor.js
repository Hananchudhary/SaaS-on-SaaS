// controllers/queryController.js
const { pool, withTransaction } = require('../models/db');
const { ErrorCodes, createErrorResponse } = require('../middleware/error_handling');
const sqlParser = require('node-sql-parser');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const parser = new sqlParser.Parser();

// Statement types that are disallowed entirely (DDL, administrative commands)
const DISALLOWED_STATEMENT_TYPES = [
    'create', 'alter', 'drop', 'truncate', 'rename',
    'lock', 'unlock', 'grant', 'revoke',
    'commit', 'rollback', 'savepoint',
    'prepare', 'execute', 'deallocate',
    'set'
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
            // normalize from or table clause to array
            let fromItems = [];
            if (node.from) {
                fromItems = Array.isArray(node.from) ? node.from : [node.from];
            } else if (node.table) {
                fromItems = Array.isArray(node.table) ? node.table : [node.table];
            }

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
const generateTenantCondition = (tableName, clientId, tablealias) => {
    if (clientId === 1) return null; // system sees all
    const safeClientId = parseInt(clientId, 10);
    const alias = tablealias ? `${tablealias}.` : '';
    switch (tableName.toLowerCase()) {
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
    if (clientId === 1 || tables.length === 0) return sql; // system client sees all

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
            else if (ast.type === 'desc' || ast.type === 'describe') type = 'DESCRIBE';
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
// Export helpers
// ----------------------------------------------------------------------

const buildExcelBuffer = async (rows) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Export');
    const columns = Object.keys(rows[0] || {});

    worksheet.columns = columns.map(key => ({ header: key, key }));
    rows.forEach(row => worksheet.addRow(row));

    return workbook.xlsx.writeBuffer();
};

const buildPdfBuffer = async (rows) => {
    return new Promise((resolve, reject) => {
        // Use landscape layout to give more horizontal room for columns
        const doc = new PDFDocument({ margin: 40, layout: 'landscape' });
        const chunks = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add an attractive title
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#2c3e50').text('Export Data', { align: 'center' });
        doc.moveDown(1.5);

        if (!rows || rows.length === 0) {
            doc.fontSize(12).font('Helvetica').fillColor('#7f8c8d').text('No data available.', { align: 'center' });
            doc.end();
            return;
        }

        const columns = Object.keys(rows[0] || {});
        // Automatically calculate column width to span the page width
        const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const columnWidth = usableWidth / columns.length;
        const startX = doc.page.margins.left;
        let startY = doc.y;

        // Helper to draw the header row
        const drawHeader = (y) => {
            // Determine header height
            let headerHeight = 24; // minimum
            doc.font('Helvetica-Bold').fontSize(10);
            columns.forEach(col => {
                const height = doc.heightOfString(col, { width: columnWidth - 10, align: 'left' });
                if (height + 12 > headerHeight) headerHeight = height + 12;
            });

            doc.rect(startX, y, usableWidth, headerHeight).fill('#34495e'); // dark header background
            doc.fillColor('#ffffff');
            columns.forEach((col, i) => {
                doc.text(col, startX + i * columnWidth + 5, y + 6, {
                    width: columnWidth - 10,
                    align: 'left'
                });
            });
            // Draw column dividers for header
            doc.lineWidth(0.5).strokeColor('#2c3e50');
            for (let i = 0; i <= columns.length; i++) {
                doc.moveTo(startX + i * columnWidth, y)
                   .lineTo(startX + i * columnWidth, y + headerHeight)
                   .stroke();
            }
            // Draw border outline
            doc.moveTo(startX, y).lineTo(startX + usableWidth, y).stroke();
            doc.moveTo(startX, y + headerHeight).lineTo(startX + usableWidth, y + headerHeight).stroke();
            
            return y + headerHeight;
        };

        startY = drawHeader(startY);

        // Draw each row
        rows.forEach((row, rowIndex) => {
            // Pre-calculate the maximum height needed for this row
            let rowHeight = 24; // minimum
            doc.font('Helvetica').fontSize(10);
            columns.forEach(col => {
                let value = row[col];
                if (value === null || value === undefined) value = '';
                else value = String(value);

                const height = doc.heightOfString(value, { width: columnWidth - 10, align: 'left' });
                if (height + 12 > rowHeight) rowHeight = height + 12; // 6px padding on top and bottom
            });

            // Check if we need to wrap to a new page
            if (startY + rowHeight > doc.page.height - doc.page.margins.bottom) {
                doc.addPage({ margin: 40, layout: 'landscape' });
                startY = doc.page.margins.top;
                startY = drawHeader(startY); // Redraw header on new page
            }

            // Zebra striping for better readability
            if (rowIndex % 2 === 0) {
                doc.rect(startX, startY, usableWidth, rowHeight).fill('#f2f6f8');
            } else {
                doc.rect(startX, startY, usableWidth, rowHeight).fill('#ffffff');
            }

            doc.fillColor('#333333').font('Helvetica');
            
            // Draw column values
            columns.forEach((col, i) => {
                let value = row[col];
                if (value === null || value === undefined) value = '';
                else value = String(value);

                doc.text(value, startX + i * columnWidth + 5, startY + 6, {
                    width: columnWidth - 10,
                    align: 'left'
                });
            });

            // Draw vertical borders (cell dividers)
            doc.lineWidth(0.5).strokeColor('#e0e0e0');
            for (let i = 0; i <= columns.length; i++) {
                doc.moveTo(startX + i * columnWidth, startY)
                   .lineTo(startX + i * columnWidth, startY + rowHeight)
                   .stroke();
            }

            // Draw bottom border
            doc.moveTo(startX, startY + rowHeight)
               .lineTo(startX + usableWidth, startY + rowHeight)
               .stroke();

            startY += rowHeight;
        });

        doc.end();
    });
};

const extractExportRows = (responseData) => {
    if (!responseData || !responseData.data) return { ok: false, message: 'responseData is required' };

    const rowCount = responseData.data.rows_count;
    if (rowCount === null || rowCount === undefined) {
        return { ok: false, message: 'rows_count is required' };
    }

    const numericCount = Number(rowCount);
    if (!Number.isFinite(numericCount) || numericCount <= 0) {
        return { ok: false, message: 'rows_count must be greater than 0' };
    }

    const rows = responseData.data.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
        return { ok: false, message: 'rows are required for export' };
    }

    return { ok: true, rows };
};

// ----------------------------------------------------------------------
// Main endpoint handler
// ----------------------------------------------------------------------

const executeQuery = async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    const { query } = req.body;

    if (!sessionId) {
        return res.status(401).json(createErrorResponse(ErrorCodes.SESSION_NOT_FOUND));
    }
    if (!query) {
        return res.status(400).json(createErrorResponse(
            ErrorCodes.INVALID_QUERY,
            'Query string is required'
        ));
    }

    try {
        const responseData = await withTransaction(async (connection) => {
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

            if (sessions.length === 0) throw { status: 401, code: ErrorCodes.SESSION_NOT_FOUND };

            const session = sessions[0];
            const clientId = session.client_id;
            const userId = session.user_id;
            const tierLevel = session.tier_level;

            if (session.user_status !== 'Active') throw { status: 401, code: ErrorCodes.USER_INACTIVE };
            if (session.client_status !== 'Active') throw { status: 401, code: ErrorCodes.CLIENT_INACTIVE };
            if (!session.canAccessEditor) throw { status: 403, code: ErrorCodes.EDITOR_ACCESS_DISABLED };

            await connection.query('SET @current_user_id = ?', [userId]);

            const validation = validateQueryStructure(query);
            if (!validation.valid) throw { status: 400, code: ErrorCodes.INVALID_QUERY };
            const ast = validation.ast;

            if (containsDisallowedDDL(ast)) throw { status: 403, code: ErrorCodes.CREATE_ALTER_DROP_NOT_ALLOWED };

            const parsed = parseQuery(query);
            if (!parsed.type) throw { status: 400, code: ErrorCodes.INVALID_QUERY };
            const operation = parsed.type;

            const tables = getTableNamesFromAST(ast);

            if (clientId !== 1) {
                const blocked = tables.some(t => {
                    const name = t && typeof t.name === 'string' ? t.name.toLowerCase() : '';
                    return name === 'client' || name === 'usersession';
                });
                if (blocked) throw { status: 403, code: ErrorCodes.CROSS_TENANT_ACCESS_DENIED };
            }

            if (!checkTierPermission(tierLevel, operation)) {
                if (tierLevel === 3) throw { status: 403, code: ErrorCodes.TIER3_OPERATION_DENIED };
                if (tierLevel === 2) throw { status: 403, code: ErrorCodes.TIER2_OPERATION_DENIED };
                throw { status: 403, code: ErrorCodes.QUERY_NOT_ALLOWED };
            }
            console.log(`query: ${query}`);
            const finalQuery = enforceTenantIsolation(query, clientId, tables);
            console.log(`finalQuery: ${finalQuery}`);
            try {
                const [results] = await connection.query(finalQuery);

                const tableNames = tables.map(t => t.name).join(',');
                await connection.query(
                    `INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
                     VALUES (?, ?, ?, NOW(), 'Success')`,
                    [userId, operation, tableNames]
                );

                const responseData = { success: true, data: {} };
                if (operation.toUpperCase() === 'SELECT') {
                    responseData.data.rows_count = results.length;
                    responseData.data.rows = results;
                } else if (operation.toUpperCase() === 'INSERT') {
                    responseData.data.insertId = results.insertId;
                } else if (operation.toUpperCase() === 'UPDATE' || operation.toUpperCase() === 'DELETE') {
                    responseData.data.affectedRows = results.affectedRows;
                } else {
                    responseData.data.message = 'Query executed';
                }
                return responseData;
            } catch (queryError) {
                const tableNames = tables.map(t => t.name).join(',');
                try {
                    await connection.query(
                        `INSERT INTO AccessLog (user_id, action, table_name, timestamp, status)
                         VALUES (?, ?, ?, NOW(), 'Failure')`,
                        [userId, operation, tableNames]
                    );
                } catch (logError) {
                    console.error('Failed to log failed query:', logError);
                }
                throw { 
                    status: 400, 
                    code: ErrorCodes.QUERY_EXECUTION_FAILED, 
                    message: queryError.message 
                };
            }
        }, { isolationLevel: 'REPEATABLE READ' });

        return res.status(200).json(responseData);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json(createErrorResponse(error.code, error.message));
        }
        console.error('[Query] System error:', error);
        return res.status(500).json(createErrorResponse(ErrorCodes.UNKNOWN_ERROR));
    }
};

const exportData = async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    const { responseData, exportType } = req.body || {};

    if (!sessionId) {
        return res.status(401).json(createErrorResponse(ErrorCodes.SESSION_NOT_FOUND));
    }

    const extractResult = extractExportRows(responseData);
    if (!extractResult.ok) {
        return res.status(400).json(createErrorResponse(
            ErrorCodes.INVALID_DATA,
            extractResult.message
        ));
    }

    const format = String(exportType || '').trim().toLowerCase();
    if (!format) {
        return res.status(400).json(createErrorResponse(
            ErrorCodes.INVALID_DATA,
            'exportType is required'
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
                 JOIN Client c ON u.client_id = c.client_id
                 WHERE us.session_id = ? 
                   AND us.logout_time IS NULL 
                 FOR UPDATE`,
                [sessionId]
            );

            if (sessions.length === 0) throw { status: 401, code: ErrorCodes.SESSION_NOT_FOUND };
            const session = sessions[0];

            if (session.user_status !== 'Active') throw { status: 401, code: ErrorCodes.USER_INACTIVE };
            if (session.client_status !== 'Active') throw { status: 401, code: ErrorCodes.CLIENT_INACTIVE };
        }, {isolationLevel: 'READ COMMITTED'});
        if (format === 'excel' || format === 'xlsx') {
            const buffer = await buildExcelBuffer(extractResult.rows);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="export.xlsx"');
            return res.status(200).send(buffer);
        }

        if (format === 'pdf') {
            const buffer = await buildPdfBuffer(extractResult.rows);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="export.pdf"');
            return res.status(200).send(buffer);
        }

        return res.status(400).json(createErrorResponse(
            ErrorCodes.INVALID_DATA,
            'exportType must be PDF or EXCEL'
        ));
    } catch (error) {
        console.error('[ExportData] Error:', error);
        return res.status(500).json(createErrorResponse(ErrorCodes.UNKNOWN_ERROR));
    }
};

module.exports = { executeQuery, exportData };
