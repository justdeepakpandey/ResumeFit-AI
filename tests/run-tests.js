'use strict';
/**
 * tests/run-tests.js
 * Lightweight test runner (no external test framework required).
 * Run with: node tests/run-tests.js
 *
 * Tests:
 *  1. Score calculation logic (unit)
 *  2. Input validator (unit)
 *  3. Gemini response normaliser (unit)
 *  4. Health endpoint (integration — server must be running)
 *  5. Validation endpoint (integration — server must be running)
 */

const { calculateScore } = require('../src/services/matching.service');
const { validateAnalyzeInput } = require('../src/validators/analysis.validator');

let passed = 0;
let failed = 0;

/* ── Test helpers ─────────────────────────────────────────── */
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`     → ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertRange(val, min, max, msg) {
  if (val < min || val > max)
    throw new Error(msg || `Expected ${val} to be in [${min}, ${max}]`);
}

/* ── Mock data ────────────────────────────────────────────── */
const FULL_MATCH_ANALYSIS = {
  matchedSkills: [
    { skill: 'Node.js', evidence: 'Built APIs' },
    { skill: 'React', evidence: 'Built frontend' },
    { skill: 'PostgreSQL', evidence: 'Database work' },
    { skill: 'TypeScript', evidence: 'Used in project' },
  ],
  allRequiredSkills: ['Node.js', 'React', 'PostgreSQL'],
  allPreferredSkills: ['TypeScript', 'Docker'],
  missingRequiredSkills: [],
  missingPreferredSkills: ['Docker'],
  experienceAnalysis: { score: 90, summary: 'Great', highlights: [] },
  educationAnalysis: { score: 85, summary: 'Good' },
  projectsAnalysis: { score: 80, summary: 'Solid', relevantProjects: [] },
  importantKeywords: [],
  suggestions: [],
  strengths: [],
  gaps: [],
  overallAssessment: 'Excellent match.',
};

const ZERO_SKILLS_ANALYSIS = {
  matchedSkills: [],
  allRequiredSkills: ['Node.js', 'React', 'PostgreSQL'],
  allPreferredSkills: ['TypeScript'],
  missingRequiredSkills: ['Node.js', 'React', 'PostgreSQL'],
  missingPreferredSkills: ['TypeScript'],
  experienceAnalysis: { score: 20, summary: 'Minimal', highlights: [] },
  educationAnalysis: { score: 50, summary: 'Adequate' },
  projectsAnalysis: { score: 10, summary: 'No relevant projects', relevantProjects: [] },
  importantKeywords: [],
  suggestions: [],
  strengths: [],
  gaps: [],
  overallAssessment: 'Poor match.',
};

const NO_SKILLS_IN_JD_ANALYSIS = {
  matchedSkills: [],
  allRequiredSkills: [],     // JD had no extractable skills
  allPreferredSkills: [],
  missingRequiredSkills: [],
  missingPreferredSkills: [],
  experienceAnalysis: { score: 60, summary: 'OK', highlights: [] },
  educationAnalysis: { score: 70, summary: 'OK' },
  projectsAnalysis: { score: 65, summary: 'OK', relevantProjects: [] },
  importantKeywords: [],
  suggestions: [],
  strengths: [],
  gaps: [],
  overallAssessment: 'Partial match.',
};

/* ════════════════════════════════════════════════════════════
   UNIT TESTS: Score Calculation
════════════════════════════════════════════════════════════ */
console.log('\n── Score Calculation (unit) ──────────────────────────');

test('Full match gives high score (>=80)', () => {
  const s = calculateScore(FULL_MATCH_ANALYSIS);
  assertRange(s.matchScore, 80, 100, `Score was ${s.matchScore}`);
});

test('Zero skills match gives low score (<=40)', () => {
  const s = calculateScore(ZERO_SKILLS_ANALYSIS);
  assertRange(s.matchScore, 0, 40, `Score was ${s.matchScore}`);
});

test('No extractable JD skills uses insufficient-evidence score (>=50)', () => {
  const s = calculateScore(NO_SKILLS_IN_JD_ANALYSIS);
  assertRange(s.matchScore, 50, 100,
    `Expected score >=50 when JD has no skills, got ${s.matchScore}`);
});

test('Score is always an integer 0-100', () => {
  const s = calculateScore(FULL_MATCH_ANALYSIS);
  assert(Number.isInteger(s.matchScore), 'matchScore must be integer');
  assertRange(s.matchScore, 0, 100);
});

test('Component scores are all integers 0-100', () => {
  const s = calculateScore(FULL_MATCH_ANALYSIS);
  for (const key of ['skillsScore', 'experienceScore', 'projectsScore']) {
    assert(Number.isInteger(s[key]), `${key} must be integer`);
    assertRange(s[key], 0, 100, `${key} out of range`);
  }
});

test('Required skills counted correctly', () => {
  const s = calculateScore(FULL_MATCH_ANALYSIS);
  // 3 required skills in JD, all 3 matched
  assertEqual(s.requiredSkillsTotal, 3, 'requiredSkillsTotal');
  assertEqual(s.requiredSkillsMatched, 3, 'requiredSkillsMatched');
});

test('Preferred skills counted correctly', () => {
  const s = calculateScore(FULL_MATCH_ANALYSIS);
  // 2 preferred skills, 1 matched (TypeScript yes, Docker no)
  assertEqual(s.preferredSkillsTotal, 2, 'preferredSkillsTotal');
  assertEqual(s.preferredSkillsMatched, 1, 'preferredSkillsMatched');
});

test('Skill matching is case-insensitive', () => {
  const analysis = {
    ...FULL_MATCH_ANALYSIS,
    matchedSkills: [{ skill: 'node.js', evidence: 'used' }],
    allRequiredSkills: ['Node.js'],
    allPreferredSkills: [],
  };
  const s = calculateScore(analysis);
  assertEqual(s.requiredSkillsMatched, 1, 'Case-insensitive match failed');
});

test('Score formula: (skills*0.6)+(exp*0.25)+(proj*0.15)', () => {
  // Craft an analysis where we know exact expected values
  const analysis = {
    matchedSkills: [{ skill: 'JS', evidence: 'used' }],
    allRequiredSkills: ['JS'],
    allPreferredSkills: [],
    experienceAnalysis: { score: 80, summary: '', highlights: [] },
    educationAnalysis: { score: 100, summary: '' },
    projectsAnalysis: { score: 60, summary: '', relevantProjects: [] },
    missingRequiredSkills: [],
    missingPreferredSkills: [],
    importantKeywords: [], suggestions: [], strengths: [], gaps: [],
    overallAssessment: '',
  };
  // skillsScore = 100*0.8 + 75*0.2 = 80+15 = 95 (75 = insufficient evidence for preferred)
  // projectsScore = 60*0.7 + 100*0.3 = 42+30 = 72
  // matchScore = 95*0.6 + 80*0.25 + 72*0.15 = 57+20+10.8 = 87.8 → 88
  const s = calculateScore(analysis);
  assertRange(s.matchScore, 85, 92, `Expected ~88, got ${s.matchScore}`);
});

/* ════════════════════════════════════════════════════════════
   UNIT TESTS: Input Validator
════════════════════════════════════════════════════════════ */
console.log('\n── Input Validation (unit) ───────────────────────────');

const VALID_FILE = { path: '/tmp/test.pdf', originalname: 'resume.pdf', size: 1024 };
const VALID_BODY = {
  jobDescription: 'A'.repeat(60),
  jobTitle: 'Engineer',
  companyName: 'Acme',
};

test('Valid input passes', () => {
  const { valid } = validateAnalyzeInput(VALID_BODY, VALID_FILE);
  assert(valid, 'Expected valid');
});

test('Missing file fails', () => {
  const { valid, errors } = validateAnalyzeInput(VALID_BODY, null);
  assert(!valid, 'Should fail without file');
  assert(errors.some((e) => e.toLowerCase().includes('resume')), 'Error should mention resume');
});

test('Missing job description fails', () => {
  const { valid, errors } = validateAnalyzeInput({ jobDescription: '' }, VALID_FILE);
  assert(!valid, 'Should fail without JD');
  assert(errors.some((e) => e.toLowerCase().includes('job description')), 'Error should mention JD');
});

test('Short job description (< 50 chars) fails', () => {
  const { valid } = validateAnalyzeInput({ jobDescription: 'Short.' }, VALID_FILE);
  assert(!valid, 'Should fail with short JD');
});

test('Exactly 50 character JD passes', () => {
  const { valid } = validateAnalyzeInput({ jobDescription: 'A'.repeat(50) }, VALID_FILE);
  assert(valid, 'Should pass with exactly 50 char JD');
});

test('Job title over limit fails', () => {
  const { valid } = validateAnalyzeInput(
    { ...VALID_BODY, jobTitle: 'A'.repeat(256) },
    VALID_FILE
  );
  assert(!valid, 'Should fail with overly long job title');
});

test('Optional fields can be empty', () => {
  const { valid } = validateAnalyzeInput(
    { jobDescription: VALID_BODY.jobDescription, jobTitle: '', companyName: '' },
    VALID_FILE
  );
  assert(valid, 'Optional fields should be allowed to be empty');
});

/* ════════════════════════════════════════════════════════════
   INTEGRATION TESTS (require running server)
════════════════════════════════════════════════════════════ */
async function integrationTests(base) {
  const BASE = base || process.env.TEST_BASE_URL || ('http://localhost:' + (process.env.PORT || 3000));

  // ── Health endpoint ──────────────────────────────────────
  await asyncTest('GET /api/health returns 200 or 503', async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert([200, 503].includes(res.status), `Unexpected status: ${res.status}`);
    const data = await res.json();
    assert(data.status === 'ok' || data.status === 'degraded', 'Invalid status field');
    assert(data.app === 'ResumeFit AI', 'App name mismatch');
  });

  // ── Analyze: missing file ────────────────────────────────
  await asyncTest('POST /api/analyze without file returns 400', async () => {
    const fd = new FormData();
    fd.append('jobDescription', 'A'.repeat(60));
    const res = await fetch(`${BASE}/api/analyze`, { method: 'POST', body: fd });
    assertEqual(res.status, 400, `Expected 400, got ${res.status}`);
  });

  // ── Analyze: missing JD ──────────────────────────────────
  await asyncTest('POST /api/analyze without JD returns 400', async () => {
    const fd = new FormData();
    fd.append('jobDescription', '');
    const res = await fetch(`${BASE}/api/analyze`, { method: 'POST', body: fd });
    assertEqual(res.status, 400, `Expected 400, got ${res.status}`);
  });

  // ── GET analyses list ─────────────────────────────────────
  await asyncTest('GET /api/analyses returns success:true', async () => {
    const res = await fetch(`${BASE}/api/analyses`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'success must be true');
    assert(Array.isArray(data.data), 'data must be array');
  });

  // ── GET unknown analysis ──────────────────────────────────
  await asyncTest('GET /api/analyses/unknown returns 404', async () => {
    const res = await fetch(`${BASE}/api/analyses/does-not-exist`);
    assertEqual(res.status, 404, `Expected 404, got ${res.status}`);
  });

  // ── DELETE unknown analysis ───────────────────────────────
  await asyncTest('DELETE /api/analyses/unknown returns 404', async () => {
    const res = await fetch(`${BASE}/api/analyses/does-not-exist`, { method: 'DELETE' });
    assertEqual(res.status, 404, `Expected 404, got ${res.status}`);
  });

  // ── Unknown API route ─────────────────────────────────────
  await asyncTest('GET /api/unknown returns 404', async () => {
    const res = await fetch(`${BASE}/api/unknown-endpoint-xyz`);
    assertEqual(res.status, 404, `Expected 404, got ${res.status}`);
  });
}

async function asyncTest(name, fn) {
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

/* ── Run all ─────────────────────────────────────────────── */
async function main() {
  const targetPort = process.env.PORT || 3000;
  const targetBase = process.env.TEST_BASE_URL || `http://localhost:${targetPort}`;

  let serverOnline = false;
  try {
    const probe = await fetch(`${targetBase}/api/health`, {
      signal: AbortSignal.timeout(1200),
    });
    serverOnline = probe.status > 0;
  } catch {
    serverOnline = false;
  }

  if (serverOnline) {
    console.log(`\n── Integration Tests (connected to ${targetBase}) ──`);
    await integrationTests(targetBase);
  } else {
    console.log(`\n── Integration Tests (skipped: server not running on ${targetBase}) ──`);
    console.log('   Run "npm run dev" or start the server to run integration suite.');
  }

  console.log(`\n══════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`══════════════════════════════════════════\n`);

  process.exitCode = failed > 0 ? 1 : 0;
}

main();
