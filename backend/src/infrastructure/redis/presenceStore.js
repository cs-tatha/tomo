import { getRedisClient } from './redisClient.js';

const USER_SOCKETS_PREFIX = 'presence:user:';
const ONLINE_USERS_KEY = 'presence:online_users';

export const presenceStore = {
  /**
   * Registers a socket connection for a user.
   * Returns true if this is the user's first active connection (user just transitioned from offline to online).
   */
  async addSocket(userId, socketId) {
    const redis = getRedisClient();
    const userSocketsKey = `${USER_SOCKETS_PREFIX}${userId}:sockets`;

    const initialCount = await redis.scard(userSocketsKey);
    await redis.sadd(userSocketsKey, socketId);
    await redis.sadd(ONLINE_USERS_KEY, userId);

    return initialCount === 0;
  },

  /**
   * Removes a socket connection for a user.
   * Returns true if user has 0 remaining sockets (user just went offline).
   */
  async removeSocket(userId, socketId) {
    const redis = getRedisClient();
    const userSocketsKey = `${USER_SOCKETS_PREFIX}${userId}:sockets`;

    await redis.srem(userSocketsKey, socketId);
    const remainingCount = await redis.scard(userSocketsKey);

    if (remainingCount === 0) {
      await redis.srem(ONLINE_USERS_KEY, userId);
      await redis.del(userSocketsKey);
      return true;
    }
    return false;
  },

  /**
   * Check if a specific user is currently online.
   */
  async isUserOnline(userId) {
    const redis = getRedisClient();
    const isMember = await redis.sismember(ONLINE_USERS_KEY, userId);
    return isMember === 1 || isMember === true;
  },

  /**
   * Get all currently online user IDs.
   */
  async getOnlineUserIds() {
    const redis = getRedisClient();
    return await redis.smembers(ONLINE_USERS_KEY);
  },

  /**
   * Get active socket count for a user.
   */
  async getSocketCount(userId) {
    const redis = getRedisClient();
    return await redis.scard(`${USER_SOCKETS_PREFIX}${userId}:sockets`);
  }
};
