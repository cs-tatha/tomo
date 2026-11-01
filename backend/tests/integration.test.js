import http from 'http';
import { io as ClientIO } from 'socket.io-client';
import app from '../src/app.js';
import { initSocketIO } from '../src/realtime/socket.js';
import { connectDatabase, prisma } from '../src/infrastructure/database/prisma.js';
import { initRedis, getRedisClient } from '../src/infrastructure/redis/redisClient.js';
import { ENV } from '../src/config/env.js';

let server;
let serverUrl;
let port;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, serverUrl);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE INTEGRATION TEST SUITE ---');

  // 1. Initialize infra
  await connectDatabase();
  await initRedis();

  const httpServer = http.createServer(app);
  initSocketIO(httpServer);

  await new Promise((resolve) => {
    server = httpServer.listen(0, () => {
      port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      console.log(`[Test Server] Listening on ${serverUrl}`);
      resolve();
    });
  });

  try {
    // 2. Register User 1: Rahul
    const rahulPayload = {
      username: `rahul_${Date.now()}`,
      email: `rahul_${Date.now()}@example.com`,
      password: 'password123',
    };
    console.log('\n[1] Registering User 1 (Rahul)...');
    const rahulReg = await request('POST', '/api/auth/register', rahulPayload);
    if (rahulReg.status !== 201) throw new Error(`Rahul registration failed: ${JSON.stringify(rahulReg.data)}`);
    const rahul = rahulReg.data.user;
    const rahulToken = rahulReg.data.accessToken;
    console.log(`✔ Rahul registered: ID=${rahul.id}, token received.`);

    // 3. Register User 2: Amit
    const amitPayload = {
      username: `amit_${Date.now()}`,
      email: `amit_${Date.now()}@example.com`,
      password: 'password123',
    };
    console.log('\n[2] Registering User 2 (Amit)...');
    const amitReg = await request('POST', '/api/auth/register', amitPayload);
    if (amitReg.status !== 201) throw new Error(`Amit registration failed: ${JSON.stringify(amitReg.data)}`);
    const amit = amitReg.data.user;
    const amitToken = amitReg.data.accessToken;
    console.log(`✔ Amit registered: ID=${amit.id}, token received.`);

    // 4. Create Group: Rahul creates "Sprint Planning"
    console.log('\n[3] Rahul creates discussion group...');
    const groupRes = await request('POST', '/api/groups', {
      name: 'Sprint Planning',
      description: 'Weekly team discussion & whiteboard',
    }, rahulToken);
    if (groupRes.status !== 201) throw new Error(`Group creation failed: ${JSON.stringify(groupRes.data)}`);
    const group = groupRes.data.group;
    console.log(`✔ Group created: ID=${group.id}, Name="${group.name}"`);

    // 5. Add Amit to the group
    console.log('\n[4] Rahul invites Amit to group...');
    const addMemberRes = await request('POST', `/api/groups/${group.id}/members`, {
      userId: amit.id,
      role: 'MEMBER',
    }, rahulToken);
    if (addMemberRes.status !== 201) throw new Error(`Add member failed: ${JSON.stringify(addMemberRes.data)}`);
    console.log(`✔ Amit successfully added to group as MEMBER.`);

    // 6. Connect Socket.IO clients for Rahul and Amit
    console.log('\n[5] Connecting Socket.IO clients with JWT handshake authentication...');
    const rahulSocket = ClientIO(serverUrl, {
      auth: { token: rahulToken },
      transports: ['websocket'],
    });

    const amitSocket = ClientIO(serverUrl, {
      auth: { token: amitToken },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((resolve) => rahulSocket.on('connect', resolve)),
      new Promise((resolve) => amitSocket.on('connect', resolve)),
    ]);
    console.log(`✔ Both Rahul and Amit connected to Socket.IO gateway.`);

    // 7. Join Group Room
    console.log('\n[6] Joining group room...');
    await Promise.all([
      new Promise((resolve) => rahulSocket.emit('group:join', { groupId: group.id }, resolve)),
      new Promise((resolve) => amitSocket.emit('group:join', { groupId: group.id }, resolve)),
    ]);
    console.log(`✔ Both joined room group:${group.id}`);

    // 8. Real-time Ephemeral Chat Test
    console.log('\n[7] Testing Real-Time Ephemeral Group Chat...');
    const chatPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Chat message receive timed out')), 4000);
      amitSocket.on('chat:message', (msg) => {
        if (msg.content === 'Hello Amit! Ready to present.') {
          clearTimeout(timeout);
          resolve(msg);
        }
      });
    });

    rahulSocket.emit('chat:send', {
      groupId: group.id,
      content: 'Hello Amit! Ready to present.',
    });

    const receivedChat = await chatPromise;
    console.log(`✔ Amit received instant message: "${receivedChat.content}" from ${receivedChat.sender.username}`);

    // Verify message is in Redis ephemeral list
    const redisMessages = await request('GET', `/api/groups/${group.id}/messages`, null, amitToken);
    if (!redisMessages.data.messages || redisMessages.data.messages.length === 0) {
      throw new Error('Ephemeral messages not found in Redis store');
    }
    console.log(`✔ Verified ephemeral chat retrieved from Redis (total stored: ${redisMessages.data.messages.length})`);

    // 9. Live Whiteboard Presentation Lifecycle
    console.log('\n[8] Testing Live Whiteboard Presentation Mode...');

    // Rahul starts presentation
    const startedPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('presentation:started timed out')), 4000);
      amitSocket.on('presentation:started', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    rahulSocket.emit('presentation:start', { groupId: group.id });
    const startedData = await startedPromise;
    console.log(`✔ Amit received presentation:started notification! Presenter: ${startedData.presenter.username}`);

    // Prevent concurrent presentation
    console.log('\n[9] Testing single-presenter lock (Amit attempts to present while Rahul is live)...');
    const concurrentErrorPromise = new Promise((resolve) => {
      amitSocket.on('presentation:error', (err) => {
        resolve(err);
      });
    });
    amitSocket.emit('presentation:start', { groupId: group.id });
    const lockError = await concurrentErrorPromise;
    console.log(`✔ Single-presenter enforcement passed! Server rejected concurrent presenter: "${lockError.message}"`);

    // Rahul draws and broadcasts whiteboard update
    console.log('\n[10] Rahul broadcasts whiteboard drawing updates...');
    const drawingUpdatePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('whiteboard:updated timed out')), 4000);
      amitSocket.on('whiteboard:updated', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    const testDrawingElements = [
      { id: 'shape1', type: 'rectangle', x: 100, y: 150, width: 200, height: 100 },
      { id: 'shape2', type: 'arrow', x: 300, y: 200, points: [[0, 0], [50, 50]] },
    ];

    rahulSocket.emit('whiteboard:update', {
      groupId: group.id,
      elements: testDrawingElements,
      appState: { viewBackgroundColor: '#ffffff' },
    });

    const receivedDrawing = await drawingUpdatePromise;
    if (receivedDrawing.elements.length !== 2) throw new Error('Elements count mismatch');
    console.log(`✔ Amit received live whiteboard drawing stream (${receivedDrawing.elements.length} elements)!`);

    // Rahul stops presentation
    console.log('\n[11] Rahul stops presentation...');
    const stoppedPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('presentation:stopped timed out')), 4000);
      amitSocket.on('presentation:stopped', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    rahulSocket.emit('presentation:stop', { groupId: group.id });
    const stoppedData = await stoppedPromise;
    console.log(`✔ Amit received presentation:stopped! Group board reverted to private state.`);

    // 10. Disconnect sockets
    rahulSocket.disconnect();
    amitSocket.disconnect();

    console.log('\n======================================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! (11/11)');
    console.log('======================================================\n');
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('\n❌ INTEGRATION TEST FAILED:', err);
  if (server) server.close();
  process.exit(1);
});
