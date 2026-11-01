import { presenceStore } from '../../infrastructure/redis/presenceStore.js';
import { presentationStore } from '../../infrastructure/redis/presentationStore.js';

export function setupPresenceEvents(io, socket) {
  const user = socket.user;

  // On connection
  (async () => {
    try {
      const isFirstConnection = await presenceStore.addSocket(user.id, socket.id);
      if (isFirstConnection) {
        // Broadcast to all connected clients that this user has come online
        io.emit('presence:user_online', {
          userId: user.id,
          username: user.username,
        });
      }
    } catch (err) {
      console.error('[Presence] Error registering socket:', err);
    }
  })();

  // Handle client requesting all online users
  socket.on('presence:get_online', async (callback) => {
    try {
      const onlineUserIds = await presenceStore.getOnlineUserIds();
      if (typeof callback === 'function') {
        callback({ success: true, onlineUserIds });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // On disconnect
  socket.on('disconnect', async () => {
    try {
      const isCompletelyOffline = await presenceStore.removeSocket(user.id, socket.id);
      if (isCompletelyOffline) {
        // Broadcast user offline
        io.emit('presence:user_offline', {
          userId: user.id,
        });

        // If this user was presenting in any group, auto-stop and notify group members
        const affectedGroups = await presentationStore.cleanupPresentationsForUser(user.id);
        for (const groupId of affectedGroups) {
          io.to(`group:${groupId}`).emit('presentation:stopped', {
            groupId,
            presenterId: user.id,
            reason: 'Presenter disconnected',
          });
        }
      }
    } catch (err) {
      console.error('[Presence] Error on socket disconnect:', err);
    }
  });
}
