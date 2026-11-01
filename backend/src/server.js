import http from 'http';
import app from './app.js';
import { ENV } from './config/env.js';
import { connectDatabase } from './infrastructure/database/prisma.js';
import { initRedis } from './infrastructure/redis/redisClient.js';
import { initSocketIO } from './realtime/socket.js';

async function bootstrap() {
  try {
    console.log('[Server] Initializing infrastructure...');
    
    // Connect Database
    await connectDatabase();

    // Connect or initialize Redis (with fallback)
    await initRedis();

    // Create HTTP server
    const httpServer = http.createServer(app);

    // Initialize Socket.IO
    initSocketIO(httpServer);

    httpServer.listen(ENV.PORT, () => {
      console.log(`[Server] Real-Time Collaborative Workspace Backend running on port ${ENV.PORT}`);
      console.log(`[Server] Environment: ${ENV.NODE_ENV}`);
    });
  } catch (error) {
    console.error('[Server] Fatal startup error:', error);
    process.exit(1);
  }
}

bootstrap();
