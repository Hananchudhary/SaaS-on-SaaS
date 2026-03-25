import axios from 'axios';
import fs from 'fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const ADMIN_EMAIL = 'admin@saasplatform.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'system_admin';

function fail(msg) {
    console.error(`✗ ${msg}`);
    process.exitCode = 1;
}

function ok(msg) {
    console.log(`✓ ${msg}`);
}

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD are required in env to run this test.');
    process.exit(1);
}

async function login() {
    const res = await axios.post(`${BASE_URL}/login`, {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
    });
    return res.data?.data?.session_id;
}

async function runQuery(sessionId) {
    const res = await axios.post(
        `${BASE_URL}/query`,
        { query: 'SELECT * FROM Plan' },
        { headers: { 'x-session-id': sessionId } }
    );
    return res.data;
}

async function exportData(sessionId, responseData, exportType, outputPath) {
    const res = await axios.post(
        `${BASE_URL}/exportData`,
        { responseData, exportType },
        {
            headers: { 'x-session-id': sessionId },
            responseType: 'arraybuffer'
        }
    );
    await fs.writeFile(outputPath, res.data);
    return res.headers['content-type'];
}

(async () => {
    try {
        const sessionId = await login();
        if (!sessionId) {
            fail('Login failed: no session_id returned');
            return;
        }
        ok('Login succeeded');

        const responseData = await runQuery(sessionId);
        const rowsCount = responseData?.data?.rows_count;
        if (!rowsCount || rowsCount < 1) {
            fail(`Query returned rows_count=${rowsCount}. Need at least 1 row to test exportData.`);
            return;
        }
        ok(`Query succeeded (rows_count=${rowsCount})`);

        const pdfType = await exportData(sessionId, responseData, 'PDF', '/tmp/export_test.pdf');
        if (!pdfType || !pdfType.includes('pdf')) {
            fail(`PDF export returned unexpected content-type: ${pdfType}`);
            return;
        }
        ok('PDF export succeeded (/tmp/export_test.pdf)');

        const excelType = await exportData(sessionId, responseData, 'EXCEL', '/tmp/export_test.xlsx');
        if (!excelType || !excelType.includes('spreadsheetml')) {
            fail(`Excel export returned unexpected content-type: ${excelType}`);
            return;
        }
        ok('Excel export succeeded (/tmp/export_test.xlsx)');
    } catch (err) {
        if (err?.response?.data) {
            const data = err.response.data;
            if (Buffer.isBuffer(data)) {
                const text = data.toString('utf8');
                try {
                    fail(JSON.stringify(JSON.parse(text)));
                } catch {
                    fail(text);
                }
                return;
            }
            if (data instanceof ArrayBuffer) {
                const text = Buffer.from(data).toString('utf8');
                try {
                    fail(JSON.stringify(JSON.parse(text)));
                } catch {
                    fail(text);
                }
                return;
            }
            fail(JSON.stringify(data));
            return;
        }
        fail(err.message);
    }
})();
