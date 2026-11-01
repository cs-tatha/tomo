import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { OnlineIndicator } from '../components/presence/OnlineIndicator';
import { Modal } from '../components/common/Modal';
import { Search, Users, Shield, Calendar, UserPlus, Check, Sparkles, UserCheck, Clock } from 'lucide-react';

export const UserDirectoryPage = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { isUserOnline } = useSocket();

  // Friend Add State
  const [addedFriends, setAddedFriends] = useState(new Set());
  const [sentRequests, setSentRequests] = useState(new Set());
  const [incomingRequests, setIncomingRequests] = useState({});
  const [addingFriendId, setAddingFriendId] = useState(null);

  // Invite Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedUserToInvite, setSelectedUserToInvite] = useState(null);
  const [myGroups, setMyGroups] = useState([]);
  const [targetGroupId, setTargetGroupId] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');

  // Fetch confirmed friends and pending requests on mount
  const loadRelationshipData = async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        api.get('/friends'),
        api.get('/friends/requests'),
      ]);
      if (friendsRes.data?.friends) {
        setAddedFriends(new Set(friendsRes.data.friends.map((f) => f.id)));
      }
      if (requestsRes.data) {
        setSentRequests(new Set((requestsRes.data.outgoing || []).map((r) => r.receiver?.id || r.receiverId)));
        const incMap = {};
        (requestsRes.data.incoming || []).forEach((r) => {
          const senderId = r.sender?.id || r.senderId;
          incMap[senderId] = r.id;
        });
        setIncomingRequests(incMap);
      }
    } catch (e) {
      console.error('Failed to load relationships:', e);
    }
  };

  useEffect(() => {
    loadRelationshipData();
  }, []);

  const handleSendFriendRequest = async (targetUser) => {
    setAddingFriendId(targetUser.id);
    try {
      const res = await api.post('/friends/request', { targetUserId: targetUser.id });
      if (res.data?.status === 'ACCEPTED') {
        setAddedFriends((prev) => new Set(prev).add(targetUser.id));
      } else {
        setSentRequests((prev) => new Set(prev).add(targetUser.id));
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to send friend request');
    } finally {
      setAddingFriendId(null);
    }
  };

  const handleAcceptRequestFromUser = async (targetUserId) => {
    const requestId = incomingRequests[targetUserId];
    if (!requestId) return;
    setAddingFriendId(targetUserId);
    try {
      await api.post(`/friends/requests/${requestId}/accept`);
      setAddedFriends((prev) => new Set(prev).add(targetUserId));
      setIncomingRequests((prev) => {
        const next = { ...prev };
        delete next[targetUserId];
        return next;
      });
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to accept request');
    } finally {
      setAddingFriendId(null);
    }
  };

  const fetchUsers = async (query = '') => {
    const trimmed = query.trim();
    if (!trimmed) {
      setUsers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/users?search=${encodeURIComponent(trimmed)}`);
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to search users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Load user's groups when opening invite modal
  const handleOpenInvite = async (user) => {
    setSelectedUserToInvite(user);
    setInviteSuccess('');
    setInviteError('');
    setInviteModalOpen(true);

    try {
      const res = await api.get('/groups');
      const adminGroups = (res.data.groups || []).filter(
        (g) => g.currentUserRole === 'OWNER' || g.currentUserRole === 'ADMIN'
      );
      setMyGroups(adminGroups);
      if (adminGroups.length > 0) {
        setTargetGroupId(adminGroups[0].id);
      }
    } catch (err) {
      console.error('Failed to load my groups:', err);
    }
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!targetGroupId || !selectedUserToInvite) return;

    setInviteLoading(true);
    setInviteError('');
    setInviteSuccess('');

    try {
      await api.post(`/groups/${targetGroupId}/invitations`, {
        userId: selectedUserToInvite.id,
        role: inviteRole,
      });
      setInviteSuccess(`Successfully sent workspace invitation to ${selectedUserToInvite.username}! They will join once accepted.`);
      setTimeout(() => {
        setInviteModalOpen(false);
      }, 2000);
    } catch (err) {
      setInviteError(err.response?.data?.message || err.message || 'Failed to invite to workspace');
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Find Users & Teammates</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Search registered users by username or email to connect, view presence, and invite them to workspaces.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type exact username or email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
          />
        </div>
      </div>

      {!search.trim() ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Search to Discover Users</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            To ensure privacy, registered users are not listed publicly by default. Enter a username or email in the search bar above to find collaborators and invite them to your workspace.
          </p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">No users found matching &ldquo;{search}&rdquo;</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Make sure the username or email is spelled correctly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => {
            const isOnline = isUserOnline(u.id);
            return (
              <div
                key={u.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm">
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-800 text-sm">{u.username}</h3>
                          {u.isSelf && (
                            <span className="text-[10px] font-semibold uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{u.email}</p>
                      </div>
                    </div>

                    <OnlineIndicator isOnline={isOnline} showText size="sm" />
                  </div>

                  {/* Group Memberships */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Workspaces ({u.memberships?.length || 0})
                    </span>
                    {u.memberships && u.memberships.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {u.memberships.map((m) => (
                          <span
                            key={m.groupId}
                            className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg font-medium"
                          >
                            <span>{m.group.name}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No public workspaces</p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Joined {new Date(u.createdAt).toLocaleDateString()}
                  </span>

                  {!u.isSelf && (
                    <div className="flex items-center gap-2">
                      {addedFriends.has(u.id) ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 text-blue-700 border border-blue-200 text-xs font-semibold">
                          <Check className="w-3.5 h-3.5 text-blue-600" />
                          <span>Friends</span>
                        </span>
                      ) : incomingRequests[u.id] ? (
                        <button
                          onClick={() => handleAcceptRequestFromUser(u.id)}
                          disabled={addingFriendId === u.id}
                          type="button"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept Request</span>
                        </button>
                      ) : sentRequests.has(u.id) ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Request Sent</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSendFriendRequest(u)}
                          disabled={addingFriendId === u.id}
                          type="button"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add Friend</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenInvite(u)}
                        type="button"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Invite</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite To Workspace Modal */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title={`Invite ${selectedUserToInvite?.username || 'User'} to Workspace`}
      >
        {inviteError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs">
            {inviteError}
          </div>
        )}

        {inviteSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{inviteSuccess}</span>
          </div>
        )}

        {myGroups.length === 0 ? (
          <div className="text-center py-6 text-slate-400 space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No managed workspace groups</p>
            <p className="text-xs">
              You must be an Owner or Admin of a group to invite other members. Create a group first from your Dashboard.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendInvite} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Select Workspace Group *
              </label>
              <select
                value={targetGroupId}
                onChange={(e) => setTargetGroupId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              >
                {myGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.currentUserRole})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Role in Group
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviteLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm cursor-pointer shadow-sm shadow-blue-600/10"
              >
                {inviteLoading ? 'Inviting...' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
