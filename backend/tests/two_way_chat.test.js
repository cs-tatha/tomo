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

async function runTwoWayChatTest() {
  console.log('--- STARTING TWO-WAY FRIEND CHAT INTEGRATION TEST ---');

  // 1. Create User A (Alice) & User B (Bob)
  const aRes = await request('POST', '/api/auth/register', {
    username: `alice_${Date.now()}`,
    email: `alice_${Date.now()}@example.com`,
    password: 'password123',
  });
  const bRes = await request('POST', '/api/auth/register', {
    username: `bob_${Date.now()}`,
    email: `bob_${Date.now()}@example.com`,
    password: 'password123',
  });

  const alice = aRes.data.user;
  const aliceToken = aRes.data.accessToken;
  const bob = bRes.data.user;
  const bobToken = bRes.data.accessToken;

  console.log(`✔ Registered Alice (${alice.username}) and Bob (${bob.username})`);

  // 2. Alice sends friend request to Bob and Bob accepts
  const addRes = await request('POST', '/api/friends', { targetUserId: bob.id }, aliceToken);
  if (addRes.status !== 201) throw new Error(`Add friend failed: ${JSON.stringify(addRes)}`);
  const bobReqs = await request('GET', '/api/friends/requests', null, bobToken);
  const reqId = bobReqs.data.incoming[0].id;
  await request('POST', `/api/friends/requests/${reqId}/accept`, {}, bobToken);
  console.log('✔ Alice sent friend request and Bob accepted (bilateral friendship ensured)');

  // Verify both see each other in their friend lists
  const aliceFriends = await request('GET', '/api/friends', null, aliceToken);
  const bobFriends = await request('GET', '/api/friends', null, bobToken);
  if (!aliceFriends.data.friends.some((f) => f.id === bob.id)) throw new Error('Bob missing from Alice friends');
  if (!bobFriends.data.friends.some((f) => f.id === alice.id)) throw new Error('Alice missing from Bob friends');
  console.log('✔ Both Alice and Bob have each other in confirmed friends list');

  // 3. Connect both to Socket.IO
  const aliceSocket = ClientIO(serverUrl, { auth: { token: aliceToken }, transports: ['websocket'] });
  const bobSocket = ClientIO(serverUrl, { auth: { token: bobToken }, transports: ['websocket'] });

  await Promise.all([
    new Promise((resolve) => aliceSocket.on('connect', resolve)),
    new Promise((resolve) => bobSocket.on('connect', resolve)),
  ]);
  console.log('✔ Both Alice and Bob connected to Socket.IO gateway');

  // Tracking received messages on both clients
  const aliceReceivedDms = [];
  const bobReceivedDms = [];

  aliceSocket.on('dm:message', (msg) => {
    aliceReceivedDms.push(msg);
  });
  bobSocket.on('dm:message', (msg) => {
    bobReceivedDms.push(msg);
  });

  // Tracking typing statuses
  let bobReceivedTyping = null;
  bobSocket.on('dm:typing_status', (data) => {
    bobReceivedTyping = data;
  });

  // 4. Alice tests typing indicator
  aliceSocket.emit('dm:typing', { targetUserId: bob.id, isTyping: true });
  await new Promise((r) => setTimeout(r, 200));
  if (!bobReceivedTyping || !bobReceivedTyping.isTyping) {
    throw new Error('Bob did not receive Alice typing indicator');
  }
  console.log(`✔ Bob received typing status from Alice (${bobReceivedTyping.username})`);

  // 5. Alice sends direct message to Bob with ack callback
  const aliceSendPromise = new Promise((resolve, reject) => {
    aliceSocket.emit(
      'dm:send',
      { targetUserId: bob.id, content: 'Hey Bob! Are you available to review the whiteboard?' },
      (res) => {
        if (res?.success) resolve(res.message);
        else reject(new Error(res?.error || 'Failed to send DM'));
      }
    );
  });

  const ackAliceMsg = await aliceSendPromise;
  console.log(`✔ Alice received immediate delivery ack for message ID: ${ackAliceMsg.id}`);

  // Wait briefly for Socket broadcast
  await new Promise((r) => setTimeout(r, 300));

  if (!bobReceivedDms.some((m) => m.content === 'Hey Bob! Are you available to review the whiteboard?')) {
    throw new Error('Bob did not receive Alice message via dm:message broadcast');
  }
  if (!aliceReceivedDms.some((m) => m.content === 'Hey Bob! Are you available to review the whiteboard?')) {
    throw new Error('Alice did not receive her own message echo via dm:message broadcast');
  }
  console.log('✔ Bob and Alice both received Alice message broadcast in real time');

  // 6. Bob sends direct reply to Alice with ack callback
  const bobSendPromise = new Promise((resolve, reject) => {
    bobSocket.emit(
      'dm:send',
      { targetUserId: alice.id, content: 'Yes Alice! I am looking at the whiteboard now.' },
      (res) => {
        if (res?.success) resolve(res.message);
        else reject(new Error(res?.error || 'Failed to send DM'));
      }
    );
  });

  const ackBobMsg = await bobSendPromise;
  console.log(`✔ Bob received immediate delivery ack for message ID: ${ackBobMsg.id}`);

  await new Promise((r) => setTimeout(r, 300));

  if (!aliceReceivedDms.some((m) => m.content === 'Yes Alice! I am looking at the whiteboard now.')) {
    throw new Error('Alice did not receive Bob reply via dm:message broadcast');
  }
  if (!bobReceivedDms.some((m) => m.content === 'Yes Alice! I am looking at the whiteboard now.')) {
    throw new Error('Bob did not receive his own message echo via dm:message broadcast');
  }
  console.log('✔ Alice and Bob both received Bob reply broadcast in real time');

  // 7. Verify message history retrieval from ephemeral Redis store for both users
  const aliceHistory = await request('GET', `/api/friends/${bob.id}/messages`, null, aliceToken);
  const bobHistory = await request('GET', `/api/friends/${alice.id}/messages`, null, bobToken);

  if (aliceHistory.data.messages.length !== 2) {
    throw new Error(`Expected 2 messages in Alice history, found ${aliceHistory.data.messages.length}`);
  }
  if (bobHistory.data.messages.length !== 2) {
    throw new Error(`Expected 2 messages in Bob history, found ${bobHistory.data.messages.length}`);
  }

  console.log(`✔ Redis ephemeral store has exact 2 messages for both Alice and Bob`);

  aliceSocket.disconnect();
  bobSocket.disconnect();

  console.log('\n======================================================');
  console.log('🎉 TWO-WAY FRIEND CHAT TEST PASSED 100% SUCCESFULLY!');
  console.log('======================================================\n');
}

runTwoWayChatTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
