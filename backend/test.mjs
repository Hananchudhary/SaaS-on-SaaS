/**
 * Complex integration tests for SaaS-on-SaaS backend.
 *
 * Server must already be running.
 *
 * Run:
 *   node backend/test.mjs   (from repo root) OR node test.mjs (from backend/)
 *
 * Env:
 *   BASE_URL        default http://localhost:3000
 *   ADMIN_EMAIL     optional: existing user email to login (tenant A)
 *   ADMIN_PASSWORD  optional: existing user password
 *
 * This script tests:
 * - Auth: login/logout + missing/invalid cases
 * - Signup: create two tenants (A & B) unless ADMIN_* provided for A
 * - Metadata: /tables, /statics
 * - Payments: /pay GET and POST (200 or 402)
 * - Query: malformed SQL, DDL blocked, system tables blocked, RBAC for tier2/tier3
 * - Tenant isolation: ensure tenant A cannot read tenant B rows
 */

import axios from 'axios';
import chalk from 'chalk';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const bcrypt = require('bcrypt');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API = `${BASE_URL}/api/v1`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const TIMEOUT_MS = 15000;
const http = axios.create({ timeout: TIMEOUT_MS, validateStatus: () => true });

let passed = 0;
let failed = 0;

function section(title) {
    console.log(chalk.blue.bold(`\n${title}`));
}

function ok(name, detail = '') {
    passed++;
    console.log(chalk.green('  ✓'), name, detail ? chalk.gray(detail) : '');
}

function bad(name, detail) {
    failed++;
    console.log(chalk.red('  ✗'), name);
    if (detail) console.log(chalk.red('    ') + detail);
}

function isHtml(x) {
    return typeof x === 'string' && x.includes('<!DOCTYPE html>');
}

function safeJson(x) {
    try { return JSON.stringify(x); } catch { return String(x); }
}

function errMsg(resp) {
    const d = resp?.data;
    if (d?.error?.message) return d.error.message;
    if (isHtml(d)) return 'Server returned HTML error page (check server logs)';
    return d != null ? safeJson(d) : `HTTP ${resp?.status ?? '?'}`;
}

function expect(name, resp, expectedStatuses) {
    const exp = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
    if (exp.includes(resp.status)) ok(name, `status=${resp.status}`);
    else bad(name, `expected ${exp.join('|')}, got ${resp.status}. body=${errMsg(resp)}`);
    return exp.includes(resp.status);
}

function parseLogin(resp) {
    const d = resp?.data?.data;
    return {
        sessionId: d?.session_id ?? null,
        clientId: d?.client_id ?? null,
        tierLevel: d?.tier_level ?? null,
        userId: d?.user_id ?? null,
    };
}

function qRows(resp) {
    const d = resp?.data?.data;
    const rows = Array.isArray(d?.rows) ? d.rows : [];
    const count = typeof d?.rows_count === 'number' ? d.rows_count : rows.length;
    return { rows, count };
}

function signupPayload(unique, planId) {
    return {
        company_name: `TestCo_${unique}`,
        email: `${unique}@company.test`,
        phone: '555-0000',
        address: '1 Test St',
        plan_id: planId,
        plan_name1: `Basic_${unique}`,
        tier1_users_plan1: 5,
        tier2_users_plan1: 2,
        tier3_users_plan1: 1,
        price_plan1: 49.99,
        plan_name2: `Pro_${unique}`,
        tier1_users_plan2: 20,
        tier2_users_plan2: 10,
        tier3_users_plan2: 5,
        price_plan2: 99.99,
        plan_name3: `Ent_${unique}`,
        tier1_users_plan3: 100,
        tier2_users_plan3: 50,
        tier3_users_plan3: 25,
        price_plan3: 299.99,
        username: `admin_${unique}`,
        admin_email: `${unique}@admin.test`,
        password: 'TestPass123',
    };
}

async function apiHealth() {
    return http.get(`${BASE_URL}/health`);
}
async function apiSignup(body) {
    return http.post(`${API}/signup`, body, { headers: { 'Content-Type': 'application/json' } });
}
async function apiLogin(email, password) {
    return http.post(`${API}/login`, { email, password }, { headers: { 'Content-Type': 'application/json' } });
}
async function apiLogout(sessionId) {
    return http.post(`${API}/logout`, {}, { headers: { 'x-session-id': sessionId } });
}
async function apiTables(sessionId) {
    return http.get(`${API}/tables`, { headers: { 'x-session-id': sessionId } });
}
async function apiStatics(sessionId) {
    return http.get(`${API}/statics`, { headers: { 'x-session-id': sessionId } });
}
async function apiPayGet(sessionId) {
    return http.get(`${API}/pay`, { headers: { 'x-session-id': sessionId } });
}
async function apiPayPost(sessionId, payment_amount) {
    return http.post(`${API}/pay`, { payment_amount }, { headers: { 'x-session-id': sessionId, 'Content-Type': 'application/json' } });
}
async function apiQuery(sessionId, query) {
    return http.post(`${API}/query`, { query }, { headers: { 'x-session-id': sessionId, 'Content-Type': 'application/json' } });
}

