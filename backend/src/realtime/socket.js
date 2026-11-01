import { Server } from 'socket.io';
import { ENV } from '../config/env.js';
import { socketAuthMiddleware } from './socketAuth.js';
import { setupPresenceEvents } from './events/presenceEvents.js';
import { setupChatEvents } from './events/chatEvents.js';
import { setupPresentationEvents } from './events/presentationEvents.js';

let ioInstance = null;

export function initSocketIO(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: [ENV.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // JWT authentication during handshake
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    // Setup presence tracking (multi-tab/socket aware)
    setupPresenceEvents(io, socket);

    // Setup chat events
    setupChatEvents(io, socket);

    // Setup live whiteboard presentation events
    setupPresentationEvents(io, socket);
  });

  ioInstance = io;
  return io;
}

export function getIO() {
  if (!ioInstance) {
    throw new Error('Socket.IO has not been initialized');
  }
  return ioInstance;
}
