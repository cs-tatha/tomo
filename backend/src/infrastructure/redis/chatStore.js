import { getRedisClient } from './redisClient.js';
import { ENV } from '../../config/env.js';

const KEY_PREFIX = 'chat:group:';
const DM_KEY_PREFIX = 'chat:dm:';

function getDmKey(userId1, userId2) {
  const sorted = [userId1, userId2].sort();
  return `${DM_KEY_PREFIX}${sorted[0]}_${sorted[1]}:messages`;
}

export const chatStore = {
  // Group Ephemeral Chat
  async addMessage(groupId, message) {
    const redis = getRedisClient();
    const key = `${KEY_PREFIX}${groupId}:messages`;
    const serialized = JSON.stringify(message);

    await redis.rpush(key, serialized);
    await redis.expire(key, ENV.CHAT_MESSAGE_TTL_SECONDS);
  },

  async getMessages(groupId, limit = 50) {
    const redis = getRedisClient();
    const key = `${KEY_PREFIX}${groupId}:messages`;
    
    const rawList = await redis.lrange(key, -limit, -1);
    if (!rawList || rawList.length === 0) {
      return [];
    }

    return rawList.map((item) => {
      try {
        return JSON.parse(item);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  },

  async clearMessages(groupId) {
    const redis = getRedisClient();
    const key = `${KEY_PREFIX}${groupId}:messages`;
    await redis.del(key);
  },

  // 1-on-1 Direct Ephemeral Chat
  async addDirectMessage(userId1, userId2, message) {
    const redis = getRedisClient();
    const key = getDmKey(userId1, userId2);
    const serialized = JSON.stringify(message);

    await redis.rpush(key, serialized);
    await redis.expire(key, ENV.CHAT_MESSAGE_TTL_SECONDS);
  },

  async getDirectMessages(userId1, userId2, limit = 50) {
    const redis = getRedisClient();
    const key = getDmKey(userId1, userId2);

    const rawList = await redis.lrange(key, -limit, -1);
    if (!rawList || rawList.length === 0) {
      return [];
    }

    return rawList.map((item) => {
      try {
        return JSON.parse(item);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  },
};
