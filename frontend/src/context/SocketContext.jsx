import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { accessToken, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [unreadDms, setUnreadDms] = useState({});
  const [incomingAlert, setIncomingAlert] = useState(null);
  const [activeChatFriendId, setActiveChatFriendId] = useState(null);

  // Pending Friend Requests & Workspace Invitations
  const [friendRequests, setFriendRequests] = useState([]);
  const [workspaceInvitations, setWorkspaceInvitations] = useState([]);

  const activeChatFriendIdRef = useRef(null);
  useEffect(() => {
    activeChatFriendIdRef.current = activeChatFriendId;
  }, [activeChatFriendId]);

  const refreshNotifications = async () => {
    if (!accessToken) return;
    try {
      const [friendRes, workspaceRes] = await Promise.all([
        api.get('/friends/requests'),
        api.get('/groups/invitations/my'),
      ]);
      setFriendRequests(friendRes.data.incoming || []);
      setWorkspaceInvitations(workspaceRes.data.invitations || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    if (!accessToken || !user) {
      setSocket((prev) => {
        if (prev) prev.disconnect();
        return null;
      });
      setIsConnected(false);
      setOnlineUserIds(new Set());
      setUnreadDms({});
      setIncomingAlert(null);
      setFriendRequests([]);
      setWorkspaceInvitations([]);
      return;
    }

    refreshNotifications();

    const socketUrl = import.meta.env.VITE_SOCKET_URL || (
      import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
        : 'http://localhost:5000'
    );

    const newSocket = io(socketUrl, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('presence:get_online', (res) => {
        if (res?.success && Array.isArray(res.onlineUserIds)) {
          setOnlineUserIds(new Set(res.onlineUserIds));
        }
      });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('presence:user_online', ({ userId }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
    });

    newSocket.on('presence:user_offline', ({ userId }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    // Global listener for direct messages to track unread counts & toast alerts
    newSocket.on('dm:message', (msg) => {
      const senderId = msg.sender?.id;
      if (senderId && senderId !== user.id) {
        if (activeChatFriendIdRef.current !== senderId) {
          setUnreadDms((prev) => ({
            ...prev,
            [senderId]: (prev[senderId] || 0) + 1,
          }));
          setIncomingAlert({
            type: 'dm',
            friendId: senderId,
            username: msg.sender?.username || 'Friend',
            content: msg.content,
            timestamp: msg.timestamp,
          });
        }
      }
    });

    // Real-time friend request listeners
    newSocket.on('friend:request_received', ({ request }) => {
      refreshNotifications();
      setIncomingAlert({
        type: 'friend_request',
        username: request.sender?.username || 'A user',
        content: `${request.sender?.username || 'A user'} sent you a friend request!`,
      });
    });

    newSocket.on('friend:request_accepted', ({ friend }) => {
      refreshNotifications();
      setIncomingAlert({
        type: 'friend_accepted',
        username: friend?.username || 'Friend',
        content: `${friend?.username || 'A user'} accepted your friend request!`,
      });
    });

    newSocket.on('friend:request_rejected', () => {
      refreshNotifications();
    });

    // Real-time workspace invitation listeners
    newSocket.on('workspace:invitation_received', ({ invitation }) => {
      refreshNotifications();
      setIncomingAlert({
        type: 'workspace_invite',
        username: invitation.inviter?.username || 'Teammate',
        content: `You were invited to join workspace "${invitation.group?.name || 'Workspace'}"!`,
      });
    });

    newSocket.on('workspace:invitation_accepted', () => {
      refreshNotifications();
    });

    newSocket.on('workspace:invitation_rejected', () => {
      refreshNotifications();
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [accessToken, user?.id]);

  const isUserOnline = (targetUserId) => {
    return onlineUserIds.has(targetUserId);
  };

  const markDmRead = (friendId) => {
    setUnreadDms((prev) => {
      if (!prev[friendId]) return prev;
      const next = { ...prev };
      delete next[friendId];
      return next;
    });
    setIncomingAlert((prev) => (prev?.friendId === friendId ? null : prev));
  };

  const clearIncomingAlert = () => {
    setIncomingAlert(null);
  };

  const acceptFriendRequest = async (requestId) => {
    const res = await api.post(`/friends/requests/${requestId}/accept`);
    await refreshNotifications();
    return res.data;
  };

  const rejectFriendRequest = async (requestId) => {
    const res = await api.post(`/friends/requests/${requestId}/reject`);
    await refreshNotifications();
    return res.data;
  };

  const acceptWorkspaceInvite = async (inviteId) => {
    const res = await api.post(`/groups/invitations/${inviteId}/accept`);
    await refreshNotifications();
    return res.data;
  };

  const rejectWorkspaceInvite = async (inviteId) => {
    const res = await api.post(`/groups/invitations/${inviteId}/reject`);
    await refreshNotifications();
    return res.data;
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUserIds,
        isUserOnline,
        unreadDms,
        incomingAlert,
        markDmRead,
        clearIncomingAlert,
        activeChatFriendId,
        setActiveChatFriendId,
        friendRequests,
        workspaceInvitations,
        refreshNotifications,
        acceptFriendRequest,
        rejectFriendRequest,
        acceptWorkspaceInvite,
        rejectWorkspaceInvite,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
