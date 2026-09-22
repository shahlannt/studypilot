# StudyPilot

> AI-powered study management platform — built for students who want to study smarter, not harder.

**StudyPilot** is a full-stack SaaS application that helps students manage subjects, take smart notes, generate AI quizzes, track study sessions, and get personalized AI recommendations based on their actual performance data.

## Live Demo

[Deployed link](#) — https://studypilot-ellv.onrender.com

---

## Features

### Core Study Tools
- **Subjects** — Organize study materials with progress tracking and per-subject stats
- **Tasks** — Kanban-style board with filters (status, priority, subject), search, and sorting
- **Notes** — Markdown editor with autosave, tagging, favorites, and word/character count
- **Calendar** — Month view with task indicators, deadlines, and upcoming task list
- **Search** — Global debounced search across notes, tasks, and subjects

### AI-Powered Features
- **AI Study Assistant** — Conversational chat with context-aware responses (can reference a specific note or subject)
- **AI Note Summarizer** — One-click structured summaries: overview, key concepts, definitions, takeaways
- **AI Quiz Generator** — Generate MCQ, true/false, or short-answer quizzes from notes or subjects
- **AI Recommendations** — Data-driven study suggestions based on quiz weak topics, low-progress subjects, and overdue tasks

### Study Tracking
- **Pomodoro Timer** — Focus/break cycles with configurable durations
- **Manual Sessions** — Start/stop timers with pause support
- **Analytics** — Recharts dashboards: daily/weekly study time, task completion pie chart, quiz accuracy trends, subject progress comparison
- **Activity Heatmap** — GitHub-style 16-week visual of study activity
- **Streaks** — Current and longest streak calculation from study sessions + task completions

### Platform
- **Dark Mode** — Full dark theme via Tailwind class strategy
- **Responsive Design** — Desktop sidebar, mobile drawer, fluid grid layouts
- **In-App Notifications** — Deadline reminders, overdue alerts, quiz results
- **Profile & Settings** — Theme, notifications, AI preferences, pomodoro config, password management

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router v6, Tailwind CSS 3, Recharts, React Hook Form |
| Backend | Node.js, Express, Mongoose, JWT, bcryptjs |
| Database | MongoDB (Atlas or local) |
| AI | OpenAi-compatible API via swappable provider abstraction |
| Icons | Lucide React |

---

## Project Structure

```
studypilot/
├── server/
│   ├── config/          # MongoDB connection
│   ├── controllers/     # Route handlers (auth, tasks, notes, AI, analytics…)
│   ├── middleware/       # auth, error, validate, rateLimit
│   ├── models/          # 10 Mongoose schemas with validation & indexes
│   ├── routes/          # RESTful API routes under /api/*
│   ├── services/
│   │   └── ai/          # AIService → provider abstraction (OpenAI, etc.)
│   ├── utils/           # Token generation
│   ├── validators/      # express-validator rules
│   └── server.js        # Express app entry
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/  # Sidebar, Header, AppLayout
│   │   │   └── ui/      # 12 reusable components (Button, Modal, Badge…)
│   │   ├── context/     # Auth, Theme, Toast providers
│   │   ├── hooks/       # useFetch, useDebounce
│   │   ├── pages/       # 14 page components
│   │   ├── services/    # Centralized API layer
│   │   └── utils/       # Date, format, and display helpers
│   └── vite.config.js
├── .env.example
├── docker-compose.yml   # Optional local MongoDB
└── render.yaml          # Render deployment config
```

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- MongoDB (local, Atlas, or Docker)

### 1. Clone and install

```bash
git clone https://github.com/yourusername/studypilot.git
cd studypilot
npm run install:all
```

### 2. Configure environment

```bash
cp .env.example server/.env
```

Edit `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/studypilot
JWT_SECRET=your-random-secret-here
JWT_EXPIRE=7d
AI_API_KEY=sk-your-openai-key
AI_PROVIDER=Grok
CLIENT_URL=http://localhost:5173
```

### 3. Start development

```bash
npm run dev
```

This runs both servers concurrently:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:5000

### 4. Run tests

```bash
cd server && node scripts/smoke-test.js
```

---

## API Overview

All endpoints are prefixed with `/api`. Authenticated routes require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT token |
| GET | `/auth/me` | Current user |
| CRUD | `/subjects` | Manage study subjects |
| CRUD | `/tasks` | Tasks with filters, search, toggle |
| CRUD | `/notes` | Markdown notes with favorites |
| POST | `/sessions/start` | Start study session |
| PATCH | `/sessions/:id/end` | End session (computes duration) |
| POST | `/quizzes` | Generate AI quiz |
| POST | `/quizAttempts` | Submit graded quiz attempt |
| POST | `/ai/chat` | Conversational AI assistant |
| POST | `/ai/summarize` | Summarize a note |
| POST | `/ai/generate-quiz` | Generate quiz from note/subject |
| POST | `/ai/recommend` | Personalized study recommendations |
| GET | `/analytics` | Full analytics (charts data) |
| GET | `/analytics/dashboard` | Dashboard summary stats |

---

## AI Architecture

The AI layer uses a **provider abstraction pattern**:

```
AIService (singleton)
  └── getProvider() → switch on AI_PROVIDER env
        └── OpenAIProvider
              └── fetch to OpenAI-compatible endpoint
                    (works with OpenAI, OpenRouter, etc.)
```

- **AI_API_KEY** is never committed — loaded from env only
- **AI_BASE_URL** can be overridden for OpenRouter or local models
- **Context-aware**: the chat endpoint loads only the referenced note/subject content (never the full database)
- **Rate limited**: 20 requests per minute per IP on all `/ai/*` routes
- **Structured output**: prompts instruct JSON responses; fallback parser handles code-fence-wrapped or unstructured responses

---

## Security

- JWT tokens in localStorage, sent via `Authorization: Bearer` header
- Passwords hashed with bcryptjs (12 rounds)
- **User data isolation**: every database query filters by `user: req.user._id` derived from the JWT — users can never access another user's data
- AI endpoints rate-limited to 20 req/min
- Stack traces hidden in production (`NODE_ENV=production`)
- `.env` files are gitignored; `.env.example` is committed as a template

---

## Deployment

### Frontend (Vercel)
1. Import your GitHub repo
2. Set **Root Directory** to `client`
3. Build command: `npm run build`
4. Output directory: `dist`

### Backend (Render)
1. Import the same repo
2. Set **Root Directory** to `server`
3. Start command: `node server.js`
4. Add environment variables (see `.env.example`)
5. Or use the included `render.yaml` for auto-configuration

### Database
Use [MongoDB Atlas](https://www.mongodb.com/atlas) free tier — set `MONGODB_URI` to your Atlas connection string.

---

## Development Notes

- **Smoke test**: 23 integration tests run against `mongodb-memory-server` (no external MongoDB needed)
- **Autosave**: NoteEditor uses a 1.5-second debounce timer with ref-based state to avoid stale closures
- **Pomodoro timer**: Uses ref-based phase/count tracking to prevent stale closure bugs during intervals
- **Charts**: Full Recharts integration for analytics; dashboard uses inline mini-charts for lightweight rendering
- **AI responses**: Parser handles raw JSON, code-fence-wrapped JSON, and unstructured text fallback

---

Built as a showcase project demonstrating full-stack MERN development with AI integration, from database design through deployment.
