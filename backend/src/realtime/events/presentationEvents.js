import { groupService } from '../../modules/groups/groupService.js';
import { presentationStore } from '../../infrastructure/redis/presentationStore.js';

export function setupPresentationEvents(io, socket) {
  const user = socket.user;

  // Join a group discussion room
  socket.on('group:join', async ({ groupId }, callback) => {
    try {
      if (!groupId) {
        if (typeof callback === 'function') callback({ success: false, error: 'groupId is required' });
        return;
      }

      // Validate user is a member of this group in DB
      const isMember = await groupService.isMember(groupId, user.id);
      if (!isMember) {
        if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: Not a member of this group' });
        return;
      }

      const roomName = `group:${groupId}`;
      await socket.join(roomName);

      // Check if a presentation is currently live in this group
      const activePresentation = await presentationStore.getPresentation(groupId);

      if (typeof callback === 'function') {
        callback({
          success: true,
          activePresentation,
        });
      }
    } catch (err) {
      console.error('[Room] Error joining group:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // Leave a group discussion room
  socket.on('group:leave', async ({ groupId }) => {
    try {
      if (!groupId) return;
      const roomName = `group:${groupId}`;
      await socket.leave(roomName);
    } catch (err) {
      console.error('[Room] Error leaving group:', err);
    }
  });

  // Start live presentation
  socket.on('presentation:start', async ({ groupId }, callback) => {
    try {
      if (!groupId) {
        socket.emit('presentation:error', { message: 'Group ID is required to present.' });
        if (typeof callback === 'function') callback({ success: false, error: 'Missing groupId' });
        return;
      }

      // 1. Validate user is an actual group member
      const isMember = await groupService.isMember(groupId, user.id);
      if (!isMember) {
        socket.emit('presentation:error', { message: 'Unauthorized: You are not a member of this group.' });
        if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized' });
        return;
      }

      // 2. Lock presentation in Redis (prevents concurrent presenters)
      const presentation = await presentationStore.startPresentation(groupId, {
        presenterId: user.id,
        presenterName: user.username,
      });

      // 3. Broadcast presentation:started to the entire group room
      io.to(`group:${groupId}`).emit('presentation:started', {
        groupId,
        presenter: {
          id: user.id,
          username: user.username,
        },
        startedAt: presentation.startedAt,
      });

      if (typeof callback === 'function') {
        callback({ success: true, presentation });
      }
    } catch (err) {
      console.error('[Presentation] Error starting presentation:', err);
      socket.emit('presentation:error', { message: err.message });
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // Stop live presentation
  socket.on('presentation:stop', async ({ groupId }, callback) => {
    try {
      if (!groupId) return;

      // 1. Verify that this user is indeed the active presenter
      await presentationStore.stopPresentation(groupId, user.id);

      // 2. Broadcast presentation:stopped to group room
      io.to(`group:${groupId}`).emit('presentation:stopped', {
        groupId,
        presenterId: user.id,
      });

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (err) {
      console.error('[Presentation] Error stopping presentation:', err);
      socket.emit('presentation:error', { message: err.message });
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // Whiteboard drawing updates from presenter
  socket.on('whiteboard:update', async ({ groupId, elements, appState }) => {
    try {
      if (!groupId || !elements) return;

      // Security check: Verify that user is the active presenter of this group
      const activePresentation = await presentationStore.getPresentation(groupId);
      if (!activePresentation || activePresentation.presenterId !== user.id) {
        // Not authorized to broadcast whiteboard updates
        return;
      }

      // Broadcast drawing changes to all group members except the presenter
      socket.to(`group:${groupId}`).emit('whiteboard:updated', {
        groupId,
        elements,
        appState,
        presenterId: user.id,
      });
    } catch (err) {
      console.error('[Presentation] Error broadcasting whiteboard update:', err);
    }
  });
}
