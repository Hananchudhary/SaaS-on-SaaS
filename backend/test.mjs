/**
 * test.mjs — Comprehensive Execute Query Integration Test Suite
 * Covers: Tier Level Permissions (1, 2, 3), Tenant Isolation,
 *         Disallowed DDL, Meta Queries, and System User Access.
 * 
 * Requires the backend server to be running on port 3000.
 */

import axios from 'axios';
import chalk from 'chalk';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, 'config.env') });

// ─── Globals ─────────────────────────────────────────────────────────────────
const API = 'http://localhost:3000/api/v1';
const TS = Date.now();
let passed = 0;
let failed = 0;
let db;

// ─── Colour helpers ───────────────────────────────────────────────────────────
const section = (title) => console.log('\n' + chalk.bold.cyan(title));
const ok = (msg) => { passed++; console.log(chalk.green('  ✓ ') + msg); };
const bad = (msg) => { failed++; console.log(chalk.red('  ✗ ') + msg); };

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
const http = axios.create({
    baseURL: API,
    timeout: 20_000,
    validateStatus: () => true
});

const apiLogin = (email, password) => http.post('/login', { email, password });
const apiSignup = (payload) => http.post('/signup', payload);
const apiQuery = (sessionId, query) => http.post('/query', { query }, { headers: { 'x-session-id': sessionId } });

function expect(label, res, expected) {
    const statuses = Array.isArray(expected) ? expected : [expected];
    if (statuses.includes(res.status)) {
        ok(`${label} (status=${res.status})`);
        return true;
    } else {
        bad(`${label}\n    expected ${statuses.join(' or ')}, got ${res.status}. body=${JSON.stringify(res.data)}`);
        return false;
    }
}

// ─── Payload Factory ─────────────────────────────────────────────────────────
function makeTenant(prefix, planId = 1) {
    return {
        company_name: `${prefix}_co_${TS}`,
        email: `${prefix}_${TS}@company.test`,
        plan_id: planId,
        plan_name1: 'Basic', tier1_users_plan1: 5, tier2_users_plan1: 2, tier3_users_plan1: 1, price_plan1: 10,
        plan_name2: 'Pro', tier1_users_plan2: 20, tier2_users_plan2: 10, tier3_users_plan2: 5, price_plan2: 50,
        plan_name3: 'Ent', tier1_users_plan3: 100, tier2_users_plan3: 50, tier3_users_plan3: 20, price_plan3: 200,
        username: `${prefix}_admin`,
        admin_email: `${prefix}_admin_${TS}@test.com`,
        password: 'Password123!'
    };
}

async function setupTenant(prefix, tierLevel = 1) {
    const payload = makeTenant(prefix);
    const res = await apiSignup(payload);
    if (res.status !== 200) throw new Error(`Signup failed for ${prefix}: ${JSON.stringify(res.data)}`);
    
    const loginRes = await apiLogin(payload.admin_email, payload.password);
    const data = loginRes.data.data;
    
    // Manually adjust tier level in DB if it's not the default (1)
    if (tierLevel !== 1) {
        await db.query('UPDATE User SET tier_level = ? WHERE user_id = ?', [tierLevel, data.user_id]);
        data.tier_level = tierLevel;
    }
    
    return { ...data, password: payload.password, email: payload.admin_email };
}

