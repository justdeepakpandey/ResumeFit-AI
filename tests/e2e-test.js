'use strict';
/**
 * tests/e2e-test.js
 * End-to-end test: create a synthetic DOCX, POST it to /api/analyze,
 * verify response shape, and check DB persistence.
 *
 * Run AFTER the server is started: node tests/e2e-test.js
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const SAMPLE_RESUME_PATH = path.join(__dirname, 'fixtures', 'sample_resume.pdf');

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

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertRange(v, min, max, msg) {
  if (v < min || v > max) throw new Error(msg || `${v} not in [${min},${max}]`);
}

/* ── Create a minimal valid PDF in fixtures/ ─────────────────────────────── */
function createSamplePdf() {
  const dir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const body = '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj 2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj 3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj 4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj 5 0 obj << /Length 300 >> stream\nBT /F1 12 Tf 50 700 Td (John Developer Full Stack Software Engineer 4 years experience building scalable backend services Node.js Express React PostgreSQL Docker REST APIs JavaScript TypeScript Git Senior Developer TechCorp B.S. Computer Science State University 2020 E-Commerce Platform Task Manager) Tj ET\nendstream endobj';

  const pdfStr = '%PDF-1.4\n' + body + '\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000244 00000 n\n0000000318 00000 n\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n560\n%%EOF';

  fs.writeFileSync(SAMPLE_RESUME_PATH, Buffer.from(pdfStr));
  console.log(`  Created sample PDF: ${SAMPLE_RESUME_PATH} (${fs.statSync(SAMPLE_RESUME_PATH).size} bytes)`);
}

/* ── Full pipeline test ───────────────────────────────────────────────────── */
const JOB_DESCRIPTION = `
We are looking for a Senior Software Engineer to join our platform team.

Required Skills:
- Node.js (5+ years)
- React and modern JavaScript/TypeScript
- PostgreSQL or similar relational database
- REST API design and development
- Docker and containerisation
- Git version control

Preferred Skills:
- Kubernetes or cloud orchestration
- Microservices architecture experience
- Agile/Scrum methodology
- JWT authentication implementation

Responsibilities:
- Design and build scalable backend services
- Collaborate with frontend teams on API contracts
- Write clean, tested, maintainable code
- Participate in code reviews and architecture discussions

Education: Bachelor's degree in Computer Science or equivalent experience.
`;