async function ensureTenant(unique, planId) {
    const payload = signupPayload(unique, planId);
    const s = await apiSignup(payload);
    if (!expect(`signup ${unique}`, s, [200, 400, 500])) return null;
    if (s.status !== 200 || s.data?.success !== true) {
        bad(`signup ${unique}`, errMsg(s));
        return null;
    }
    ok(`signup ${unique}`, `admin=${payload.admin_email}`);
    const l = await apiLogin(payload.admin_email, payload.password);
    if (!expect(`login ${unique}`, l, [200, 400, 401, 500])) return null;
    if (l.status !== 200 || l.data?.success !== true) {
        bad(`login ${unique}`, errMsg(l));
        return null;
    }
    const sess = parseLogin(l);
    if (!sess.sessionId || sess.clientId == null) {
        bad(`tenant ${unique}`, `missing session_id/client_id. body=${safeJson(l.data)}`);
        return null;
    }
    ok(`tenant ${unique} ready`, `client_id=${sess.clientId}, tier=${sess.tierLevel}`);
    return { unique, payload, ...sess };
}

async function createUserViaQuery(adminSessionId, clientId, tier, email, username, plainPassword) {
    const hash = await bcrypt.hash(plainPassword, 10);
    const q = `
        INSERT INTO User (client_id, username, email, password_hash, tier_level, status, created_at, created_by)
        VALUES (${clientId}, '${username}', '${email}', '${hash}', ${tier}, 'Active', CURRENT_TIMESTAMP, 1)
    `;
    return apiQuery(adminSessionId, q);
}

