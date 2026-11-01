import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { ENV } from '../../config/env.js';

let redisClient;

export async function initRedis() {
  return new Promise((resolve) => {
    const realClient = new Redis({
      host: ENV.REDIS_HOST,
      port: ENV.REDIS_PORT,
      password: ENV.REDIS_PASSWORD,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 2) return null; // do not endlessly retry if no local redis daemon
        return 500;
      },
      enableOfflineQueue: false,
    });

    let settled = false;

    realClient.on('connect', () => {
      if (!settled) {
        settled = true;
        console.log(`[Redis] Connected to Redis server at ${ENV.REDIS_HOST}:${ENV.REDIS_PORT}`);
        redisClient = realClient;
        resolve(redisClient);
      }
    });

    realClient.on('error', (err) => {
      if (!settled) {
        settled = true;
        console.warn(`[Redis] Cannot connect to Redis (${err.message}). Using high-performance in-memory Redis fallback.`);
        realClient.disconnect();
        redisClient = new RedisMock();
        resolve(redisClient);
      }
    });

    // Timeout safety
    setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn('[Redis] Connection timed out. Falling back to in-memory Redis mock.');
        try { realClient.disconnect(); } catch (e) {}
        redisClient = new RedisMock();
        resolve(redisClient);
      }
    }, 1500);
  });
}

export function getRedisClient() {
  if (!redisClient) {
    redisClient = new RedisMock();
  }
  return redisClient;
}
