-- ResumeFit AI - Seed Data (optional)
-- This file is provided for testing convenience.
-- It inserts a sample analysis row so the history panel is
-- non-empty when you first open the application.
--
-- NOTE: This is NOT required for production use.

USE resume_fit_ai;

INSERT IGNORE INTO analyses (
  id,
  job_title,
  company_name,
  job_description,
  resume_filename,
  match_score,
  skills_score,
  experience_score,
  projects_score,
  required_skills_total,
  required_skills_matched,
  preferred_skills_total,
  preferred_skills_matched,
  analysis_json,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Senior Software Engineer',
  'Acme Corp',
  'We are looking for a Senior Software Engineer with strong Node.js, React, and PostgreSQL skills.',
  'sample_resume.pdf',
  72,
  68,
  80,
  60,
  5,
  3,
  3,
  2,
  JSON_OBJECT(
    'overallAssessment', 'The candidate shows strong Node.js and backend experience but lacks React proficiency.',
    'matchedSkills', JSON_ARRAY(
      JSON_OBJECT('skill', 'Node.js', 'evidence', 'Listed under skills and used in multiple projects'),
      JSON_OBJECT('skill', 'PostgreSQL', 'evidence', 'Used in internship project'),
      JSON_OBJECT('skill', 'REST APIs', 'evidence', 'Built REST APIs at previous employer')
    ),
    'missingRequiredSkills', JSON_ARRAY('React', 'TypeScript'),
    'missingPreferredSkills', JSON_ARRAY('GraphQL'),
    'experienceAnalysis', JSON_OBJECT(
      'score', 80,
      'summary', '3 years of relevant backend experience. Missing frontend experience.',
      'highlights', JSON_ARRAY('Backend API development', 'Database design')
    ),
    'educationAnalysis', JSON_OBJECT(
      'score', 90,
      'summary', 'BS Computer Science - meets requirements'
    ),
    'projectsAnalysis', JSON_OBJECT(
      'score', 60,
      'summary', 'Two relevant projects demonstrate backend skills.',
      'relevantProjects', JSON_ARRAY('E-commerce API', 'Task Manager App')
    ),
    'importantKeywords', JSON_ARRAY('microservices', 'CI/CD', 'Docker', 'Agile'),
    'suggestions', JSON_ARRAY(
      'Add React projects or coursework to demonstrate frontend capability.',
      'Include TypeScript examples in your GitHub portfolio.',
      'Mention any Agile or Scrum experience explicitly.'
    ),
    'strengths', JSON_ARRAY('Strong Node.js background', 'Database expertise', 'Clean code practices'),
    'gaps', JSON_ARRAY('No React experience', 'Missing TypeScript', 'Limited frontend exposure')
  ),
  DATE_SUB(NOW(), INTERVAL 2 HOUR)
);
