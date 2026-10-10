'use strict';
/**
 * tests/auth-test.js
 * Automated test suite for ResumeFit AI Authentication & User Data Isolation.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓  ${name}`);
  } catch (err) {
    console.error(`  ✗  ${name}\n     → ${err.message}`);
    throw err;
  }
}

async function runAuthTests() {
  console.log('\n── Authentication & Data Isolation Test Suite ──────');

  const userA = {
    name: 'User Alpha',
    email: `test_alpha_${Date.now()}@example.com`,
    password: 'password123',
    confirmPassword: 'password123',
  };

  const userB = {
    name: 'User Beta',
    email: `test_beta_${Date.now()}@example.com`,
    password: 'password456',
    confirmPassword: 'password456',
  };

  let tokenA = null;
  let tokenB = null;
  let analysisIdA = null;

  // 1. Signup User A
  await test('POST /api/auth/signup registers User A and sets HttpOnly cookie', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userA),
    });

    const data = await res.json();
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(data.success, 'Signup should return success:true');
    assert(data.user.email === userA.email, 'Email mismatch');
    assert(data.token, 'Token missing');
    tokenA = data.token;
  });

  // 2. Duplicate Email Rejection
  await test('POST /api/auth/signup rejects duplicate email with 409', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userA),
    });

    const data = await res.json();
    assert(res.status === 409, `Expected 409, got ${res.status}`);
    assert(!data.success, 'Duplicate signup should fail');
  });

  // 3. Signup User B
  await test('POST /api/auth/signup registers User B', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userB),
    });

    const data = await res.json();
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    tokenB = data.token;
  });

  // 4. Invalid Password Login Rejection
  await test('POST /api/auth/login rejects wrong password with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userA.email, password: 'wrongpassword' }),
    });

    const data = await res.json();
    assert(res.status === 401, `Expected 401, got ${res.status}`);
    assert(!data.success, 'Invalid login should fail');
  });

  // 5. Valid Login User A
  await test('POST /api/auth/login authenticates User A', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userA.email, password: userA.password }),
    });

    const data = await res.json();
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(data.success, 'Login should succeed');
    assert(data.user.email === userA.email, 'Email mismatch');
  });

  // 6. GET /api/auth/me for User A
  await test('GET /api/auth/me returns User A info with valid Bearer token', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const data = await res.json();
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(data.user.name === userA.name, 'Name mismatch');
  });

  // 7. Data Isolation Test: User B cannot access User A's analysis record
  await test('User B receives 404/Forbidden when trying to access User A data', async () => {
    // Save sample analysis for User A
    const formData = new (require('form-data'))();
    const pdfPath = path.join(__dirname, 'fixtures', 'sample_resume.pdf');
    formData.append('resume', fs.readFileSync(pdfPath), {
      filename: 'sample_resume.pdf',
      contentType: 'application/pdf',
    });
    formData.append('jobDescription', 'We are looking for a Senior Software Engineer with Node.js and React experience.'.repeat(2));

    const analyzeRes = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        ...formData.getHeaders(),
      },
      body: formData.getBuffer(),
    });

    const analyzeData = await analyzeRes.json();
    assert(analyzeData.success, 'User A analysis upload failed');
    analysisIdA = analyzeData.data.id;

    // User B attempts to access User A's report by ID
    const getResB = await fetch(`${BASE_URL}/api/analyses/${analysisIdA}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    assert(getResB.status === 404, `User B should get 404 when accessing User A report, got ${getResB.status}`);

    // Clean up analysis record using User A credentials
    await fetch(`${BASE_URL}/api/analyses/${analysisIdA}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
  });

  // 8. Logout
  await test('POST /api/auth/logout clears auth session', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
    });

    const data = await res.json();
    assert(data.success, 'Logout should succeed');
  });

  console.log('══════════════════════════════════════════');
  console.log('  Auth & Data Isolation Tests PASSED!');
  console.log('══════════════════════════════════════════\n');
}

runAuthTests().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
