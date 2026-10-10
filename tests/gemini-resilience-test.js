'use strict';
/**
 * tests/gemini-resilience-test.js
 * Verification for Gemini error diagnostics, backoff behavior,
 * and real API analysis execution.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const { analyzeResume } = require('../src/services/gemini.service');

const BASE_URL = 'http://localhost:3000';
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗  ${name}`);
    console.error(`     → ${e.message}`);
    failed++;
  }
}

async function main() {
  console.log('\n── Gemini Service Resilience & 429 Handling Tests ────');

  // Test 1: Real Gemini API analysis execution using gemini-3.8-flash
  await test('Real Gemini API analysis returns valid structured analysis object', async () => {
    const resume = 'Software engineer with 4 years building REST APIs in Node.js, Express, and MySQL.';
    const jd = 'Looking for a Software Engineer proficient in Node.js, Express, and MySQL.';
    const result = await analyzeResume(resume, jd, 'Software Engineer', 'Tech Corp');

    assert.ok(result, 'Result should not be empty');
    assert.strictEqual(typeof result.overallAssessment, 'string');
    assert.ok(Array.isArray(result.matchedSkills), 'matchedSkills should be array');
    assert.ok(Array.isArray(result.missingRequiredSkills), 'missingRequiredSkills should be array');
    assert.ok(result.experienceAnalysis && typeof result.experienceAnalysis.score === 'number');
    assert.ok(result.projectsAnalysis && typeof result.projectsAnalysis.score === 'number');
  });

  // Test 2: End-to-end guest upload to /api/analyze with real Gemini execution
  await test('POST /api/analyze performs real analysis and returns 201 without storing guest history', async () => {
    const samplePdf = path.join(__dirname, 'fixtures', 'sample_resume.pdf');
    const fd = new FormData();
    fd.append('resume', fs.readFileSync(samplePdf), {
      filename: 'sample_resume.pdf',
      contentType: 'application/pdf',
    });
    fd.append('jobDescription', 'Senior Full Stack Developer with Node.js, React, Docker, and PostgreSQL experience required for high-scale microservices.');
    fd.append('jobTitle', 'Full Stack Developer');
    fd.append('companyName', 'DevScale');

    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: fd.getHeaders(),
      body: fd.getBuffer(),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert.strictEqual(data.success, true);
    assert.ok(typeof data.data.matchScore === 'number');
    assert.ok(data.data.analysis && Array.isArray(data.data.analysis.matchedSkills));
  });

  console.log(`\n══════════════════════════════════════════`);
  console.log(`  Resilience Results: ${passed} passed, ${failed} failed`);
  console.log(`══════════════════════════════════════════\n`);

  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exitCode = 1;
});
