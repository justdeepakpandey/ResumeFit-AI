# ResumeFit AI

An AI-powered resume analyser and job matching system built with Node.js, Express, MySQL, and the Google Gemini API.

---

## Features

- **PDF & DOCX** resume parsing (pdf-parse + mammoth)
- **Gemini AI** analysis — skills, experience, projects, education, keywords
- **Deterministic match score** (documented formula, 0–100)
- **Dark analytics dashboard** with animated score ring and component bars
- **Drag-and-drop** file upload
- **Analysis history** stored in MySQL (shared session — no auth)
- **Rate limiting** on the expensive analyse endpoint
- **Prompt injection mitigations** — resume and JD treated as untrusted data
- Temporary upload files are **deleted after extraction**

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | ≥ 18.0.0 |
| npm | ≥ 8 |
| MySQL | ≥ 8.0 |
| Google Gemini API key | — |

---

## Quick Start

### 1. Clone / open the project

```bash
cd resume-fit-ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
copy .env.example .env
```

Edit `.env` and fill in your values:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=resumefit_ai

GEMINI_API_KEY=your_gemini_api_key_here

MAX_FILE_SIZE_MB=5
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10

ALLOWED_ORIGINS=http://localhost:3000
```

### 4. Set up the database

```bash
mysql -u root -p < database/schema.sql
```

Optional — load sample data for the history panel:

```bash
mysql -u root -p < database/seed.sql
```

### 5. Start the server

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

Open your browser at **http://localhost:3000**

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP server port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `DB_HOST` | No | `localhost` | MySQL host |
| `DB_PORT` | No | `3306` | MySQL port |
| `DB_USER` | No | `root` | MySQL user |
| `DB_PASSWORD` | No | *(empty)* | MySQL password |
| `DB_NAME` | No | `resumefit_ai` | MySQL database name |
| `GEMINI_API_KEY` | **Yes** | — | Google Gemini API key |
| `MAX_FILE_SIZE_MB` | No | `5` | Max upload size in MB |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `10` | Max analyses per window |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated CORS origins |

---

## API Reference

### `GET /api/health`
Application and database health check.

**Response:**
```json
{
  "status": "ok",
  "app": "ResumeFit AI",
  "version": "1.0.0",
  "environment": "development",
  "database": "connected",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### `POST /api/analyze`
Upload a resume and analyse it against a job description.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resume` | File | Yes | PDF or DOCX, max 5 MB |
| `jobDescription` | string | Yes | Full job description (50–30,000 chars) |
| `jobTitle` | string | No | Job title (max 255 chars) |
| `companyName` | string | No | Company name (max 255 chars) |

**Success response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "matchScore": 74,
    "skillsScore": 68,
    "experienceScore": 80,
    "projectsScore": 75,
    "requiredSkillsTotal": 5,
    "requiredSkillsMatched": 3,
    "preferredSkillsTotal": 3,
    "preferredSkillsMatched": 2,
    "analysis": { ... },
    "createdAt": "..."
  }
}
```

**Error response (400/422/502/503):**
```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

---

### `GET /api/analyses`
Returns the 20 most recent analyses (list, without full analysis JSON).

| Query param | Default | Description |
|-------------|---------|-------------|
| `limit` | `20` | Max results (1–100) |

---

### `GET /api/analyses/:id`
Returns a single full analysis report including `analysis_json`.

---

### `DELETE /api/analyses/:id`
Permanently deletes an analysis report.

---

## Score Formula

```
matchScore = (skillsScore × 0.60) + (experienceScore × 0.25) + (projectsScore × 0.15)
```

**Skills score:**
```
requiredComponent  = (requiredMatched / requiredTotal) × 100   [or 75 if no required skills]
preferredComponent = (preferredMatched / preferredTotal) × 100  [or 75 if no preferred skills]
skillsScore        = requiredComponent × 0.80 + preferredComponent × 0.20
```

**Experience score:** Gemini's `experienceAnalysis.score` (0–100, validated)

**Projects score:**
```
projectsScore = projectsAnalysis.score × 0.70 + educationAnalysis.score × 0.30
```

The score is **never** taken directly from the AI. It is calculated deterministically from validated component data. When evidence is insufficient (e.g. no skills listed in the JD), a conservative score of 75/100 is used rather than penalising the candidate unfairly.

---

## Project Structure

```
resume-fit-ai/
├── public/
│   ├── index.html          # SPA dashboard
│   ├── css/style.css       # Design system + all styles
│   └── js/app.js           # Frontend application
├── src/
│   ├── server.js           # Entry point
│   ├── app.js              # Express app factory
│   ├── config/
│   │   ├── env.js          # Environment variable loader
│   │   └── db.js           # MySQL connection pool
│   ├── routes/
│   │   └── analysis.routes.js
│   ├── controllers/
│   │   └── analysis.controller.js
│   ├── services/
│   │   ├── resumeParser.service.js   # PDF + DOCX parsing
│   │   ├── gemini.service.js         # Gemini API + response validation
│   │   ├── matching.service.js       # Deterministic score calculator
│   │   └── analysis.service.js       # Pipeline orchestrator + DB persistence
│   ├── middleware/
│   │   ├── upload.js                 # Multer configuration
│   │   ├── rateLimiter.js            # express-rate-limit
│   │   └── errorHandler.js           # Global error handler
│   ├── validators/
│   │   └── analysis.validator.js     # Input validation
│   └── utils/
│       └── fileUtils.js              # Safe file deletion
├── database/
│   ├── schema.sql          # Table definitions
│   └── seed.sql            # Optional sample data
├── tests/
│   └── run-tests.js        # Unit + integration tests
├── uploads/                # Temp upload directory (auto-cleaned)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Running Tests

```bash
# Start the server first (for integration tests):
npm run dev

# In a second terminal:
npm test
```

Unit tests (score calculation, input validation) run without a server.  
Integration tests require the server to be running on port 3000.

---

## Troubleshooting

### "GEMINI_API_KEY is not configured"
Set `GEMINI_API_KEY` in your `.env` file. Get a key at https://aistudio.google.com/

### "Could not connect to MySQL"
- Check MySQL is running: `mysqladmin -u root -p status`
- Verify `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` in `.env`
- Run the schema: `mysql -u root -p < database/schema.sql`

### "Could not extract meaningful text from the resume"
The PDF may be scanned (image-only) or password-protected. Use a text-based PDF or convert using an OCR tool.

### Rate limit hit (429)
Default limit is 10 analyses per 15 minutes. Adjust `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS` in `.env`.

### CORS error in browser
Add your frontend origin to `ALLOWED_ORIGINS` in `.env`.

---

## Limitations & Notes

- **History is shared** — there is no user authentication. All analyses are visible to anyone with access to the running application. This is intentional for a local MVP.
- **Raw resume text is never stored** — only the structured analysis JSON is persisted.
- **Uploaded files are deleted** after text extraction, whether parsing succeeds or fails.
- **Gemini component scores are subjective** — the formula is deterministic given those inputs, but quality depends on Gemini's assessment.
- **Image-based PDFs** (scanned documents) are not supported and will return an error.

---

## Getting a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click **Get API key** → **Create API key**
4. Copy the key into your `.env` file as `GEMINI_API_KEY`

The free tier is sufficient for development and moderate usage.
