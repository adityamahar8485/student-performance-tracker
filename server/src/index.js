import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import connectDB from './config/db.js';
import { securityHeaders, apiLimiter, authLimiter } from './middleware/security.js';
import { notFound, errorHandler } from './middleware/error.js';
import { protect, authorize } from './middleware/auth.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import studentRoutes from './routes/student.routes.js';

// Fail loudly at boot on a misconfigured deployment instead of at first request
const requiredEnv = ['MONGO_URI', 'JWT_SECRET', 'CLIENT_URL'];
if (process.env.NODE_ENV === 'production') {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required env vars in production: ${missing.join(', ')}`);
    process.exit(1);
  }
}

const app = express();

// Behind Render's proxy: without this every visitor shares one rate-limit bucket
app.set('trust proxy', 1);

app.use(securityHeaders);
app.use(
  cors({
    origin: (process.env.CLIENT_URL || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim()),
    credentials: false, // Bearer-token auth — no cookies
  })
);
app.use(express.json({ limit: '256kb' })); // bulk-marks payloads

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.get('/api/health', (req, res) =>
  res.json({ success: true, status: 'ok', uptime: process.uptime() })
);

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', apiLimiter, protect, authorize('admin'), adminRoutes);
app.use('/api/teacher', apiLimiter, protect, authorize('teacher'), teacherRoutes);
app.use('/api/student', apiLimiter, protect, authorize('student'), studentRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
});
