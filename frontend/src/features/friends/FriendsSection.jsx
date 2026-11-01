import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { OnlineIndicator } from '../../components/presence/OnlineIndicator';
import { DirectChatModal } from '../chat/DirectChatModal';
import { Modal } from '../../components/common/Modal';
import { Users, MessageCircle, UserPlus, Trash2, Check, ArrowRight, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export const FriendsSection = ({ onFriendsUpdated }) => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const {
    isUserOnline,
    unreadDms,
    incomingAlert,
    markDmRead,
    clearIncomingAlert,
    friendRequests,
    acceptFriendRequest,
    rejectFriendRequest,
  } = useSocket();

  // Active Direct Chat Modal State
  const [activeChatFriend, setActiveChatFriend] = useState(null);

  // Invite to Workspace Modal State
  const [activeInviteFriend, setActiveInviteFriend] = useState(null);
  const [myGroups, setMyGroups] = useState([]);
  const [targetGroupId, setTargetGroupId] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const res = await api.get('/friends');
      const list = res.data.friends || [];
      setFriends(list);
      if (onFriendsUpdated) onFriendsUpdated(list);
    } catch (err) {
      console.error('Failed to load friends:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const handleOpenInvite = async (friend) => {
    setActiveInviteFriend(friend);
    setInviteSuccess('');
    setInviteError('');

    try {
      const res = await api.get('/groups');
      const adminGroups = (res.data.groups || []).filter(
        (g) => g.currentUserRole === 'OWNER' || g.currentUserRole === 'ADMIN'
      );
      setMyGroups(adminGroups);
      if (adminGroups.length > 0) setTargetGroupId(adminGroups[0].id);
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!targetGroupId || !activeInviteFriend) return;

    setInviteLoading(true);
    setInviteError('');
    setInviteSuccess('');

    try {
      await api.post(`/groups/${targetGroupId}/invitations`, {
        userId: activeInviteFriend.id,
        role: inviteRole,
      });
      setInviteSuccess(`Invitation sent to ${activeInviteFriend.username}! They will join once accepted.`);
      setTimeout(() => setActiveInviteFriend(null), 2000);
    } catch (err) {
      setInviteError(err.response?.data?.message || err.message || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    setActionLoadingId(requestId);
    try {
      await acceptFriendRequest(requestId);
      await fetchFriends();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to accept request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectRequest = async (requestId) => {
    setActionLoadingId(requestId);
    try {
      await rejectFriendRequest(requestId);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to decline request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm('Remove this friend?')) return;
    try {
      await api.delete(`/friends/${friendId}`);
      setFriends((prev) => {
        const next = prev.filter((f) => f.id !== friendId);
        if (onFriendsUpdated) onFriendsUpdated(next);
        return next;
      });
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to remove');
    }
  };

  const filteredFriends = friends.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return f.username.toLowerCase().includes(q) || f.email.toLowerCase().includes(q);
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4">
      {/* Real-time incoming DM banner alert */}
      {incomingAlert && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="truncate">
              <span className="font-bold">{incomingAlert.username}:</span> "{incomingAlert.content}"
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {incomingAlert.type === 'dm' && (
              <button
                onClick={() => {
                  const f = friends.find((item) => String(item.id) === String(incomingAlert.friendId)) || {
                    id: incomingAlert.friendId,
                    username: incomingAlert.username,
                  };
                  setActiveChatFriend(f);
                  if (markDmRead) markDmRead(incomingAlert.friendId);
                }}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Reply
              </button>
            )}
            <button
              onClick={clearIncomingAlert}
              className="text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Pending Friend Requests Card */}
      {friendRequests && friendRequests.length > 0 && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-blue-600" />
              <span>Pending Requests ({friendRequests.length})</span>
            </h3>
            <span className="text-[10px] text-blue-700 font-medium">Needs response</span>
          </div>

          <div className="divide-y divide-blue-100/70">
            {friendRequests.map((req) => (
              <div key={req.id} className="py-2 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    {req.sender?.username?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{req.sender?.username}</p>
                    <p className="text-[10px] text-slate-500 truncate">{req.sender?.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    disabled={actionLoadingId === req.id}
                    onClick={() => handleAcceptRequest(req.id)}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>Accept</span>
                  </button>
                  <button
                    disabled={actionLoadingId === req.id}
                    onClick={() => handleRejectRequest(req.id)}
                    className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                    title="Decline"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header & Search */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-800">Direct Friends ({friends.length})</h2>
          </div>
          <Link
            to="/directory"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>Find users</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {friends.length > 2 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search friends..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : friends.length === 0 ? (
        <div className="text-center py-6 px-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 space-y-2">
          <p className="text-xs font-semibold text-slate-700">No friends added yet</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Search for registered users by username or email to add them to your friends list.
          </p>
          <Link
            to="/directory"
            className="inline-block mt-1 text-xs text-blue-600 font-bold hover:underline"
          >
            + Search Users
          </Link>
        </div>
      ) : filteredFriends.length === 0 ? (
        <div className="text-center py-5 text-slate-400 text-xs">
          No friends matching "{searchQuery}"
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto pr-1">
          {filteredFriends.map((f) => {
            const online = isUserOnline(f.id);
            const unreadCount = unreadDms?.[f.id] || 0;
            return (
              <div
                key={f.id}
                className="py-2.5 flex items-center justify-between gap-2.5 group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                      {f.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5">
                      <OnlineIndicator isOnline={online} size="xs" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-slate-800 text-xs truncate max-w-[95px] sm:max-w-[120px]">{f.username}</p>
                      <OnlineIndicator isOnline={online} size="xs" />
                    </div>
                    <p className="text-[11px] text-slate-400 truncate max-w-[105px] sm:max-w-[130px]">{f.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setActiveChatFriend(f);
                      if (markDmRead) markDmRead(f.id);
                    }}
                    type="button"
                    title="Direct Chat"
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer ${
                      unreadCount > 0
                        ? 'bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-400/50'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Chat</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-white text-blue-800 text-[10px] font-bold">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleOpenInvite(f)}
                    type="button"
                    title="Invite to Workspace"
                    className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleRemoveFriend(f.id)}
                    type="button"
                    title="Remove Friend"
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Direct 1-on-1 Chat Modal */}
      {activeChatFriend && (
        <DirectChatModal
          isOpen={!!activeChatFriend}
          onClose={() => setActiveChatFriend(null)}
          friend={activeChatFriend}
        />
      )}

      {/* Invite Friend to Workspace Modal */}
      {activeInviteFriend && (
        <Modal
          isOpen={!!activeInviteFriend}
          onClose={() => setActiveInviteFriend(null)}
          title={`Invite ${activeInviteFriend.username} to Workspace`}
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
                You must be an Owner or Admin of a group to invite other members.
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
                  onClick={() => setActiveInviteFriend(null)}
                  className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm cursor-pointer shadow-xs"
                >
                  {inviteLoading ? 'Inviting...' : 'Invite to Workspace'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};
