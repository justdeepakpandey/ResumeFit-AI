'use strict';
/**
 * tests/enhancements-test.js
 * Comprehensive automated verification test suite for Guest Mode,
 * Authentication Isolation, Non-Persistence of Guest History, and Feedback.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const { getPool } = require('../src/config/db');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const SAMPLE_PDF = path.join(__dirname, 'fixtures', 'sample_resume.pdf');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`     → ${err.message}`);
    failed++;
  }
}

async function runEnhancementTests() {
  console.log('\n── ResumeFit AI Feature Enhancements Test Suite ──────');

  const pool = getPool();

  // Test 1: Feedback submission as guest
  await test('POST /api/feedback saves guest feedback without creating a user account', async () => {
    const res = await fetch(`${BASE_URL}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'Bug Report',
        subject: 'Test Bug',
        message: 'This is a test bug report message for verification.',
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert.strictEqual(data.success, true);
    assert.ok(data.data.id, 'Feedback ID should be returned');

    // Verify in database: user_id should be NULL
    const [rows] = await pool.query('SELECT * FROM feedback WHERE id = ?', [data.data.id]);
    assert.strictEqual(rows.length, 1, 'Feedback should be saved in DB');
    assert.strictEqual(rows[0].user_id, null, 'Guest feedback user_id must be null');
    assert.strictEqual(rows[0].type, 'Bug Report');

    // Clean up test feedback
    await pool.query('DELETE FROM feedback WHERE id = ?', [data.data.id]);
  });

  // Test 2: Feedback validation rejection
  await test('POST /api/feedback rejects invalid feedback type and short message with 400', async () => {
    const res = await fetch(`${BASE_URL}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'InvalidType',
        message: 'hi',
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
    assert.strictEqual(data.success, false);
    assert.ok(data.errors.length >= 2, 'Should return validation error list');
  });

  // Test 3: Guest Mode - Analysis runs with real API but NEVER persists to database
  let guestReportId = null;
  await test('Guest analysis produces complete report but is NEVER persisted to MySQL', async () => {
    // Count analyses in DB before
    const [beforeRows] = await pool.query('SELECT count(*) as count FROM analyses');
    const beforeCount = beforeRows[0].count;

    const fd = new FormData();
    fd.append('resume', fs.readFileSync(SAMPLE_PDF), {
      filename: 'sample_resume.pdf',
      contentType: 'application/pdf',
    });
    fd.append('jobDescription', 'Senior Node.js and React full-stack developer needed with database experience.'.repeat(2));
    fd.append('jobTitle', 'Guest Fullstack Job');
    fd.append('companyName', 'Guest Tech');

    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      body: fd.getBuffer(),
      headers: fd.getHeaders(),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert.strictEqual(data.success, true);
    assert.ok(data.data.id, 'Report has an id');
    assert.ok(typeof data.data.matchScore === 'number', 'matchScore calculated');
    assert.ok(data.data.analysis, 'analysis object returned');
    assert.strictEqual(data.data.userId, null, 'userId must be null for guest');

    guestReportId = data.data.id;

    // Count analyses in DB after: MUST NOT INCREASE!
    const [afterRows] = await pool.query('SELECT count(*) as count FROM analyses');
    const afterCount = afterRows[0].count;
    assert.strictEqual(afterCount, beforeCount, 'Guest analysis MUST NOT be inserted into analyses table!');

    // Check directly in DB that guestReportId does not exist
    const [checkRows] = await pool.query('SELECT * FROM analyses WHERE id = ?', [guestReportId]);
    assert.strictEqual(checkRows.length, 0, 'Guest analysis report must not exist in MySQL!');
  });

  // Test 4: Guests receive empty array on GET /api/analyses (cannot view any saved history)
  await test('GET /api/analyses as guest returns success:true and empty data array', async () => {
    const res = await fetch(`${BASE_URL}/api/analyses`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.deepStrictEqual(data.data, [], 'Guests must receive empty list for history');
  });

  // Test 5: Guests receive 404 if attempting to query report by ID
  await test('GET /api/analyses/:id as guest returns 404', async () => {
    const res = await fetch(`${BASE_URL}/api/analyses/${guestReportId || 'any-id'}`);
    assert.strictEqual(res.status, 404);
  });

  // Test 6: Authenticated user analysis IS saved to database and isolated
  await test('Authenticated analysis IS saved to database, visible only to owner, and deletable', async () => {
    const testUser = {
      name: 'Enhancement Test User',
      email: `enhancement_user_${Date.now()}@example.com`,
      password: 'testPassword123',
      confirmPassword: 'testPassword123',
    };

    // Signup user
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    const signupData = await signupRes.json();
    assert.strictEqual(signupRes.status, 201);
    const userToken = signupData.token;
    const userId = signupData.user.id;

    // Run analysis as authenticated user
    const fd = new FormData();
    fd.append('resume', fs.readFileSync(SAMPLE_PDF), {
      filename: 'sample_resume.pdf',
      contentType: 'application/pdf',
    });
    fd.append('jobDescription', 'Looking for an experienced software architect with Node.js and TypeScript.'.repeat(2));
    fd.append('jobTitle', 'Architect');
    fd.append('companyName', 'Cloud Corp');

    const analyzeRes = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        ...fd.getHeaders(),
      },
      body: fd.getBuffer(),
    });

    const analyzeData = await analyzeRes.json();
    assert.strictEqual(analyzeRes.status, 201);
    assert.strictEqual(analyzeData.success, true);
    const authReportId = analyzeData.data.id;

    // Verify it IS persisted in MySQL with user_id
    const [dbRows] = await pool.query('SELECT * FROM analyses WHERE id = ?', [authReportId]);
    assert.strictEqual(dbRows.length, 1, 'Authenticated analysis must be saved in MySQL');
    assert.strictEqual(dbRows[0].user_id, userId, 'Analysis must be associated with authenticated user ID');

    // Verify owner can retrieve it via GET /api/analyses
    const listRes = await fetch(`${BASE_URL}/api/analyses`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const listData = await listRes.json();
    assert.strictEqual(listRes.status, 200);
    const foundInList = listData.data.some(a => a.id === authReportId);
    assert.ok(foundInList, 'Report must appear in owner history list');

    // Verify owner can get single report via GET /api/analyses/:id
    const getRes = await fetch(`${BASE_URL}/api/analyses/${authReportId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const getData = await getRes.json();
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getData.data.id, authReportId);

    // Verify owner can delete report
    const delRes = await fetch(`${BASE_URL}/api/analyses/${authReportId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(delRes.status, 200);

    // Verify report is deleted from DB
    const [afterDelRows] = await pool.query('SELECT * FROM analyses WHERE id = ?', [authReportId]);
    assert.strictEqual(afterDelRows.length, 0, 'Report must be removed after delete');

    // Clean up test user
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
  });

  console.log(`\n══════════════════════════════════════════`);
  console.log(`  Enhancements Results: ${passed} passed, ${failed} failed`);
  console.log(`══════════════════════════════════════════\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runEnhancementTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
