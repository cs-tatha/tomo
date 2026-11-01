import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Modal } from '../../components/common/Modal';
import { Search, UserPlus, Check, Clock, Sparkles, AlertCircle } from 'lucide-react';

export const AddFriendModal = ({ isOpen, onClose, onFriendAdded }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  // Relationship state to render appropriate button status
  const [confirmedFriends, setConfirmedFriends] = useState(new Set());
  const [sentRequestUserIds, setSentRequestUserIds] = useState(new Set());
  const [incomingRequestMap, setIncomingRequestMap] = useState({}); // userId -> requestId

  const fetchRelationships = async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        api.get('/friends'),
        api.get('/friends/requests'),
      ]);
      if (friendsRes.data?.friends) {
        setConfirmedFriends(new Set(friendsRes.data.friends.map((f) => f.id)));
      }
      if (requestsRes.data) {
        setSentRequestUserIds(new Set((requestsRes.data.outgoing || []).map((r) => r.receiver?.id || r.receiverId)));
        const incMap = {};
        (requestsRes.data.incoming || []).forEach((r) => {
          const senderId = r.sender?.id || r.senderId;
          incMap[senderId] = r.id;
        });
        setIncomingRequestMap(incMap);
      }
    } catch (err) {
      console.error('Failed to load relationships in AddFriendModal:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setMessage(null);
      fetchRelationships();
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/users?search=${encodeURIComponent(trimmed)}`);
        setResults(res.data?.users || []);
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSendFriendRequest = async (targetUser) => {
    setActionLoadingId(targetUser.id);
    setMessage(null);
    try {
      const res = await api.post('/friends/request', { targetUserId: targetUser.id });
      if (res.data?.status === 'ACCEPTED') {
        setConfirmedFriends((prev) => new Set(prev).add(targetUser.id));
        setMessage({ type: 'success', text: `You are now friends with ${targetUser.username}!` });
        if (onFriendAdded) onFriendAdded();
      } else {
        setSentRequestUserIds((prev) => new Set(prev).add(targetUser.id));
        setMessage({ type: 'success', text: `Friend request sent to ${targetUser.username}!` });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to send request',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAcceptRequest = async (targetUser) => {
    const requestId = incomingRequestMap[targetUser.id];
    if (!requestId) return;

    setActionLoadingId(targetUser.id);
    setMessage(null);
    try {
      await api.post(`/friends/requests/${requestId}/accept`);
      setConfirmedFriends((prev) => new Set(prev).add(targetUser.id));
      setIncomingRequestMap((prev) => {
        const next = { ...prev };
        delete next[targetUser.id];
        return next;
      });
      setMessage({ type: 'success', text: `Accepted friend request from ${targetUser.username}!` });
      if (onFriendAdded) onFriendAdded();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to accept request',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Friend" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or email address..."
            autoFocus
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-xs"
          />
        </div>

        {/* Feedback Message */}
        {message && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
              message.type === 'success'
                ? 'bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Results / List Area */}
        <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2.5">
              <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Searching users...</p>
            </div>
          ) : query.trim().length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <Sparkles className="w-10 h-10 mx-auto text-blue-500/80 stroke-1" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Search to discover registered users</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                Type a teammate's username or email address to send a real-time friend request.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No users found matching &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Check the spelling or try searching by exact email.</p>
            </div>
          ) : (
            results.map((targetUser) => {
              const isFriend = confirmedFriends.has(targetUser.id);
              const isSent = sentRequestUserIds.has(targetUser.id);
              const hasIncoming = !!incomingRequestMap[targetUser.id];
              const isActing = actionLoadingId === targetUser.id;

              return (
                <div
                  key={targetUser.id}
                  className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold text-sm flex items-center justify-center shrink-0">
                      {targetUser.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {targetUser.username}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{targetUser.email}</p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isFriend ? (
                      <span className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1.5 border border-blue-200 dark:border-blue-900">
                        <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Friends</span>
                      </span>
                    ) : hasIncoming ? (
                      <button
                        type="button"
                        onClick={() => handleAcceptRequest(targetUser)}
                        disabled={isActing}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isActing ? 'Accepting...' : 'Accept Request'}
                      </button>
                    ) : isSent ? (
                      <span className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-center gap-1.5 border border-amber-200 dark:border-amber-900">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>Pending</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendFriendRequest(targetUser)}
                        disabled={isActing}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{isActing ? 'Sending...' : 'Add Friend'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
