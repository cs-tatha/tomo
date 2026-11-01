import http from 'http';
import { io as ClientIO } from 'socket.io-client';

const serverUrl = 'http://localhost:5000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, serverUrl);
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testFriendsAndDirectChat() {
  console.log('--- TESTING FRIENDS, ONLINE STATUS & DIRECT CHAT ---');

  // 1. Create two users: Sarah and David
  const sarahPayload = {
    username: `sarah_${Date.now()}`,
    email: `sarah_${Date.now()}@example.com`,
    password: 'password123',
  };
  const sarahRes = await request('POST', '/api/auth/register', sarahPayload);
  const sarah = sarahRes.data.user;
  const sarahToken = sarahRes.data.accessToken;

  const davidPayload = {
    username: `david_${Date.now()}`,
    email: `david_${Date.now()}@example.com`,
    password: 'password123',
  };
  const davidRes = await request('POST', '/api/auth/register', davidPayload);
  const david = davidRes.data.user;
  const davidToken = davidRes.data.accessToken;

  console.log(`✔ Created Sarah (${sarah.username}) and David (${david.username})`);

  // 2. Connect David to Socket.IO so he is online
  const davidSocket = ClientIO(serverUrl, {
    auth: { token: davidToken },
    transports: ['websocket'],
  });
  await new Promise((resolve) => davidSocket.on('connect', resolve));
  console.log(`✔ David connected to Socket.IO gateway (now online)`);

  // 3. Sarah searches for David
  const searchRes = await request('GET', `/api/users?search=${david.username}`, null, sarahToken);
  if (searchRes.data.users.length === 0) throw new Error('Search failed to find David');
  console.log(`✔ Sarah searched and found David (${searchRes.data.users[0].username})`);

  // 4. Sarah adds David as a friend
  const addFriendRes = await request('POST', '/api/friends', { targetUserId: david.id }, sarahToken);
  if (addFriendRes.status !== 201) throw new Error('Add friend failed');
  console.log(`✔ Sarah added David as a friend`);

  // 5. Sarah gets her friends list and checks online status
  const sarahFriendsRes = await request('GET', '/api/friends', null, sarahToken);
  const davidFriendObj = sarahFriendsRes.data.friends.find((f) => f.id === david.id);
  if (!davidFriendObj) throw new Error('David not found in Sarah friends list');
  if (!davidFriendObj.isOnline) throw new Error('David should be marked online');
  console.log(`✔ Sarah sees David in friend list with isOnline = ${davidFriendObj.isOnline}`);

  // 6. Connect Sarah to Socket.IO and test Direct Messaging
  const sarahSocket = ClientIO(serverUrl, {
    auth: { token: sarahToken },
    transports: ['websocket'],
  });
  await new Promise((resolve) => sarahSocket.on('connect', resolve));

  const dmPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Direct message timed out')), 4000);
    davidSocket.on('dm:message', (msg) => {
      if (msg.content === 'Hey David, want to collaborate on the whiteboard?') {
        clearTimeout(timeout);
        resolve(msg);
      }
    });
  });

  // Sarah sends DM to David
  sarahSocket.emit('dm:send', {
    targetUserId: david.id,
    content: 'Hey David, want to collaborate on the whiteboard?',
  });

  const receivedDm = await dmPromise;
  console.log(`✔ David received real-time DM from ${receivedDm.sender.username}: "${receivedDm.content}"`);

  // 7. Verify message retrieved from Redis ephemeral store
  const dmHistoryRes = await request('GET', `/api/friends/${david.id}/messages`, null, sarahToken);
  if (!dmHistoryRes.data.messages || dmHistoryRes.data.messages.length === 0) {
    throw new Error('DM history not found in Redis store');
  }
  console.log(`✔ Ephemeral DM retrieved from Redis store (count = ${dmHistoryRes.data.messages.length})`);

  // Clean up
  sarahSocket.disconnect();
  davidSocket.disconnect();

  console.log('\n======================================================');
  console.log('🎉 FRIENDS & DIRECT CHAT TEST PASSED COMPLETELY!');
  console.log('======================================================\n');
}

testFriendsAndDirectChat().catch((e) => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
