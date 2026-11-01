import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { OnlineIndicator } from '../../components/presence/OnlineIndicator';
import { Modal } from '../../components/common/Modal';
import { Send, Clock, User, Sparkles, MessageCircle } from 'lucide-react';

export const DirectChatModal = ({ isOpen, onClose, friend }) => {
  const { user } = useAuth();
  const { socket, isConnected, isUserOnline, markDmRead, setActiveChatFriendId } = useSocket();
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const isOnline = friend ? isUserOnline(friend.id) : false;

  // Track active chat friend and clear unread markers
  useEffect(() => {
    if (isOpen && friend) {
      if (setActiveChatFriendId) setActiveChatFriendId(friend.id);
      if (markDmRead) markDmRead(friend.id);
    }
    return () => {
      if (setActiveChatFriendId) setActiveChatFriendId(null);
    };
  }, [isOpen, friend?.id]);

  // Load initial ephemeral direct messages from Redis
  useEffect(() => {
    if (!isOpen || !friend) return;

    let mounted = true;
    const fetchDmMessages = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/friends/${friend.id}/messages`);
        if (mounted) {
          setMessages(res.data.messages || []);
        }
      } catch (err) {
        console.error('Failed to load DM history:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchDmMessages();

    return () => {
      mounted = false;
    };
  }, [isOpen, friend?.id]);

  // Socket listener for incoming DMs and typing status
  useEffect(() => {
    if (!socket || !friend || !isOpen) return;

    const handleDmMessage = (msg) => {
      const senderId = String(msg.sender?.id || '');
      const targetId = String(msg.targetUserId || '');
      const friendId = String(friend?.id || '');
      const myId = String(user?.id || '');

      const isRelevant =
        (senderId === friendId && targetId === myId) ||
        (senderId === myId && targetId === friendId);

      if (isRelevant) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (markDmRead) markDmRead(friend.id);
      }
    };

    const handleDmTyping = (data) => {
      if (String(data.senderId) === String(friend.id)) {
        setIsFriendTyping(!!data.isTyping);
      }
    };

    socket.on('dm:message', handleDmMessage);
    socket.on('dm:typing_status', handleDmTyping);

    return () => {
      socket.off('dm:message', handleDmMessage);
      socket.off('dm:typing_status', handleDmTyping);
    };
  }, [socket, friend?.id, user?.id, isOpen]);

  // Scroll to bottom of chat list on new messages
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  const handleInputChange = (e) => {
    setContent(e.target.value);
    if (!socket || !friend) return;

    socket.emit('dm:typing', { targetUserId: friend.id, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('dm:typing', { targetUserId: friend.id, isTyping: false });
    }, 1500);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!content.trim() || !friend) return;
    if (!socket) {
      alert('Socket connection is disconnected. Reconnecting...');
      return;
    }

    const text = content.trim();
    setContent('');
    socket.emit('dm:typing', { targetUserId: friend.id, isTyping: false });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Send via socket with acknowledgement
    socket.emit(
      'dm:send',
      {
        targetUserId: friend.id,
        content: text,
      },
      (ack) => {
        if (ack?.success && ack.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === ack.message.id)) return prev;
            return [...prev, ack.message];
          });
        }
      }
    );
  };

  if (!friend) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="max-w-lg">
      <div className="flex flex-col h-[520px] -m-6">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-slate-200">
              {friend.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{friend.username}</h3>
                <OnlineIndicator isOnline={isOnline} showText size="xs" />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">{friend.email}</p>
            </div>
          </div>
        </div>

        {/* Ephemeral Warning Notice */}
        <div className="bg-blue-50/60 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/60 px-4 py-2 flex items-center justify-between text-[11px] text-blue-800 dark:text-blue-300">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Direct chat stored temporarily in Redis (expires via TTL)</span>
          </div>
          <span className="font-mono text-blue-600 dark:text-blue-400">{messages.length} msgs</span>
        </div>

        {/* Messages List */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-white dark:bg-slate-900 transition-colors">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500 space-y-2">
              <MessageCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No messages yet</p>
              <p className="text-xs max-w-xs">
                Start a direct conversation with {friend.username}.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = String(msg.sender?.id || '') === String(user?.id || '');
              return (
                <div
                  key={msg.id || `${msg.timestamp}-${Math.random()}`}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {isMe ? 'You' : friend.username}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-xs break-words ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-xs'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Typing Indicator */}
        {isFriendTyping && (
          <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 italic flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span>{friend.username} is typing...</span>
          </div>
        )}

        {/* Message Input Form */}
        <form onSubmit={handleSend} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={content}
            onChange={handleInputChange}
            placeholder={`Message ${friend.username}...`}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
          <button
            type="submit"
            disabled={!content.trim()}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </Modal>
  );
};
