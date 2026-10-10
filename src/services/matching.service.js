'use strict';
/**
 * src/services/matching.service.js
 * Deterministic match score calculator.
 *
 * SCORE FORMULA (documented)
 * ──────────────────────────
 * Final score = (skillsScore × 0.60) + (experienceScore × 0.25) + (projectsScore × 0.15)
 *
 * skillsScore (0-100):
 *   Within the skills component, required skills carry 80% weight and
 *   preferred skills carry 20% weight.
 *
 *   requiredComponent  = (requiredMatched / requiredTotal) × 100   if requiredTotal > 0 else 75
 *   preferredComponent = (preferredMatched / preferredTotal) × 100 if preferredTotal > 0 else 75
 *   skillsScore = (requiredComponent × 0.80) + (preferredComponent × 0.20)
 *
 * experienceScore (0-100):
 *   Taken from Gemini's experienceAnalysis.score (validated 0-100 integer).
 *   Rationale: experience alignment requires semantic understanding that the
 *   AI is well-suited to assess. The score is capped and validated upstream.
 *
 * projectsScore (0-100):
 *   Weighted average of Gemini's projectsAnalysis.score (70%) and
 *   educationAnalysis.score (30%).
 *   Rationale: both are qualitative assessments from the AI; combining them
 *   gives a rounded "evidence quality" sub-score.
 *
 * LIMITATIONS
 * ──────────
 * - If the AI returns no required skills, we conservatively assume 75/100
 *   (insufficient evidence, not necessarily poor fit).
 * - AI component scores are subjective; the formula is deterministic given
 *   those inputs but depends on the quality of the AI's assessment.
 * - The score does not account for seniority, cultural fit, or salary match.
 */

// Configurable weights
const WEIGHTS = {
  skills: 0.60,
  experience: 0.25,
  projects: 0.15,
};

const SKILLS_WEIGHTS = {
  required: 0.80,
  preferred: 0.20,
};

const INSUFFICIENT_EVIDENCE_SCORE = 75; // used when we have no data to judge

/**
 * Calculates the deterministic match score from a validated analysis object.
 *
 * @param {object} analysis - Normalised output from gemini.service
 * @returns {{
 *   matchScore: number,
 *   skillsScore: number,
 *   experienceScore: number,
 *   projectsScore: number,
 *   requiredSkillsTotal: number,
 *   requiredSkillsMatched: number,
 *   preferredSkillsTotal: number,
 *   preferredSkillsMatched: number,
 * }}
 */
function calculateScore(analysis) {
  // ── Skills component ──────────────────────────────────────────────────────
  const requiredTotal = analysis.allRequiredSkills.length;
  const requiredMatched = analysis.matchedSkills.filter((ms) =>
    analysis.allRequiredSkills.some(
      (rs) => rs.toLowerCase() === ms.skill.toLowerCase()
    )
  ).length;

  const preferredTotal = analysis.allPreferredSkills.length;
  const preferredMatched = analysis.matchedSkills.filter((ms) =>
    analysis.allPreferredSkills.some(
      (ps) => ps.toLowerCase() === ms.skill.toLowerCase()
    )
  ).length;

  const requiredComponent =
    requiredTotal > 0
      ? (requiredMatched / requiredTotal) * 100
      : INSUFFICIENT_EVIDENCE_SCORE;

  const preferredComponent =
    preferredTotal > 0
      ? (preferredMatched / preferredTotal) * 100
      : INSUFFICIENT_EVIDENCE_SCORE;

  const skillsScore = Math.round(
    requiredComponent * SKILLS_WEIGHTS.required +
      preferredComponent * SKILLS_WEIGHTS.preferred
  );

  // ── Experience component ──────────────────────────────────────────────────
  const experienceScore = analysis.experienceAnalysis.score;

  // ── Projects + education component ───────────────────────────────────────
  const projectsScore = Math.round(
    analysis.projectsAnalysis.score * 0.70 +
      analysis.educationAnalysis.score * 0.30
  );

  // ── Final weighted score ──────────────────────────────────────────────────
  const matchScore = Math.round(
    skillsScore * WEIGHTS.skills +
      experienceScore * WEIGHTS.experience +
      projectsScore * WEIGHTS.projects
  );

  return {
    matchScore: clamp(matchScore),
    skillsScore: clamp(skillsScore),
    experienceScore: clamp(experienceScore),
    projectsScore: clamp(projectsScore),
    requiredSkillsTotal: requiredTotal,
    requiredSkillsMatched: requiredMatched,
    preferredSkillsTotal: preferredTotal,
    preferredSkillsMatched: preferredMatched,
  };
}

function clamp(n) {
  return Math.min(100, Math.max(0, n));
}

module.exports = { calculateScore, WEIGHTS, SKILLS_WEIGHTS };