async function main() {
    console.log(chalk.bold('SaaS-on-SaaS complex API tests'));
    console.log(chalk.gray(`BASE_URL=${BASE_URL}`));
    if (ADMIN_EMAIL) console.log(chalk.gray(`ADMIN_EMAIL=${ADMIN_EMAIL}`));
    console.log('');

    section('1) Health');
    const h = await apiHealth();
    if (h.status === 200 && h.data?.success === true) ok('GET /health');
    else bad('GET /health', errMsg(h));

    section('2) Auth negative cases');
    expect('login missing body → 400', await http.post(`${API}/login`, {}, { headers: { 'Content-Type': 'application/json' } }), 400);
    expect('login invalid credentials → 400', await apiLogin('nonexistent@test.com', 'wrong'), 400);
    expect('logout missing session → 401', await http.post(`${API}/logout`, {}, { headers: {} }), 401);

    section('3) Setup tenant A and tenant B');
    const stamp = Date.now();
    let tenantA = null;
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
        const l = await apiLogin(ADMIN_EMAIL, ADMIN_PASSWORD);
        
        if (l.status === 200 && l.data?.success === true) {
            tenantA = { unique: 'existing', payload: { admin_email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, ...parseLogin(l) };
            ok('login existing admin', `client_id=${tenantA.clientId}, tier=${tenantA.tierLevel}`);
        } else {
            bad('login existing admin', errMsg(l));
        }
    }
    if (!tenantA) tenantA = await ensureTenant(`a-${stamp}`, 1);
    const tenantB = await ensureTenant(`b-${stamp}`, 2);

    if (!tenantA || !tenantB) {
        section('Summary');
        console.log(chalk.green(`Passed: ${passed}`));
        console.log(chalk.red(`Failed: ${failed}`));
        process.exit(1);
    }

    section('4) Session-required endpoints');
    const t = await apiTables(tenantA.sessionId);
    if (t.status === 200 && t.data?.success === true && Array.isArray(t.data?.data?.tables)) ok('GET /tables → 200 with data.tables[]');
    else bad('GET /tables', errMsg(t));

    const st = await apiStatics(tenantA.sessionId);
    if (st.status === 200 && st.data?.success === true) ok('GET /statics → 200');
    else bad('GET /statics', errMsg(st));

    const pg = await apiPayGet(tenantA.sessionId);
    if (pg.status === 200 && pg.data?.success === true && typeof pg.data?.plan_amount === 'number') ok('GET /pay → 200 (top-level plan_amount)');
    else bad('GET /pay', errMsg(pg));

    const pp = await apiPayPost(tenantA.sessionId, 49.99);
    if ([200, 402].includes(pp.status)) ok('POST /pay → 200|402', `status=${pp.status}`);
    else bad('POST /pay', errMsg(pp));

    section('5) Query safety / restrictions');
    expect('query missing session → 401', await http.post(`${API}/query`, { query: 'SELECT 1' }, { headers: { 'Content-Type': 'application/json' } }), 401);
    expect('query malformed → 400', await apiQuery(tenantA.sessionId, 'SELECT FORM Customer'), 400);
    expect('query DDL blocked → 403', await apiQuery(tenantA.sessionId, 'CREATE TABLE evil (id INT)'), 403);
    if (tenantA.clientId !== 1) {
        expect('query system table Client blocked → 403', await apiQuery(tenantA.sessionId, 'SELECT * FROM Client'), 403);
        expect('query system table UserSession blocked → 403', await apiQuery(tenantA.sessionId, 'SELECT * FROM UserSession'), 403);
    }

    const sel = await apiQuery(tenantA.sessionId, 'SELECT 1 AS n');
    if (sel.status === 200 && sel.data?.success === true) ok('query SELECT 1 → 200');
    else bad('query SELECT 1', errMsg(sel));

    section('6) RBAC (tier2/tier3)');
    const u2Email = `tier2-${stamp}@test.local`;
    const u3Email = `tier3-${stamp}@test.local`;
    const u2Pass = 'Tier2Pass123';
    const u3Pass = 'Tier3Pass123';

    const c2 = await createUserViaQuery(tenantA.sessionId, tenantA.clientId, 2, u2Email, `tier2_${stamp}`, u2Pass);
    if (c2.status === 200 && c2.data?.success === true) ok('create tier2 user (via /query)');
    else bad('create tier2 user', errMsg(c2));

    const c3 = await createUserViaQuery(tenantA.sessionId, tenantA.clientId, 3, u3Email, `tier3_${stamp}`, u3Pass);
    if (c3.status === 200 && c3.data?.success === true) ok('create tier3 user (via /query)');
    else bad('create tier3 user', errMsg(c3));

    const l2 = await apiLogin(u2Email, u2Pass);
    if (l2.status === 200 && l2.data?.success === true) ok('login tier2');
    else bad('login tier2', errMsg(l2));
    const s2 = parseLogin(l2);

    const l3 = await apiLogin(u3Email, u3Pass);
    if (l3.status === 200 && l3.data?.success === true) ok('login tier3');
    else bad('login tier3', errMsg(l3));
    const s3 = parseLogin(l3);

    if (s3.sessionId) {
        expect('tier3 SELECT allowed → 200', await apiQuery(s3.sessionId, 'SELECT 1'), 200);
        expect('tier3 UPDATE denied → 403', await apiQuery(s3.sessionId, `UPDATE Customer SET phone='x' WHERE client_id=${tenantA.clientId} LIMIT 1`), 403);
        expect('tier3 INSERT denied → 403', await apiQuery(s3.sessionId, `INSERT INTO Customer (client_id, company_name, email, status) VALUES (${tenantA.clientId}, 'X', 'x@x', 'Active')`), 403);
    }

    if (s2.sessionId) {
        expect('tier2 SELECT allowed → 200', await apiQuery(s2.sessionId, 'SELECT 1'), 200);
        expect('tier2 UPDATE allowed → 200', await apiQuery(s2.sessionId, `UPDATE Customer SET phone='x' WHERE client_id=${tenantA.clientId} LIMIT 1`), 200);
        expect('tier2 INSERT denied → 403', await apiQuery(s2.sessionId, `INSERT INTO Customer (client_id, company_name, email, status) VALUES (${tenantA.clientId}, 'X', 'x@x', 'Active')`), 403);
        expect('tier2 DELETE denied → 403', await apiQuery(s2.sessionId, `DELETE FROM Customer WHERE client_id=${tenantA.clientId} LIMIT 1`), 403);
    }

    section('7) Tenant isolation (no cross-tenant read leakage)');
    const aCustEmail = `a-${stamp}@cust.test`;
    const bCustEmail = `b-${stamp}@cust.test`;

    const insA = await apiQuery(tenantA.sessionId, `INSERT INTO Customer (client_id, company_name, email, phone, status) VALUES (${tenantA.clientId}, 'Alpha', '${aCustEmail}', '555', 'Active')`);
    if (insA.status === 200 && insA.data?.success === true) ok('insert customer A');
    else bad('insert customer A', errMsg(insA));

    const insB = await apiQuery(tenantB.sessionId, `INSERT INTO Customer (client_id, company_name, email, phone, status) VALUES (${tenantB.clientId}, 'Beta', '${bCustEmail}', '555', 'Active')`);
    if (insB.status === 200 && insB.data?.success === true) ok('insert customer B');
    else bad('insert customer B', errMsg(insB));

    const leak = await apiQuery(tenantA.sessionId, `SELECT customer_id, client_id, email FROM Customer WHERE email='${bCustEmail}'`);
    if (leak.status === 200 && leak.data?.success === true) {
        const { rows } = qRows(leak);
        if (rows.length === 0) ok('A cannot see B customer (0 rows)');
        else bad('Tenant isolation leak', `A saw rows=${safeJson(rows)}`);
    } else if (leak.status === 403) {
        ok('Cross-tenant access blocked (403)');
    } else {
        bad('Tenant isolation check', errMsg(leak));
    }

    section('8) Logout and post-logout behavior');
    const lo = await apiLogout(tenantA.sessionId);
    if (lo.status === 200 && lo.data?.success === true) ok('logout tenantA → 200');
    else bad('logout tenantA', errMsg(lo));

    const after = await apiTables(tenantA.sessionId);
    expect('tables after logout → 400', after, 400);

    section('Summary');
    console.log(chalk.green(`Passed: ${passed}`));
    if (failed > 0) {
        console.log(chalk.red(`Failed: ${failed}`));
        process.exit(1);
    }
    console.log(chalk.green('All tests passed.'));
}

main().catch((e) => {
    console.error(chalk.red('Fatal:'), e);
    process.exit(1);
});
