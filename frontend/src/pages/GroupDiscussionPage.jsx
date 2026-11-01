import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { OnlineIndicator } from '../components/presence/OnlineIndicator';
import { Modal } from '../components/common/Modal';
import { GroupChat } from '../features/chat/GroupChat';
import { IndividualWhiteboard } from '../features/whiteboard/IndividualWhiteboard';
import { LivePresentationViewer } from '../features/presentation/LivePresentationViewer';
import {
  Users,
  Radio,
  Play,
  Square,
  UserPlus,
  LogOut,
  Shield,
  MessageSquare,
  PenTool,
  Check,
  AlertCircle,
  Eye,
  Trash2,
} from 'lucide-react';

export const GroupDiscussionPage = () => {
  const { id: groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, isUserOnline } = useSocket();

  // Group Details
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active Presentation State
  const [activePresentation, setActivePresentation] = useState(null);
  const [liveElements, setLiveElements] = useState([]);
  const [liveAppState, setLiveAppState] = useState({});
  const [presentationError, setPresentationError] = useState('');

  // Ephemeral Chat State
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());

  // Center View Toggle ('chat' | 'whiteboard' | 'presentation')
  const [centerTab, setCenterTab] = useState('chat');

  // Add Member Modal State (Search-based discovery)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');

  // Fetch initial group data and ephemeral messages
  const loadGroupData = async () => {
    try {
      setLoading(true);
      const [groupRes, messagesRes] = await Promise.all([
        api.get(`/groups/${groupId}`),
        api.get(`/groups/${groupId}/messages`),
      ]);
      setGroup(groupRes.data.group);
      setMessages(messagesRes.data.messages || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load group');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroupData();
  }, [groupId]);

  // Socket.IO Room & Event Wiring
  useEffect(() => {
    if (!socket || !groupId) return;

    // Join Group Room
    socket.emit('group:join', { groupId }, (res) => {
      if (res?.success && res.activePresentation) {
        setActivePresentation(res.activePresentation);
      }
    });

    // Chat Message Event
    const handleChatMessage = (message) => {
      if (message.groupId === groupId) {
        setMessages((prev) => [...prev, message]);
      }
    };

    // Typing Status Event
    const handleTypingStatus = ({ groupId: incomingGroupId, username, isTyping }) => {
      if (incomingGroupId !== groupId) return;
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(username);
        else next.delete(username);
        return next;
      });
    };

    // Presentation Started Event
    const handlePresentationStarted = (data) => {
      if (data.groupId === groupId) {
        setActivePresentation(data);
        setPresentationError('');
      }
    };

    // Presentation Stopped Event
    const handlePresentationStopped = (data) => {
      if (data.groupId === groupId) {
        setActivePresentation(null);
        setLiveElements([]);
        setLiveAppState({});
        setCenterTab((prev) => (prev === 'presentation' ? 'whiteboard' : prev));
      }
    };

    // Whiteboard Update Event (Received by viewers)
    const handleWhiteboardUpdated = (data) => {
      if (data.groupId === groupId) {
        setLiveElements(data.elements || []);
        if (data.appState) setLiveAppState(data.appState);
      }
    };

    // Presentation Error Event
    const handlePresentationError = ({ message }) => {
      setPresentationError(message);
    };

    // Workspace Deleted Event
    const handleWorkspaceDeleted = (data) => {
      if (data.groupId === groupId) {
        alert(`This workspace ("${data.groupName || 'Discussion Room'}") has been permanently deleted by its owner.`);
        navigate('/dashboard');
      }
    };

    socket.on('chat:message', handleChatMessage);
    socket.on('chat:typing_status', handleTypingStatus);
    socket.on('presentation:started', handlePresentationStarted);
    socket.on('presentation:stopped', handlePresentationStopped);
    socket.on('whiteboard:updated', handleWhiteboardUpdated);
    socket.on('presentation:error', handlePresentationError);
    socket.on('workspace:deleted', handleWorkspaceDeleted);

    return () => {
      socket.emit('group:leave', { groupId });
      socket.off('chat:message', handleChatMessage);
      socket.off('chat:typing_status', handleTypingStatus);
      socket.off('presentation:started', handlePresentationStarted);
      socket.off('presentation:stopped', handlePresentationStopped);
      socket.off('whiteboard:updated', handleWhiteboardUpdated);
      socket.off('presentation:error', handlePresentationError);
      socket.off('workspace:deleted', handleWorkspaceDeleted);
    };
  }, [socket, groupId]);

  // Chat actions
  const handleSendMessage = (content) => {
    if (!socket) return;
    socket.emit('chat:send', { groupId, content });
  };

  const handleTyping = (isTyping) => {
    if (!socket) return;
    socket.emit('chat:typing', { groupId, isTyping });
  };

  // Presentation actions
  const isCurrentUserPresenter = activePresentation?.presenter?.id === user?.id;

  const handleStartPresentation = () => {
    if (!socket) return;
    setPresentationError('');
    socket.emit('presentation:start', { groupId }, (res) => {
      if (!res?.success) {
        setPresentationError(res?.error || 'Failed to start presentation');
      } else {
        setCenterTab('whiteboard');
      }
    });
  };

  const handleStopPresentation = () => {
    if (!socket) return;
    socket.emit('presentation:stop', { groupId });
  };

  // Broadcast drawing changes when current user is the presenter
  const handlePresenterDrawingUpdate = (elements, appState) => {
    if (!socket || !isCurrentUserPresenter) return;
    socket.emit('whiteboard:update', {
      groupId,
      elements,
      appState,
    });
  };

  // Invite member flow
  const handleOpenInvite = () => {
    setIsInviteModalOpen(true);
    setInviteSearch('');
    setInviteSearchResults([]);
    setInviteSuccess('');
    setInviteError('');
  };

  const handleSearchInviteUsers = async (query) => {
    setInviteSearch(query);
    const trimmed = query.trim();
    if (!trimmed) {
      setInviteSearchResults([]);
      return;
    }
    setInviteSearching(true);
    try {
      const res = await api.get(`/users?search=${encodeURIComponent(trimmed)}`);
      const currentMemberIds = new Set(group.members.map((m) => m.userId));
      const eligible = (res.data.users || []).filter((u) => !currentMemberIds.has(u.id));
      setInviteSearchResults(eligible);
    } catch (err) {
      console.error('Failed to search users for invite:', err);
    } finally {
      setInviteSearching(false);
    }
  };

  const handleAddMember = async (targetUserId) => {
    setInviteLoading(true);
    setInviteError('');
    setInviteSuccess('');

    try {
      await api.post(`/groups/${groupId}/invitations`, {
        userId: targetUserId,
        role: inviteRole,
      });
      setInviteSuccess('Workspace invitation sent! They will join once accepted.');
      setInviteSearchResults((prev) => prev.filter((u) => u.id !== targetUserId));
    } catch (err) {
      setInviteError(err.response?.data?.message || err.message || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  // Delete Workspace flow (Owner only)
  const handleDeleteWorkspace = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete workspace "${group.name}"? All members, whiteboards, and discussions will be removed. This cannot be undone.`)) return;
    try {
      await api.delete(`/groups/${groupId}`);
      navigate('/dashboard');
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete workspace');
    }
  };

  // Leave Group flow
  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      await api.delete(`/groups/${groupId}/members/${user.id}`);
      navigate('/dashboard');
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to leave group');
    }
  };

  // Remove member flow (Owner / Admin)
  const handleRemoveMember = async (targetUserId) => {
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      await api.delete(`/groups/${groupId}/members/${targetUserId}`);
      loadGroupData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to remove member');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Entering discussion room...</p>
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-rose-100 dark:border-rose-950/60 p-6 text-center space-y-4 shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Room Unavailable</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{error || 'Could not load group discussion.'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isOwnerOrAdmin = group.currentUserRole === 'OWNER' || group.currentUserRole === 'ADMIN';

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-slate-100/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      {/* ================= LEFT SIDEBAR ================= */}
      <aside className="w-full lg:w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 overflow-y-auto transition-colors">
        <div className="p-4 space-y-5">
          {/* Group Header Info */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider uppercase text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 px-2 py-0.5 rounded-md">
                {group.currentUserRole}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                {group.members.length} member{group.members.length !== 1 ? 's' : ''}
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-snug">{group.name}</h1>
            {group.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3">{group.description}</p>
            )}
          </div>

          {/* Member List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Discussion Members
              </span>
              {isOwnerOrAdmin && (
                <button
                  onClick={handleOpenInvite}
                  title="Invite Member"
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Invite</span>
                </button>
              )}
            </div>

            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {group.members.map((m) => {
                const online = isUserOnline(m.userId);
                const isMe = m.userId === user.id;
                const isPresenter = activePresentation?.presenter?.id === m.userId;

                return (
                  <div
                    key={m.id}
                    className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between text-xs transition-colors group/item"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-[11px] text-slate-700 dark:text-slate-200">
                          {m.user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5">
                          <OnlineIndicator isOnline={online} size="xs" />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {m.user.username} {isMe && '(You)'}
                          </p>
                          {isPresenter && (
                            <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 animate-pulse">
                              <Radio className="w-2.5 h-2.5" /> Live
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">{m.role}</p>
                      </div>
                    </div>

                    {/* Member actions */}
                    {isOwnerOrAdmin && !isMe && m.role !== 'OWNER' && (
                      <button
                        onClick={() => handleRemoveMember(m.userId)}
                        title="Remove member"
                        className="opacity-0 group-hover/item:opacity-100 text-slate-300 dark:text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded transition-opacity cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {group.currentUserRole === 'OWNER' ? (
            <button
              onClick={handleDeleteWorkspace}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Workspace</span>
            </button>
          ) : (
            <button
              onClick={handleLeaveGroup}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave Group</span>
            </button>
          )}
        </div>
      </aside>

      {/* ================= CENTER MAIN AREA ================= */}
      <main className="flex-1 flex flex-col overflow-hidden p-4 min-w-0">
        {/* Top View Selector & Presentation Alert */}
        <div className="flex items-center justify-between mb-3 gap-2">
          {/* Tab Toggles */}
          <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <button
              onClick={() => setCenterTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                centerTab === 'chat'
                  ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Group Chat</span>
            </button>

            <button
              onClick={() => setCenterTab('whiteboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                centerTab === 'whiteboard'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>My Whiteboard {isCurrentUserPresenter && '(Live)'}</span>
            </button>

            {activePresentation && !isCurrentUserPresenter && (
              <button
                onClick={() => setCenterTab('presentation')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  centerTab === 'presentation'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 animate-pulse font-bold'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Watch {activePresentation.presenter?.username}'s Presentation</span>
              </button>
            )}
          </div>

          {/* Quick Presentation Status Indicator */}
          {activePresentation ? (
            <div className="flex items-center gap-2 px-3 py-1 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="font-semibold">
                {isCurrentUserPresenter ? 'You are presenting' : `${activePresentation.presenter?.username} is presenting`}
              </span>
              {!isCurrentUserPresenter && centerTab !== 'presentation' && (
                <button
                  onClick={() => setCenterTab('presentation')}
                  className="ml-1 px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Watch Now
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
              No live presentation active
            </span>
          )}
        </div>

        {/* Dynamic Center Stage */}
        <div className="flex-1 relative overflow-hidden h-full min-h-[500px]">
          {/* Group Chat Tab */}
          <div
            className={`absolute inset-0 w-full h-full flex flex-col transition-opacity duration-150 ${
              centerTab === 'chat'
                ? 'opacity-100 z-10 pointer-events-auto'
                : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <GroupChat
              messages={messages}
              onSendMessage={handleSendMessage}
              onTyping={handleTyping}
              typingUsers={Array.from(typingUsers)}
              currentUserId={user?.id}
            />
          </div>

          {/* Individual Whiteboard Tab (Persisted in browser memory across tab switches) */}
          <div
            className={`absolute inset-0 w-full h-full flex flex-col transition-opacity duration-150 ${
              centerTab === 'whiteboard'
                ? 'opacity-100 z-10 pointer-events-auto'
                : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <IndividualWhiteboard
              isLivePresenter={isCurrentUserPresenter}
              onDrawingUpdate={handlePresenterDrawingUpdate}
            />
          </div>

          {/* Live Presentation Viewer Tab (Read-Only) */}
          {activePresentation && !isCurrentUserPresenter && (
            <div
              className={`absolute inset-0 w-full h-full flex flex-col transition-opacity duration-150 ${
                centerTab === 'presentation'
                  ? 'opacity-100 z-10 pointer-events-auto'
                  : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              <LivePresentationViewer
                presenter={activePresentation.presenter}
                liveElements={liveElements}
                liveAppState={liveAppState}
              />
            </div>
          )}
        </div>
      </main>

      {/* ================= RIGHT SIDEBAR: PRESENTATION & WHITEBOARD CONTROLS ================= */}
      <aside className="w-full lg:w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between shrink-0 overflow-y-auto space-y-6">
        <div className="space-y-6">
          {/* Presentation Status & Actions Card */}
          <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Live Presentation</span>
              </h3>
              {activePresentation && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/50 dark:border-rose-900/50 uppercase">
                  Active
                </span>
              )}
            </div>

            {presentationError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
                {presentationError}
              </div>
            )}

            {activePresentation ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                  <p className="text-slate-400 dark:text-slate-500 uppercase text-[10px] font-semibold">Active Presenter</p>
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                    {activePresentation.presenter?.username} {isCurrentUserPresenter && '(You)'}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Live stream active since {new Date(activePresentation.startedAt).toLocaleTimeString()}
                  </p>
                </div>

                {isCurrentUserPresenter ? (
                  <button
                    onClick={handleStopPresentation}
                    className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Presentation</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setCenterTab('presentation')}
                    className="w-full py-2.5 px-4 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Watch Live Board</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Start presenting to broadcast your individual whiteboard in real time to all group members.
                </p>
                <button
                  onClick={handleStartPresentation}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all shadow-blue-600/10 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Presentation</span>
                </button>
              </div>
            )}
          </div>

          {/* Member Whiteboards Directory */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
              <span>Member Whiteboards</span>
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">Independent</span>
            </h4>
            <div className="space-y-2">
              {group.members.map((m) => {
                const isPresenter = activePresentation?.presenter?.id === m.userId;
                const isMe = m.userId === user.id;

                return (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                      isPresenter
                        ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-600 dark:text-slate-300">
                        {m.user.username.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {m.user.username}'s Canvas
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                          {isPresenter ? 'Currently presenting' : isMe ? 'Your private canvas' : 'Available to present'}
                        </p>
                      </div>
                    </div>

                    {isPresenter ? (
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase flex items-center gap-1">
                        <Radio className="w-3 h-3" /> Live
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                        Private
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Storage Architecture Reminder */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-400 leading-relaxed">
          <p className="font-semibold text-slate-600 dark:text-slate-300 mb-0.5">Canvas & Chat Storage:</p>
          Whiteboards exist purely in browser memory. Chat messages are temporary in Redis with TTL.
        </div>
      </aside>

      {/* Invite Member Modal */}
      <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="Invite Member to Group">
        {inviteError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs">
            {inviteError}
          </div>
        )}

        {inviteSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{inviteSuccess}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Search User by Username or Email *
            </label>
            <input
              type="text"
              value={inviteSearch}
              onChange={(e) => handleSearchInviteUsers(e.target.value)}
              placeholder="e.g. rahul or user@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Assign Role in Group
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            {!inviteSearch.trim() ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                Users are kept private. Enter a username or email address above to find and invite them.
              </p>
            ) : inviteSearching ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">Searching...</p>
            ) : inviteSearchResults.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                No matching registered users found or user is already in this group.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {inviteSearchResults.map((u) => {
                  const online = isUserOnline(u.id);
                  return (
                    <div
                      key={u.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center font-bold text-blue-700 dark:text-blue-300 text-xs">
                          {u.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{u.username}</p>
                            <OnlineIndicator isOnline={online} size="xs" />
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{u.email}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAddMember(u.id)}
                        disabled={inviteLoading}
                        type="button"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors shrink-0"
                      >
                        Send Invite
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
