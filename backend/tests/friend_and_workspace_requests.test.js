import http from "http";
const serverUrl = "http://localhost:5000";

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, serverUrl);
    const options = { method, headers: { "Content-Type": "application/json" } };
    if (token) options.headers["Authorization"] = `Bearer ${token}`;
    const req = http.request(url, options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testRequestsWorkflow() {
  console.log("=== STARTING WORKFLOW TEST: FRIEND REQUESTS, WORKSPACE INVITATIONS, AND WORKSPACE DELETION ===");
  const ts = Date.now();
  const aRes = await request("POST", "/api/auth/register", { username: `alice_${ts}`, email: `alice_${ts}@test.com`, password: "password123" });
  const bRes = await request("POST", "/api/auth/register", { username: `bob_${ts}`, email: `bob_${ts}@test.com`, password: "password123" });
  const alice = aRes.data.user;
  const aliceToken = aRes.data.accessToken;
  const bob = bRes.data.user;
  const bobToken = bRes.data.accessToken;
  console.log(`�� Registered Alice (${alice.username}) and Bob (${bob.username})`);

  // Alice sends friend request to Bob
  const reqRes = await request("POST", "/api/friends/request", { targetUserId: bob.id }, aliceToken);
  if (reqRes.status !== 201) throw new Error(`Friend request failed: ${JSON.stringify(reqRes)}`);
  console.log("�� Alice sent friend request to Bob");

  // Bob sees incoming, Alice sees outgoing
  const bobRequests = await request("GET", "/api/friends/requests", null, bobToken);
  if (bobRequests.data.incoming.length !== 1 || bobRequests.data.incoming[0].sender.id !== alice.id) {
    throw new Error("Bob did not receive incoming friend request from Alice");
  }
  const aliceRequests = await request("GET", "/api/friends/requests", null, aliceToken);
  if (aliceRequests.data.outgoing.length !== 1 || aliceRequests.data.outgoing[0].receiver.id !== bob.id) {
    throw new Error("Alice did not have outgoing friend request to Bob");
  }
  console.log("�� Incoming and outgoing friend requests verified");

  // Verify NOT friends yet
  const bobFriendsBefore = await request("GET", "/api/friends", null, bobToken);
  if (bobFriendsBefore.data.friends.length !== 0) throw new Error("Backend should have 0 mutual friends before accepting");
  console.log("�� Verified no friends before accepting");

  // Bob accepts friend request
  const requestId = bobRequests.data.incoming[0].id;
  const acceptRes = await request("POST", `/api/friends/requests/${requestId}/accept`, {}, bobToken);
  if (acceptRes.status !== 200) throw new Error(`Accepting friend request failed: ${JSON.stringify(acceptRes)}`);
  console.log("�� Bob accepted friend request from Alice");

  // Verify mutual friendship
  const bobFriendsAfter = await request("GET", "/api/friends", null, bobToken);
  const aliceFriendsAfter = await request("GET", "/api/friends", null, aliceToken);
  if (bobFriendsAfter.data.friends.length !== 1 || aliceFriendsAfter.data.friends.length !== 1) {
    throw new Error("Bilateral friendship was not created upon acceptance");
  }
  console.log("�� Both Alice and Bob now have each other in confirmed friends list");

  // Workspace Invitation Flow: Alice creates workspace
  const createGroupRes = await request("POST", "/api/groups", { name: "Alpha Team Workspace", description: "Collaborative workspace" }, aliceToken);
  const group = createGroupRes.data.group;
  console.log(`�� Alice created workspace "${group.name}" (members: ${group.members.length})`);

  // Alice invites Bob
  const inviteRes = await request("POST", `/api/groups/${group.id}/invitations`, { userId: bob.id, role: "MEMBER" }, aliceToken);
  if (inviteRes.status !== 201) throw new Error(`Workspace invitation failed: ${JSON.stringify(inviteRes)}`);
  console.log("�� Alice sent workspace invitation to Bob");

  // Bob sees invitation, cannot access workspace yet
  const bobInvitations = await request("GET", "/api/groups/invitations/my", null, bobToken);
  if (bobInvitations.data.invitations.length !== 1 || bobInvitations.data.invitations[0].groupId !== group.id) {
    throw new Error("Bob did not receive workspace invitation");
  }
  const bobAccessBefore = await request("GET", `/api/groups/${group.id}`, null, bobToken);
  if (bobAccessBefore.status === 200) throw new Error("Bob should not be able to access workspace before accepting");
  console.log("�� Verified Bob is not a group member before acceptance");

  // Bob accepts workspace invitation
  const inviteId = bobInvitations.data.invitations[0].id;
  const acceptInviteRes = await request("POST", `/api/groups/invitations/${inviteId}/accept`, {}, bobToken);
  if (acceptInviteRes.status !== 200) throw new Error(`Accepting workspace invitation failed: ${JSON.stringify(acceptInviteRes)}`);
  console.log("�� Bob accepted workspace invitation");

  // Verify Bob can now access workspace
  const bobGroupAccess = await request("GET", `/api/groups/${group.id}`, null, bobToken);
  if (bobGroupAccess.status !== 200) throw new Error("Bob cannot access workspace after accepting");
  if (bobGroupAccess.data.group.members.length !== 2) throw new Error("Group members should be 2");
  console.log("�� Bob is now an active member in the workspace with 2 members");

  // Workspace deletion: Non-owner (should fail)
  const bobDelete = await request("DELETE", `/api/groups/${group.id}`, null, bobToken);
  if (bobDelete.status === 200) throw new Error("Non-owner should not be able to delete workspace");
  console.log("�� Non-owner workspace deletion correctly denied");

  // Alice (deletes workspace)
  const aliceDelete = await request("DELETE", `/api/groups/${group.id}`, null, aliceToken);
  if (aliceDelete.status !== 200) throw new Error(`Workspace deletion failed: ${JSON.stringify(aliceDelete)}`);
  console.log("�� Alice (Owner) successfully deleted the workspace");

  // Verify group no longer accessible
  const aliceAccessAfter = await request("GET", `/api/groups/${group.id}`, null, aliceToken);
  if (aliceAccessAfter.status === 200) throw new Error("Deleted workspace should no longer be accessible");
  console.log("�� Deleted workspace is no longer accessible");

  console.log("===============================================================");
  console.log("🎉 ALL FRIEND REQUEST, WORKSPACE INVITATION, AND DELETION TESTS PASSED 100%!");
  console.log("==============================================================");
}

testRequestsWorkflow().catch((err) => {
  console.error("❇ Test failed:", err);
  process.exit(1);
});