async function main() {
    console.log(chalk.bold.yellow('\nSaaS-on-SaaS: Execute Query Integration Tests\n'));

    db = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'saas_db'
    });

    try {
        // ─── Setup Test Tenants ──────────────────────────────────────────────────
        section('0) Setup Test Data');
        const t1 = await setupTenant('tier1', 1); // Enterprise
        const t2 = await setupTenant('tier2', 2); // Pro
        const t3 = await setupTenant('tier3', 3); // Free
        
        ok('Tenants initialized: t1 (Tier 1), t2 (Tier 2), t3 (Tier 3)');

        // ─── Tier Permissions ────────────────────────────────────────────────────
        section('1) Tier Permission Enforcement');
        
        // Tier 1: SELECT, INSERT, UPDATE, DELETE
        expect('Tier 1: SELECT → 200', await apiQuery(t1.session_id, 'SELECT 1'), 200);
        const t1Insert = await apiQuery(t1.session_id, `INSERT INTO Plan (client_id, plan_name, tier_1_users, tier_2_users, tier_3_users, monthly_price) VALUES (${t1.client_id}, 'Tier1_Extra_${TS}', 1, 1, 1, 99)`);
        expect('Tier 1: INSERT → 200', t1Insert, 200);
        expect('Tier 1: UPDATE → 200', await apiQuery(t1.session_id, `UPDATE Plan SET plan_name = 'Tier1_Updated_${TS}' WHERE client_id = ${t1.client_id} AND plan_name = 'Tier1_Extra_${TS}'`), 200);
        expect('Tier 1: DELETE → 200', await apiQuery(t1.session_id, `DELETE FROM Plan WHERE plan_name = 'Tier1_Updated_${TS}'`), 200);

        // Tier 2: SELECT, UPDATE allowed. INSERT, DELETE blocked.
        expect('Tier 2: SELECT → 200', await apiQuery(t2.session_id, 'SELECT 1'), 200);
        expect('Tier 2: UPDATE → 200', await apiQuery(t2.session_id, `UPDATE Plan SET monthly_price = 11 WHERE client_id = ${t2.client_id}`), 200);
        expect('Tier 2: INSERT → 403', await apiQuery(t2.session_id, `INSERT INTO Plan (client_id, plan_name, tier_1_users, tier_2_users, tier_3_users, monthly_price) VALUES (${t2.client_id}, 'Fail', 1, 1, 1, 1)`), 403);
        expect('Tier 2: DELETE → 403', await apiQuery(t2.session_id, `DELETE FROM Plan WHERE client_id = ${t2.client_id}`), 403);

        // Tier 3: SELECT allowed. UPDATE, INSERT, DELETE blocked.
        expect('Tier 3: SELECT → 200', await apiQuery(t3.session_id, 'SELECT 1'), 200);
        expect('Tier 3: UPDATE → 403', await apiQuery(t3.session_id, `UPDATE Plan SET plan_name = 'Fail' WHERE client_id = ${t3.client_id}`), 403);
        expect('Tier 3: INSERT → 403', await apiQuery(t3.session_id, `INSERT INTO Plan (client_id, plan_name, tier_1_users, tier_2_users, tier_3_users, monthly_price) VALUES (${t3.client_id}, 'Fail', 1, 1, 1, 1)`), 403);
        expect('Tier 3: DELETE → 403', await apiQuery(t3.session_id, `DELETE FROM Plan WHERE client_id = ${t3.client_id}`), 403);

        // ─── Tenant Isolation ────────────────────────────────────────────────────
        section('2) Tenant Isolation (Data Leakage & Cross-Access)');
        
        // Leakage: t1 tries to see t2's data
        const t1SeeT2 = await apiQuery(t1.session_id, `SELECT * FROM Plan WHERE client_id = ${t2.client_id}`);
        expect('Tenant A query Tenant B data → 200 (Success, but returns 0 rows)', t1SeeT2, 200);
        if (t1SeeT2.data?.data?.rows_count === 0) {
            ok('Leakage blocked: Query returned 0 rows as expected');
        } else {
            bad(`Leakage detected! Tenant 1 saw ${t1SeeT2.data?.data?.rows_count} rows from Tenant 2`);
        }

        // Modification Leakage: t1 tries to delete t2's plans
        const t1DeleteT2 = await apiQuery(t1.session_id, `DELETE FROM Plan WHERE client_id = ${t2.client_id}`);
        expect('Tenant A DELETE Tenant B data → 200', t1DeleteT2, 200);
        if (t1DeleteT2.data?.data?.affectedRows === 0) {
            ok('Unauthorized modification blocked: 0 rows affected');
        } else {
            bad(`Leakage detected! Tenant 1 deleted ${t1DeleteT2.data?.data?.affectedRows} rows from Tenant 2`);
        }

        // Restricted Tables: Client table access
        expect('Tenant access to Client table → 403', await apiQuery(t1.session_id, 'SELECT * FROM Client'), 403);
        expect('Tenant access to UserSession table → 403', await apiQuery(t1.session_id, 'SELECT * FROM UserSession'), 403);

        // ─── Query Validation (DDL & Meta) ───────────────────────────────────────
        section('3) Query Validation (DDL & Meta)');
        
        expect('DDL: DROP TABLE → 403', await apiQuery(t1.session_id, 'DROP TABLE User'), 403);
        expect('DDL: ALTER TABLE → 403', await apiQuery(t1.session_id, 'ALTER TABLE User ADD COLUMN hacked INT'), 403);
        expect('DDL: CREATE TABLE → 403', await apiQuery(t1.session_id, 'CREATE TABLE dummy (id INT)'), 403);

        expect('Meta: SHOW TABLES → 200', await apiQuery(t1.session_id, 'SHOW TABLES'), 200);
        expect('Meta: DESCRIBE Plan → 200', await apiQuery(t1.session_id, 'DESCRIBE Plan'), 200);

        // ─── Cleanup ─────────────────────────────────────────────────────────────
        section('4) Cleanup');
        await db.query('DELETE FROM Client WHERE email LIKE ?', [`%_${TS}%`]);
        ok('Test data cleaned up from Database');

    } catch (err) {
        bad('Unexpected Error: ' + err.message);
        console.error(err);
    } finally {
        console.log(chalk.bold('\nFINAL SUMMARY'));
        console.log(`Total Passed: ${passed}`);
        if (failed > 0) {
            console.log(chalk.red(`Total Failed: ${failed}`));
            process.exit(1);
        } else {
            console.log(chalk.green('All execute-query tests passed!'));
        }
        if (db) db.end();
    }
}

main();