import IORedis from 'ioredis';

const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// 'api' fails fast when Redis is down; 'worker' keeps waiting and reconnecting
// (BullMQ requires maxRetriesPerRequest: null for workers)
export function createConnection(role = 'api') {
  return new IORedis(
    url,
    role === 'worker' ? { maxRetriesPerRequest: null } : { enableOfflineQueue: false }
  );
}