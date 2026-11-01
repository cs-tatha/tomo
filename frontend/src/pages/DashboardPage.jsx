import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { OnlineIndicator } from '../components/presence/OnlineIndicator';
import { Modal } from '../components/common/Modal';
import { AddFriendModal } from '../features/friends/AddFriendModal';
import { DirectChatModal } from '../features/chat/DirectChatModal';
import { InvitationsModal } from '../features/invitations/InvitationsModal';
import {
  UserPlus,
  Plus,
  Briefcase,
  Users,
  MessageCircle,
  ArrowRight,
  Trash2,
  Bell,
  Sparkles,
  Search,
  ExternalLink,
} from 'lucide-react';

export const DashboardPage = () => {
  const { user } = useAuth();
  const {
    isUserOnline,
    workspaceInvitations,
    friendRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    acceptWorkspaceInvite,
    rejectWorkspaceInvite,
  } = useSocket();

  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active view: 'both' | 'workspaces' | 'friends'
  const [activeView, setActiveView] = useState('both');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [activeChatFriend, setActiveChatFriend] = useState(null);
  const [isInvitesOpen, setIsInvitesOpen] = useState(false);

  // Create Workspace Form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Delete Workspace
  const [deletingGroup, setDeletingGroup] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchDashboardData = async () => {
    try {
      const [groupsRes, friendsRes] = await Promise.all([
        api.get('/groups'),
        api.get('/friends'),
      ]);
      setGroups(groupsRes.data.groups || []);
      setFriends(friendsRes.data.friends || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);

    try {
      const res = await api.post('/groups', {
        name: newGroupName,
        description: newGroupDesc,
      });
      if (res.data?.success) {
        setIsCreateGroupOpen(false);
        setNewGroupName('');
        setNewGroupDesc('');
        fetchDashboardData();
      }
    } catch (err) {
      setCreateError(err.response?.data?.message || err.message || 'Failed to create workspace');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deletingGroup) return;
    setDeleteError('');
    setDeleteLoading(true);

    try {
      await api.delete(`/groups/${deletingGroup.id}`);
      setDeletingGroup(null);
      await fetchDashboardData();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message || 'Failed to delete workspace');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm('Remove this friend from your friend list?')) return;
    try {
      await api.delete(`/friends/${friendId}`);
      await fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to remove friend');
    }
  };

  const totalNotifications = (friendRequests?.length || 0) + (workspaceInvitations?.length || 0);

  // Filter items if search query is provided
  const query = searchQuery.trim().toLowerCase();
  const filteredGroups = groups.filter(
    (g) => !query || g.name.toLowerCase().includes(query) || (g.description && g.description.toLowerCase().includes(query))
  );
  const filteredFriends = friends.filter(
    (f) => !query || f.username.toLowerCase().includes(query) || f.email.toLowerCase().includes(query)
  );

  return (
    <div className="w-full px-4 sm:px-6 py-4">
      <div className="flex flex-col md:flex-row items-start gap-6 lg:gap-10 min-h-[calc(100vh-6rem)]">
        {/* ================= LEFT FLOATING ACTIONS: MINIMALIST & SCATTERED FULL HEIGHT ================= */}
        <aside className="w-full md:w-44 lg:w-48 shrink-0 md:sticky md:top-20 md:h-[calc(100vh-7rem)] flex md:flex-col justify-around items-start py-4">
          {/* Button 1: Add Friend */}
          <button
            type="button"
            onClick={() => setIsAddFriendOpen(true)}
            className="group flex items-center gap-3 text-left cursor-pointer transition-all duration-300 py-2 focus:outline-none"
            title="Add Friend - Search & connect"
          >
            <div className="text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-115 transition-all duration-300 shrink-0">
              <UserPlus className="w-7 h-7 stroke-[1.6]" />
            </div>
            <div className="hidden sm:block min-w-0">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Add Friend
              </span>
              <span className="block text-[11px] text-slate-400 dark:text-slate-500 truncate">
                Search & connect
              </span>
            </div>
          </button>

          {/* Button 2: Create Workspace */}
          <button
            type="button"
            onClick={() => setIsCreateGroupOpen(true)}
            className="group flex items-center gap-3 text-left cursor-pointer transition-all duration-300 py-2 focus:outline-none"
            title="Create Workspace - Room & whiteboard"
          >
            <div className="text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-115 transition-all duration-300 shrink-0">
              <Plus className="w-7 h-7 stroke-[1.8]" />
            </div>
            <div className="hidden sm:block min-w-0">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Create Workspace
              </span>
              <span className="block text-[11px] text-slate-400 dark:text-slate-500 truncate">
                Room & whiteboard
              </span>
            </div>
          </button>

          {/* Button 3: See All Workspaces */}
          <button
            type="button"
            onClick={() => setActiveView((prev) => (prev === 'workspaces' ? 'both' : 'workspaces'))}
            className="group relative flex items-center gap-3 text-left cursor-pointer transition-all duration-300 py-2 focus:outline-none"
            title="All Workspaces - Click to toggle view"
          >
            {activeView === 'workspaces' && (
              <span className="hidden md:block absolute -left-2.5 top-1/2 -translate-y-1/2 w-1 h-7 rounded-full bg-blue-600 dark:bg-blue-400 transition-all" />
            )}
            <div
              className={`shrink-0 transition-all duration-300 ${
                activeView === 'workspaces'
                  ? 'text-blue-600 dark:text-blue-400 scale-110'
                  : 'text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-115'
              }`}
            >
              <Briefcase className="w-7 h-7 stroke-[1.6]" />
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={`block text-xs font-semibold transition-colors ${
                    activeView === 'workspaces'
                      ? 'text-blue-600 dark:text-blue-400 font-bold'
                      : 'text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                  }`}
                >
                  All Workspaces
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100/70 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {groups.length}
                </span>
              </div>
              <span className="block text-[11px] text-slate-400 dark:text-slate-500 truncate">
                Visit & collaborate
              </span>
            </div>
          </button>

          {/* Button 4: See All Friends */}
          <button
            type="button"
            onClick={() => setActiveView((prev) => (prev === 'friends' ? 'both' : 'friends'))}
            className="group relative flex items-center gap-3 text-left cursor-pointer transition-all duration-300 py-2 focus:outline-none"
            title="All Friends - Click to toggle view"
          >
            {activeView === 'friends' && (
              <span className="hidden md:block absolute -left-2.5 top-1/2 -translate-y-1/2 w-1 h-7 rounded-full bg-blue-600 dark:bg-blue-400 transition-all" />
            )}
            <div
              className={`shrink-0 transition-all duration-300 ${
                activeView === 'friends'
                  ? 'text-blue-600 dark:text-blue-400 scale-110'
                  : 'text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-115'
              }`}
            >
              <Users className="w-7 h-7 stroke-[1.6]" />
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={`block text-xs font-semibold transition-colors ${
                    activeView === 'friends'
                      ? 'text-blue-600 dark:text-blue-400 font-bold'
                      : 'text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                  }`}
                >
                  All Friends
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100/70 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {friends.length}
                </span>
              </div>
              <span className="block text-[11px] text-slate-400 dark:text-slate-500 truncate">
                Direct message friends
              </span>
            </div>
          </button>
        </aside>

        {/* ================= CENTER MAIN CONTENT ================= */}
        <main className="flex-1 min-w-0 max-w-5xl xl:max-w-6xl mx-auto w-full space-y-6">
          {/* Top Search Filter */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workspaces or friends..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs transition-all"
            />
          </div>

          {/* Main Content: Workspaces & Friends Views */}
          <div
            className={`grid gap-6 ${
              activeView === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
            }`}
          >
        {/* WORKSPACES SECTION */}
        {(activeView === 'both' || activeView === 'workspaces') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Workspaces ({filteredGroups.length})</span>
              </h2>
            </div>

            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 text-slate-400 space-y-1.5">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {searchQuery ? 'No matching workspaces' : 'No workspaces yet'}
                </p>
                <p className="text-xs max-w-xs mx-auto">
                  {searchQuery ? 'Try clearing your search query.' : 'Use the Create Workspace button on the left to start a room.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredGroups.map((group) => {
                  const isOwner = group.currentUserRole === 'OWNER';
                  return (
                    <div
                      key={group.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500/70 shadow-xs hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs shadow-blue-500/20">
                          {group.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">
                              {group.name}
                            </h3>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                isOwner
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {group.currentUserRole || 'MEMBER'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-sm mt-0.5">
                            {group.description || 'No description provided'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => setDeletingGroup(group)}
                            title="Delete workspace"
                            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <Link
                          to={`/groups/${group.id}`}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <span>Visit Workspace</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* FRIENDS SECTION */}
        {(activeView === 'both' || activeView === 'friends') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Friends ({filteredFriends.length})</span>
              </h2>
            </div>

            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 text-slate-400 space-y-1.5">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {searchQuery ? 'No matching friends' : 'No friends yet'}
                </p>
                <p className="text-xs max-w-xs mx-auto">
                  {searchQuery ? 'Try clearing your search query.' : 'Use the Add Friend button on the left to connect with teammates.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredFriends.map((friend) => {
                  const online = isUserOnline(friend.id);
                  return (
                    <div
                      key={friend.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500/70 shadow-xs hover:shadow-sm transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm flex items-center justify-center">
                            {friend.username.slice(0, 2).toUpperCase()}
                          </div>
                          <span
                            className={`w-2.5 h-2.5 rounded-full absolute -top-0.5 -right-0.5 border-2 border-white dark:border-slate-900 ${
                              online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">
                              {friend.username}
                            </h3>
                            <OnlineIndicator isOnline={online} showText={false} size="xs" />
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-sm mt-0.5">
                            {friend.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveChatFriend(friend)}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Start Chat</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
          </div>
        </main>
      </div>

      {/* MODAL 1: Add Friend Modal */}
      <AddFriendModal
        isOpen={isAddFriendOpen}
        onClose={() => setIsAddFriendOpen(false)}
        onFriendAdded={fetchDashboardData}
      />

      {/* MODAL 2: Create Workspace Modal */}
      <Modal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        title="Create New Workspace"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateGroup} className="space-y-5">
          {createError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {createError}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Workspace Name
            </label>
            <input
              type="text"
              required
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g. Design Architecture Room"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
              Give your workspace a clear, recognizable name for your team members.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              value={newGroupDesc}
              onChange={(e) => setNewGroupDesc(e.target.value)}
              rows={4}
              placeholder="What will your team collaborate on in this space? (e.g. sprint planning, UI sketches, whiteboard diagrams)"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setIsCreateGroupOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading || !newGroupName.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              {createLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Workspace</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Direct Chat Modal */}
      {activeChatFriend && (
        <DirectChatModal
          isOpen={!!activeChatFriend}
          onClose={() => setActiveChatFriend(null)}
          friend={activeChatFriend}
        />
      )}

      {/* MODAL 4: Delete Workspace Modal */}
      <Modal
        isOpen={!!deletingGroup}
        onClose={() => setDeletingGroup(null)}
        title="Delete Workspace"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Are you sure you want to permanently delete{' '}
            <strong className="text-slate-900 dark:text-white font-bold">{deletingGroup?.name}</strong>?
            This will permanently remove the room, all members, and active whiteboard presentations.
          </p>

          {deleteError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {deleteError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeletingGroup(null)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteGroup}
              disabled={deleteLoading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 5: Invitations & Requests Modal */}
      <InvitationsModal
        isOpen={isInvitesOpen}
        onClose={() => setIsInvitesOpen(false)}
        friendRequests={friendRequests}
        workspaceInvitations={workspaceInvitations}
        onAcceptFriendRequest={async (id) => {
          await acceptFriendRequest(id);
          fetchDashboardData();
        }}
        onRejectFriendRequest={rejectFriendRequest}
        onAcceptWorkspaceInvite={async (id) => {
          await acceptWorkspaceInvite(id);
          fetchDashboardData();
        }}
        onRejectWorkspaceInvite={rejectWorkspaceInvite}
      />
    </div>
  );
};
