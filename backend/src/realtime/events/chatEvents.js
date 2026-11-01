import { v4 as uuidv4 } from 'uuid';
import { groupService } from '../../modules/groups/groupService.js';
import { chatStore } from '../../infrastructure/redis/chatStore.js';

export function setupChatEvents(io, socket) {
  const user = socket.user;

  // Join personal user room to receive direct messages across all tabs
  socket.join(`user:${user.id}`);

  // Send group chat message
  socket.on('chat:send', async ({ groupId, content }, callback) => {
    try {
      if (!groupId || !content || typeof content !== 'string' || content.trim().length === 0) {
        if (typeof callback === 'function') callback({ success: false, error: 'Invalid message content' });
        return;
      }

      // Security check: Validate that user is an actual member of this group
      const isMember = await groupService.isMember(groupId, user.id);
      if (!isMember) {
        if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: Not a member of this group' });
        return;
      }

      const message = {
        id: uuidv4(),
        groupId,
        sender: {
          id: user.id,
          username: user.username,
        },
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };

      // Ephemeral storage in Redis with TTL (never in PostgreSQL)
      await chatStore.addMessage(groupId, message);

      // Broadcast immediately to everyone in the group room
      io.to(`group:${groupId}`).emit('chat:message', message);

      if (typeof callback === 'function') {
        callback({ success: true, message });
      }
    } catch (err) {
      console.error('[Chat] Error sending message:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Internal server error while sending message' });
      }
    }
  });

  // Group Typing indicators
  socket.on('chat:typing', async ({ groupId, isTyping }) => {
    try {
      if (!groupId) return;
      socket.to(`group:${groupId}`).emit('chat:typing_status', {
        groupId,
        userId: user.id,
        username: user.username,
        isTyping: !!isTyping,
      });
    } catch (err) {
      console.error('[Chat] Error handling typing event:', err);
    }
  });

  // Direct 1-on-1 Chat Send
  socket.on('dm:send', async ({ targetUserId, content }, callback) => {
    try {
      if (!targetUserId || !content || typeof content !== 'string' || content.trim().length === 0) {
        if (typeof callback === 'function') callback({ success: false, error: 'Invalid message content' });
        return;
      }

      const message = {
        id: uuidv4(),
        sender: {
          id: user.id,
          username: user.username,
        },
        targetUserId,
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };

      console.log(`[DM] Message from ${user.username} (${user.id}) -> Target (${targetUserId}): "${message.content}"`);

      // Ephemeral direct chat in Redis with TTL
      await chatStore.addDirectMessage(user.id, targetUserId, message);

      // Broadcast to both recipient and sender across all active tabs/sockets
      io.to(`user:${targetUserId}`).emit('dm:message', message);
      io.to(`user:${user.id}`).emit('dm:message', message);

      if (typeof callback === 'function') {
        callback({ success: true, message });
      }
    } catch (err) {
      console.error('[DM] Error sending direct message:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // Direct 1-on-1 Typing Indicator
  socket.on('dm:typing', ({ targetUserId, isTyping }) => {
    try {
      if (!targetUserId) return;
      io.to(`user:${targetUserId}`).emit('dm:typing_status', {
        senderId: user.id,
        username: user.username,
        isTyping: !!isTyping,
      });
    } catch (err) {
      console.error('[DM] Error in typing status:', err);
    }
  });
}