async function runE2ETests() {
  console.log('\n── End-to-End Analysis Pipeline ─────────────────────');

  let analysisId = null;
  let guestReport = null;

  // ── Test 1: POST /api/analyze with real PDF ──────────────────────────────
  await test('POST /api/analyze returns 201 with valid resume+JD', async () => {
    const formData = new (require('form-data'))();
    formData.append('resume', fs.readFileSync(SAMPLE_RESUME_PATH), {
      filename: 'sample_resume.pdf',
      contentType: 'application/pdf',
    });
    formData.append('jobDescription', JOB_DESCRIPTION.trim());
    formData.append('jobTitle', 'Senior Software Engineer');
    formData.append('companyName', 'Test Corp');

    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      body: formData.getBuffer(),
      headers: formData.getHeaders(),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(`Status ${res.status}: ${data.error || JSON.stringify(data.errors)}`);
    }

    assert(data.data.id, 'Response must have an id');
    assert(typeof data.data.matchScore === 'number', 'matchScore must be a number');
    assertRange(data.data.matchScore, 0, 100, `matchScore ${data.data.matchScore} out of range`);
    assert(data.data.analysis, 'Response must have analysis object');
    assert(Array.isArray(data.data.analysis.matchedSkills), 'matchedSkills must be array');
    assert(Array.isArray(data.data.analysis.suggestions), 'suggestions must be array');

    analysisId = data.data.id;
    guestReport = data.data;
    console.log(`     → id=${analysisId}, score=${data.data.matchScore}/100`);
    console.log(`     → matched skills: ${data.data.analysis.matchedSkills.map(s => s.skill).join(', ')}`);
    console.log(`     → missing required: ${data.data.analysis.missingRequiredSkills.join(', ') || 'none'}`);
    console.log(`     → suggestions: ${data.data.analysis.suggestions.length} suggestions`);
  });

  // ── Test 2: Verify match score components are present in guest report ───
  await test('Score components are returned and valid in guest report', async () => {
    assert(guestReport, 'No guestReport from previous test');
    assertRange(guestReport.matchScore, 0, 100, 'matchScore range');
    assertRange(guestReport.skillsScore, 0, 100, 'skillsScore range');
    assertRange(guestReport.experienceScore, 0, 100, 'experienceScore range');
    assertRange(guestReport.projectsScore, 0, 100, 'projectsScore range');
    console.log(`     → skills=${guestReport.skillsScore}, exp=${guestReport.experienceScore}, proj=${guestReport.projectsScore}`);
  });

  // ── Test 3: Guest analysis is NEVER persisted in DB history ──────────────
  await test('Guest analysis is NOT persisted in DB and does NOT appear in history', async () => {
    if (!analysisId) throw new Error('No analysisId from previous test');
    const res = await fetch(`${BASE_URL}/api/analyses?limit=20`);
    const data = await res.json();
    assert(data.success, 'GET /api/analyses failed');
    const found = data.data.some(a => a.id === analysisId);
    assert(!found, `Guest analysis ${analysisId} must NOT appear in history list`);
    console.log(`     → Verified: Guest analysis was not saved (history count: ${data.data.length})`);
  });

  // ── Test 4: Authenticated user analysis IS saved and deletable ───────────
  let authAnalysisId = null;
  let authToken = null;
  await test('Authenticated analysis is persisted in DB and appears in history', async () => {
    // Register temporary user
    const userRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E User',
        email: `e2e_user_${Date.now()}@example.com`,
        password: 'password123',
        confirmPassword: 'password123',
      }),
    });
    const userData = await userRes.json();
    assert(userRes.status === 201, 'User registration failed');
    authToken = userData.token;

    // Run authenticated analysis
    const formData = new (require('form-data'))();
    formData.append('resume', fs.readFileSync(SAMPLE_RESUME_PATH), {
      filename: 'sample_resume.pdf',
      contentType: 'application/pdf',
    });
    formData.append('jobDescription', JOB_DESCRIPTION.trim());
    formData.append('jobTitle', 'Auth Senior Engineer');
    formData.append('companyName', 'Persisted Corp');

    const analyzeRes = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      body: formData.getBuffer(),
      headers: {
        Authorization: `Bearer ${authToken}`,
        ...formData.getHeaders(),
      },
    });
    const analyzeData = await analyzeRes.json();
    assert(analyzeData.success, 'Auth analyze failed');
    authAnalysisId = analyzeData.data.id;

    // Verify it appears in authenticated history list
    const histRes = await fetch(`${BASE_URL}/api/analyses?limit=20`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const histData = await histRes.json();
    assert(histData.success, 'GET /api/analyses failed for auth user');
    const found = histData.data.some(a => a.id === authAnalysisId);
    assert(found, `Authenticated analysis ${authAnalysisId} must appear in history`);

    // Verify single report retrieval
    const getRes = await fetch(`${BASE_URL}/api/analyses/${authAnalysisId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(getRes.status === 200, 'GET /api/analyses/:id failed for auth user');

    // Verify delete
    const delRes = await fetch(`${BASE_URL}/api/analyses/${authAnalysisId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(delRes.status === 200, 'DELETE failed');
  });

  // ── Test 7: Oversized file validation ───────────────────────────────────
  await test('POST /api/analyze with too-large file returns 413', async () => {
    // Create a 6MB dummy file
    const bigPath = path.join(__dirname, 'fixtures', 'big.pdf');
    fs.writeFileSync(bigPath, Buffer.alloc(6 * 1024 * 1024, 0x25));
    try {
      const fd = new (require('form-data'))();
      fd.append('resume', fs.readFileSync(bigPath), {
        filename: 'big.pdf',
        contentType: 'application/pdf',
      });
      fd.append('jobDescription', 'A'.repeat(60));
      const res = await fetch(`${BASE_URL}/api/analyze`, {
        method: 'POST',
        body: fd.getBuffer(),
        headers: fd.getHeaders(),
      });
      assert(res.status === 413, `Expected 413, got ${res.status}`);
    } finally {
      fs.unlinkSync(bigPath);
    }
  });

  // ── Test 8: Unsupported file type returns 400 ────────────────────────────
  await test('POST /api/analyze with .txt file returns 400', async () => {
    const txtPath = path.join(__dirname, 'fixtures', 'resume.txt');
    fs.writeFileSync(txtPath, 'Not a PDF or DOCX');
    try {
      const fd = new (require('form-data'))();
      fd.append('resume', fs.readFileSync(txtPath), {
        filename: 'resume.txt',
        contentType: 'text/plain',
      });
      fd.append('jobDescription', 'A'.repeat(60));
      const res = await fetch(`${BASE_URL}/api/analyze`, {
        method: 'POST',
        body: fd.getBuffer(),
        headers: fd.getHeaders(),
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    } finally {
      fs.unlinkSync(txtPath);
    }
  });
}

async function main() {
  // Install form-data if missing
  try {
    require('form-data');
  } catch {
    console.log('Installing form-data for tests...');
    require('child_process').execSync('npm install form-data --no-save', { stdio: 'inherit' });
  }

  createSamplePdf();
  await runE2ETests();

  console.log(`\n══════════════════════════════════════════`);
  console.log(`  E2E Results: ${passed} passed, ${failed} failed`);
  console.log(`══════════════════════════════════════════\n`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
