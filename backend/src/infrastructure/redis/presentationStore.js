import { getRedisClient } from './redisClient.js';

const PRESENTATION_PREFIX = 'presentation:group:';

export const presentationStore = {
  /**
   * Starts a presentation for a group.
   * If a presentation is already active, throws an error or returns null.
   */
  async startPresentation(groupId, { presenterId, presenterName }) {
    const redis = getRedisClient();
    const key = `${PRESENTATION_PREFIX}${groupId}`;

    // Atomically check if already presenting
    const existing = await redis.get(key);
    if (existing) {
      const data = JSON.parse(existing);
      if (data.presenterId !== presenterId) {
        throw new Error(`Another presentation is already active by ${data.presenterName || 'another member'}`);
      }
      return data;
    }

    const presentationData = {
      groupId,
      presenterId,
      presenterName,
      startedAt: new Date().toISOString(),
      isLive: true,
    };

    // Store in Redis (expires after 12 hours max as a safeguard against leaked presentations)
    await redis.set(key, JSON.stringify(presentationData), 'EX', 43200);
    return presentationData;
  },

  /**
   * Gets the active presentation for a group.
   */
  async getPresentation(groupId) {
    const redis = getRedisClient();
    const key = `${PRESENTATION_PREFIX}${groupId}`;
    const raw = await redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Stops a presentation for a group.
   * Verifies that the caller is the current presenter.
   */
  async stopPresentation(groupId, presenterId) {
    const redis = getRedisClient();
    const key = `${PRESENTATION_PREFIX}${groupId}`;
    const raw = await redis.get(key);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (data.presenterId !== presenterId) {
      throw new Error('Only the current presenter can stop the presentation');
    }

    await redis.del(key);
    return data;
  },

  /**
   * Clears any presentation for a group (e.g. when group is deleted).
   */
  async clearPresentation(groupId) {
    const redis = getRedisClient();
    const key = `${PRESENTATION_PREFIX}${groupId}`;
    await redis.del(key);
  },

  /**
   * Cleans up presentations hosted by a specific user across all groups if they disconnect completely.
   */
  async cleanupPresentationsForUser(userId) {
    const redis = getRedisClient();
    const keys = await redis.keys(`${PRESENTATION_PREFIX}*`);
    const stoppedGroups = [];

    for (const key of keys) {
      const raw = await redis.get(key);
      if (raw) {
        try {
          const data = JSON.parse(raw);
          if (data.presenterId === userId) {
            await redis.del(key);
            stoppedGroups.push(data.groupId);
          }
        } catch {}
      }
    }
    return stoppedGroups;
  }
};
