import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import authRoutes from './modules/auth/authRoutes.js';
import userRoutes from './modules/users/userRoutes.js';
import groupRoutes from './modules/groups/groupRoutes.js';
import friendRoutes from './modules/friends/friendRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

const isOriginAllowed = (origin, callback) => {
  if (!origin) return callback(null, true);
  const allowed = [
    ENV.CLIENT_URL,
    ...(ENV.CLIENT_URL ? ENV.CLIENT_URL.split(',').map((s) => s.trim()) : []),
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
  if (allowed.includes('*') || allowed.includes(origin)) {
    return callback(null, true);
  }
  if (/^https:\/\/.*\.onrender\.com$/.test(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
    return callback(null, true);
  }
  return callback(null, true);
};

app.use(cors({
  origin: isOriginAllowed,
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/friends', friendRoutes);

// Centralized error handling
app.use(errorHandler);

export default app;
