const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Prefer IPv4 for all connections. Render free tier has no IPv6 egress and
// smtp.gmail.com resolves to IPv6 first → ENETUNREACH on every mail send.
require('dns').setDefaultResultOrder('ipv4first');

// Boot-time SMTP reachability probe (only when SMTP is configured). Logs
// which ports are actually reachable so SMTP_PORT/SMTP_SECURE can be fixed.
const { probeSmtp } = require('./utils/sendEmail');
if (process.env.SMTP_HOST) {
  probeSmtp(process.env.SMTP_HOST);
}

// ─── Startup validation ───────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('FATAL: JWT_SECRET must be set and at least 32 characters in production.');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is required in production.');
    process.exit(1);
  }
}

// ─── Connect to database ──────────────────────────────────────────
connectDB();

const app = express();

// ─── Trust proxy (required behind Render/nginx reverse proxy) ─────
app.set('trust proxy', 1);

// ─── Security headers ────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,   // disabled to avoid breaking inline scripts/styles
  crossOriginEmbedderPolicy: false
}));

// ─── Compression ──────────────────────────────────────────────────
app.use(compression());

// ─── HTTP request logging ─────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Global rate limiter ──────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // 200 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', globalLimiter);

// ─── CORS ─────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// ─── Body parsing ─────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));

// ─── Static files (production React build) ───────────────────────
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuild));

// ─── API Routes ───────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/study-sessions', require('./routes/studySessions'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/quiz-attempts', require('./routes/quizAttempts'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/users', require('./routes/users'));

// ─── Health check (verifies DB connection) ────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    await mongoose.connection.db.admin().ping();
    res.json({
      status: 'ok',
      db: 'connected',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      db: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// ─── SPA catch-all (serve React for any non-API route) ────────────
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();      // let API 404s return JSON
  if (process.env.NODE_ENV !== 'production') return next(); // dev uses Vite
  res.sendFile(path.join(clientBuild, 'index.html'));
});

// ─── Error handler ────────────────────────────────────────────────
const { errorHandler } = require('./middleware/error');
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

// ─── Graceful shutdown ────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    // Stop in-memory DB if it was started
    if (global.__MEMDB__) {
      await global.__MEMDB__.stop();
    }
    console.log('All connections closed. Exiting.');
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
