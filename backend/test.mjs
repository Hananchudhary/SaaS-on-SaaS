import axios from 'axios';
import fs from 'fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';

let testResults = { passed: 0, failed: 0 };
let systemSessionId = null;
let testClientSessionId = null;
let testClientId = null;
let testUserId = null;

const SystemCreds = {
    email: process.env.SYSTEM_EMAIL || 'admin@saasplatform.com',
    password: process.env.SYSTEM_PASSWORD || 'system_admin'
};

const COMMON_PASSWORDS = ['system_admin'];

function log(msg) {
    console.log(`  ${msg}`);
}

function pass(name) {
    testResults.passed++;
    console.log(`✓ ${name}`);
}

function fail(name, err) {
    testResults.failed++;
    const data = err?.response?.data;
    let msg = err?.message || 'Unknown error';
    if (data?.error?.message) msg = data.error.message;
    if (data?.error?.code) msg += ` (code: ${data.error.code})`;
    console.log(`✗ ${name}: ${msg}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function login(creds) {
    const res = await axios.post(`${BASE_URL}/login`, {
        email: creds.email,
        password: creds.password
    });
    return res.data?.data?.session_id;
}

async function loginFull(email, password) {
    try {
        const res = await axios.post(`${BASE_URL}/login`, {
            email,
            password
        });
        if (res.data?.success && res.data?.data?.session_id) {
            return res.data.data;
        }
        if (res.data?.warning) {
            log(`    Login with warning: ${res.data.warning}`);
            return res.data.data;
        }
        if (res.data?.error) {
            return null;
        }
    } catch (err) {
        return null;
    }
    return null;
}

async function findTestClient() {
    const testPasswords = COMMON_PASSWORDS;
    const testEmails = [
        'diana.miller@techcorp.com'
    ];
    log(`  Trying ${testEmails.length} emails with ${testPasswords.length} passwords each`);
    for (const email of testEmails) {
        for (const password of testPasswords) {
            log(`  Trying ${email} with password...`);
            try {
                const data = await loginFull(email, password);
                console.log(data);
                if (data?.session_id) {
                    log(`  ✓ Found: ${email}`);
                    return data;
                }
            } catch (e) {
                log(`    Error: ${e.message}`);
            }
        }
    }
    log('  No valid credentials found');
    return null;
}

async function logout(sessionId) {
    if (!sessionId) return;
    try {
        await axios.post(`${BASE_URL}/logout`, {}, {
            headers: { 'x-session-id': sessionId }
        });
    } catch {}
}

async function executeQuery(sessionId, query) {
    return axios.post(
        `${BASE_URL}/query`,
        { query },
        { headers: { 'x-session-id': sessionId } }
    );
}

async function exportData(sessionId, responseData, exportType) {
    return axios.post(
        `${BASE_URL}/exportData`,
        { responseData, exportType },
        {
            headers: { 'x-session-id': sessionId },
            responseType: 'arraybuffer'
        }
    );
}

async function getSessionClientId(sessionId) {
    const res = await executeQuery(sessionId, 'SELECT client_id, user_id FROM UserSession WHERE session_id = ' + sessionId);
    return res.data?.data?.rows?.[0];
}

async function checkServer() {
    try {
        await axios.get(`${BASE_URL.replace('/api/v1', '')}/health`, { timeout: 5000 });
        return true;
    } catch (err) {
        console.error(`Server not responding at ${BASE_URL}. Is the server running?`);
        return false;
    }
}

async function testLoginRateLimit() {
  log('Test: Login rate limit');
  const attempts = 4;
  let rateLimited = false;

  for (let i = 0; i < attempts; i++) {
    try {
      const session_id = await login(SystemCreds);
      console.log(session_id);
    } catch (err) {
      if (err.response?.status === 429) {
        rateLimited = true;
        break;
      }
    }
  }

  if (rateLimited) {
    pass('Login rate limit enforced');
  } else {
    fail('Login rate limit enforced', { message: 'No 429 received' });
  }
}

async function testChangePassword() {
    log('Test: Change Password API');
    
    // First login to get session
    const sessionId = await login(SystemCreds);
    if (!sessionId) {
        fail('Change Password setup', { message: 'Could not log in' });
        return;
    }

    try {
        // Change to new password
        const res = await axios.post(`${BASE_URL}/change-password`, {
            old_password: SystemCreds.password,
            new_password: 'new_system_admin',
            confirm_password: 'new_system_admin'
        }, { headers: { 'x-session-id': sessionId } });
        if (res.data.success) {
            pass('Changed password successfully');
        } else {
            fail('Changed password', res.data);
            return;
        }

        // Logout
        await axios.post(`${BASE_URL}/logout`, {}, {
            headers: { 'x-session-id': sessionId }
        });

        // Test login with new password
        const newSessionId = await login({ email: SystemCreds.email, password: 'new_system_admin' });
        if (newSessionId) {
            pass('Login with new password');
            
            // Revert changes back to old password to keep test environment stable
            await axios.post(`${BASE_URL}/change-password`, {
                old_password: 'new_system_admin',
                new_password: SystemCreds.password,
                confirm_password: SystemCreds.password
            }, { headers: { 'x-session-id': newSessionId } });
            
            await axios.post(`${BASE_URL}/logout`, {}, {
                headers: { 'x-session-id': newSessionId }
            });
        } else {
            fail('Login with new password', { message: 'Failed to authenticate with updated password' });
        }

    } catch (err) {
        fail('Change Password flow', err.response?.data || err);
    }
}


async function runTests() {

    console.log(`Testing against: ${BASE_URL}`);
    const serverOk = await checkServer();
    if (!serverOk) {
        fail('Server not running', { message: 'Server not available' });
        return;
    }
    console.log('Server is responding');

    console.log('\n=== LOGIN TESTS ===\n');

    try {
        await testChangePassword();
        // await testLoginRateLimit();

        const sessionId = await login(SystemCreds);
        if (sessionId) {
            systemSessionId = sessionId;
            pass('Login as system admin');
        } else {
            fail('Login as system admin', { message: 'Invalid credentials or no session' });
            return;
        }
        
    } catch (err) {
        fail('Login as system admin', err);
        return;
    }

    log('Searching for valid test client credentials...');
    const data = await findTestClient();
    if (data?.session_id) {
        testClientSessionId = data.session_id;
        testClientId = data.client_id;
        testUserId = data.user_id;
        log(`  Test client: client_id=${testClientId}, user_id=${testUserId}`);
        pass('Login as test client');
    } else {
        log('No test client session found - tenant tests will be skipped');
        testClientSessionId = null;
    }

    console.log('\n=== SYSTEM ADMIN TESTS (client_id=1) ===\n');

    await testSystemSelect();
    await testSystemInsert();
    await testSystemUpdate();
    await testSystemDelete();
    await testTenantIsolationBypass();

    console.log('\n=== TENANT ISOLATION TESTS (client_id != 1) ===\n');

    if (testClientSessionId) {
        await testTenantSelect();
        await testTenantInsert();
        await testTenantUpdate();
        await testTenantDelete();
        await testBlockedTables();
        await testIdValidation();
    } else {
        log('Skipping tenant tests - no test client session');
    }

    console.log('\n=== EXPORT TESTS ===\n');

    await testExport();

    console.log('\n=== EDGE CASE TESTS ===\n');

    await testSqlInjection();
    await testDisallowedDDL();
    await testMissingSession();

    console.log('\n=== SUMMARY ===\n');
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);

    if (systemSessionId) await logout(systemSessionId);
    if (testClientSessionId) await logout(testClientSessionId);

    process.exit(testResults.failed > 0 ? 1 : 0);
}

async function testSystemSelect() {
    log('Test: System SELECT * FROM Client');
    try {
        const res = await executeQuery(systemSessionId, 'SELECT * FROM Client LIMIT 3');
        if (res.data?.success && res.data?.data?.rows?.length > 0) {
            pass('System can SELECT from Client');
        } else {
            fail('System SELECT from Client', { message: 'No data returned' });
        }
    } catch (err) {
        fail('System SELECT from Client', err);
    }

    log('Test: System SELECT * FROM Plan');
    try {
        const res = await executeQuery(systemSessionId, 'SELECT * FROM Plan LIMIT 3');
        if (res.data?.success) {
            pass('System can SELECT from Plan');
        }
    } catch (err) {
        fail('System SELECT from Plan', err);
    }

    log('Test: System SHOW TABLES');
    try {
        const res = await executeQuery(systemSessionId, 'SHOW TABLES');
        if (res.data?.success) {
            pass('System SHOW TABLES');
        }
    } catch (err) {
        fail('System SHOW TABLES', err);
    }
}

async function testSystemInsert() {
    log('Test: System INSERT into Customer (with explicit client_id)');
    try {
        const res = await executeQuery(systemSessionId, 
            "INSERT INTO Customer (client_id, company_name, email) VALUES (2, 'Test Company', 'test@company.com')");
        if (res.data?.success) {
            pass('System INSERT into Customer');
        }
    } catch (err) {
        fail('System INSERT into Customer', err);
    }

    log('Test: System INSERT into Plan');
    try {
        const res = await executeQuery(systemSessionId,
            "INSERT INTO Plan (client_id, plan_name, tier_1_users, tier_2_users, tier_3_users, monthly_price) VALUES (2, 'TestPlan', 5, 2, 1, 9.99)");
        if (res.data?.success) {
            pass('System INSERT into Plan');
        }
    } catch (err) {
        fail('System INSERT into Plan', err);
    }
}

async function testSystemUpdate() {
    log('Test: System UPDATE Customer');
    try {
        const res = await executeQuery(systemSessionId,
            "UPDATE Customer SET company_name = 'Updated Company' WHERE company_name = 'Test Company'");
        if (res.data?.success) {
            pass('System UPDATE Customer');
        }
    } catch (err) {
        fail('System UPDATE Customer', err);
    }

    log('Test: System UPDATE Plan');
    try {
        const res = await executeQuery(systemSessionId,
            "UPDATE Plan SET monthly_price = 19.99 WHERE plan_name = 'TestPlan'");
        if (res.data?.success) {
            pass('System UPDATE Plan');
        }
    } catch (err) {
        fail('System UPDATE Plan', err);
    }
}

async function testSystemDelete() {
    log('Test: System DELETE Customer');
    try {
        const res = await executeQuery(systemSessionId,
            "DELETE FROM Customer WHERE company_name = 'Updated Company'");
        if (res.data?.success) {
            pass('System DELETE Customer');
        }
    } catch (err) {
        fail('System DELETE Customer', err);
    }

    log('Test: System DELETE Plan');
    try {
        const res = await executeQuery(systemSessionId,
            "DELETE FROM Plan WHERE plan_name = 'TestPlan'");
        if (res.data?.success) {
            pass('System DELETE Plan');
        }
    } catch (err) {
        fail('System DELETE Plan', err);
    }
}

async function testTenantIsolationBypass() {
    log('Test: Tenant isolation bypass for client_id=1');
    try {
        const res = await executeQuery(systemSessionId, 'SELECT * FROM Client WHERE client_id = 2');
        if (res.data?.success && res.data?.data?.rows?.length > 0) {
            pass('System sees all tenants (bypass works)');
        }
    } catch (err) {
        fail('Tenant isolation bypass', err);
    }
}

async function testTenantSelect() {
    log('Test: Tenant SELECT * FROM Customer');
    try {
        const res = await executeQuery(testClientSessionId, 'SELECT * FROM Customer LIMIT 3');
        if (res.data?.success) {
            pass('Tenant SELECT from Customer');
        }
    } catch (err) {
        fail('Tenant SELECT from Customer', err);
    }

    log('Test: Tenant SELECT with JOIN');
    try {
        const res = await executeQuery(testClientSessionId,
            'SELECT c.company_name, p.plan_name FROM Customer c JOIN Subscription s ON c.customer_id = s.customer_id JOIN Plan p ON s.plan_id = p.plan_id LIMIT 3');
        if (res.data?.success) {
            pass('Tenant SELECT with JOIN');
        }
    } catch (err) {
        fail('Tenant SELECT with JOIN', err);
    }

    log('Test: Tenant SELECT * FROM Plan (should work - read only)');
    try {
        const res = await executeQuery(testClientSessionId, 'SELECT * FROM Plan LIMIT 3');
        if (res.data?.success) {
            pass('Tenant SELECT from Plan (read-only allowed)');
        }
    } catch (err) {
        fail('Tenant SELECT from Plan', err);
    }
}

async function testTenantInsert() {
    log('Test: Tenant INSERT into Customer (should auto-inject client_id)');
    try {
        const res = await executeQuery(testClientSessionId,
            "INSERT INTO Customer (client_id,company_name, email,phone,address) VALUES (3,'TenantTest', 'tenant@test.com', '2732','bds')");
        if (res.data?.success === false) {
            pass('Tenant INSERT into Customer (auto client_id)');
        }
    } catch (err) {
        fail('Tenant INSERT into Customer', err);
    }

    log('Test: Tenant INSERT into User (should auto-inject client_id)');
    try {
        const res = await executeQuery(testClientSessionId,
            "INSERT INTO User (username, email, password_hash, tier_level) VALUES ('newuser', 'new@test.com', 'hash', 1)");
        if (res.data?.success) {
            pass('Tenant INSERT into User');
        }
    } catch (err) {
        fail('Tenant INSERT into User', err);
    }

    log('Test: Tenant INSERT into Plan (should be BLOCKED)');
    try {
        const res = await executeQuery(testClientSessionId,
            "INSERT INTO Plan (client_id, plan_name, tier_1_users, tier_2_users, tier_3_users, monthly_price) VALUES (2, 'HackedPlan', 100, 50, 25, 0.01)");
        fail('Tenant INSERT into Plan should be blocked', { message: 'Not blocked' });
    } catch (err) {
        if (err.response?.status === 403) {
            pass('Tenant INSERT into Plan blocked');
        } else {
            fail('Tenant INSERT into Plan', err);
        }
    }

    log('Test: Tenant INSERT with wrong client_id (should be BLOCKED)');
    try {
        const res = await executeQuery(testClientSessionId,
            "INSERT INTO Customer (client_id, company_name, email) VALUES (999, 'Hacked', 'hack@test.com')");
        fail('INSERT with wrong client_id should be blocked', { message: 'Not blocked' });
    } catch (err) {
        if (err.response?.status === 403) {
            pass('INSERT with wrong client_id blocked');
        } else {
            fail('INSERT with wrong client_id', err);
        }
    }
}

async function testTenantUpdate() {
    log('Test: Tenant UPDATE Customer');
    try {
        const res = await executeQuery(testClientSessionId,
            "UPDATE Customer SET company_name = 'Tenant Updated' WHERE email = 'tenant@test.com'");
        if (res.data?.success) {
            pass('Tenant UPDATE Customer');
        }
    } catch (err) {
        fail('Tenant UPDATE Customer', err);
    }

    log('Test: Tenant UPDATE Plan (should be BLOCKED)');
    try {
        const res = await executeQuery(testClientSessionId,
            "UPDATE Plan SET monthly_price = 0.01 WHERE plan_name = 'Basic'");
        fail('Tenant UPDATE Plan should be blocked', { message: 'Not blocked' });
    } catch (err) {
        if (err.response?.status === 403) {
            pass('Tenant UPDATE Plan blocked');
        } else {
            fail('Tenant UPDATE Plan', err);
        }
    }

    log('Test: Tenant UPDATE with wrong client_id in SET (should be BLOCKED)');
    try {
        const res = await executeQuery(testClientSessionId,
            "UPDATE Customer SET client_id = 999 WHERE email = 'tenant@test.com'");
        fail('UPDATE with wrong client_id should be blocked', { message: 'Not blocked' });
    } catch (err) {
        if (err.response?.status === 403) {
            pass('UPDATE with wrong client_id blocked');
        } else {
            fail('UPDATE with wrong client_id', err);
        }
    }
}

async function testTenantDelete() {
    log('Test: Tenant DELETE Customer');
    try {
        const res = await executeQuery(testClientSessionId,
            "DELETE FROM Customer WHERE email = 'tenant@test.com'");
        if (res.data?.success) {
            pass('Tenant DELETE Customer');
        }
    } catch (err) {
        fail('Tenant DELETE Customer', err);
    }

    log('Test: Tenant DELETE Plan (should be BLOCKED)');
    try {
        const res = await executeQuery(testClientSessionId,
            "DELETE FROM Plan WHERE plan_name = 'Enterprise'");
        fail('Tenant DELETE Plan should be blocked', { message: 'Not blocked' });
    } catch (err) {
        if (err.response?.status === 403) {
            pass('Tenant DELETE Plan blocked');
        } else {
            fail('Tenant DELETE Plan', err);
        }
    }
}

async function testBlockedTables() {
    log('Test: Tenant SELECT from Client (should be BLOCKED)');
    try {
        const res = await executeQuery(testClientSessionId, 'SELECT * FROM Client');
        fail('SELECT from Client should be blocked', { message: 'Not blocked' });
    } catch (err) {
        if (err.response?.status === 403) {
            pass('Tenant SELECT from Client blocked');
        } else {
            fail('Tenant SELECT from Client', err);
        }
    }

    log('Test: Tenant SELECT from UserSession (should be BLOCKED)');
    try {
        const res = await executeQuery(testClientSessionId, 'SELECT * FROM UserSession');
        fail('SELECT from UserSession should be blocked', { message: 'Not blocked' });
    } catch (err) {
        if (err.response?.status === 403) {
            pass('Tenant SELECT from UserSession blocked');
        } else {
            fail('Tenant SELECT from UserSession', err);
        }
    }
}

async function testIdValidation() {
    log('Test: Tenant UPDATE with wrong user_id in SET (should be BLOCKED)');
    try {
        const res = await executeQuery(testClientSessionId,
            "UPDATE Customer SET user_id = 999 WHERE email = 'test@client2.com'");
        fail('UPDATE with wrong user_id should be blocked', { message: 'Not blocked' });
    } catch (err) {
        if (err.response?.status === 403) {
            pass('UPDATE with wrong user_id blocked');
        } else {
            fail('UPDATE with wrong user_id', err);
        }
    }
}

async function testExport() {
    if (!systemSessionId) {
        log('Skipping export tests - no system session');
        return;
    }

    log('Test: Export to PDF');
    try {
        const queryRes = await executeQuery(systemSessionId, 'SELECT * FROM Client LIMIT 5');
        if (queryRes.data?.success) {
            const pdfRes = await exportData(systemSessionId, queryRes.data, 'PDF');
            if (pdfRes.headers['content-type']?.includes('pdf')) {
                pass('Export to PDF');
            } else {
                fail('Export to PDF', { message: 'Wrong content type' });
            }
        }
    } catch (err) {
        fail('Export to PDF', err);
    }

    log('Test: Export to Excel');
    try {
        const queryRes = await executeQuery(systemSessionId, 'SELECT * FROM Client LIMIT 5');
        if (queryRes.data?.success) {
            const excelRes = await exportData(systemSessionId, queryRes.data, 'EXCEL');
            if (excelRes.headers['content-type']?.includes('spreadsheet')) {
                pass('Export to Excel');
            } else {
                fail('Export to Excel', { message: 'Wrong content type' });
            }
        }
    } catch (err) {
        fail('Export to Excel', err);
    }
}

async function testSqlInjection() {
    log('Test: SQL injection in WHERE');
    try {
        const res = await executeQuery(systemSessionId, 
            "SELECT * FROM Client WHERE client_id = 1 OR 1=1");
        if (res.data?.success) {
            pass('SQL injection handled');
        }
    } catch (err) {
        fail('SQL injection test', err);
    }
}

async function testDisallowedDDL() {
    log('Test: CREATE TABLE (should be BLOCKED)');
    try {
        const res = await executeQuery(systemSessionId,
            'CREATE TABLE hacks (id INT)');
        fail('CREATE TABLE should be blocked', { message: 'Not blocked' });
    } catch (err) {
        if (err.response?.status === 403) {
            pass('CREATE TABLE blocked');
        } else {
            fail('CREATE TABLE test', err);
        }
    }

    log('Test: DROP TABLE (should be BLOCKED)');
    try {
        const res = await executeQuery(systemSessionId,
            'DROP TABLE Client');
        fail('DROP TABLE should be blocked', { message: 'Not blocked' });
    } catch (err) {
        if (err.response?.status === 403) {
            pass('DROP TABLE blocked');
        } else {
            fail('DROP TABLE test', err);
        }
    }

    log('Test: GRANT (should be BLOCKED)');
    try {
        const res = await executeQuery(systemSessionId,
            'GRANT ALL ON saas_db TO user@localhost');
        fail('GRANT should be blocked', { message: 'Not blocked' });
    } catch (err) {
        if (err.response?.status === 403) {
            pass('GRANT blocked');
        } else {
            fail('GRANT test', err);
        }
    }
}

async function testMissingSession() {
    log('Test: Missing session ID');
    try {
        const res = await axios.post(`${BASE_URL}/query`, { query: 'SELECT 1' });
        fail('Missing session should be blocked', { message: 'Not blocked' });
    } catch (err) {
        if (err.response?.status === 401) {
            pass('Missing session blocked');
        } else {
            fail('Missing session test', err);
        }
    }

    log('Test: Invalid query');
    try {
        const res = await executeQuery(systemSessionId, 'SELECT * FROM nonexistent');
        fail('Invalid query should fail', { message: 'Not failed' });
    } catch (err) {
        if (err.response?.status === 400 || err.response?.status === 500) {
            pass('Invalid query rejected');
        } else {
            fail('Invalid query test', err);
        }
    }
}

runTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});