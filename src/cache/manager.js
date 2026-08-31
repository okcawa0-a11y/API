const NodeCache = require('node-cache');
const cache = new NodeCache({ 
  stdTTL: 3600, // 1 hour default
  checkperiod: 600,
  useClones: false 
});

class CacheManager {
  get(key) {
    return cache.get(key);
  }

  set(key, value, ttl = 3600) {
    return cache.set(key, value, ttl);
  }

  del(key) {
    return cache.del(key);
  }

  flush() {
    cache.flushAll();
  }

  keys() {
    return cache.keys();
  }

  stats() {
    return {
      keys: cache.keys().length,
      hits: cache.stats.hits,
      misses: cache.stats.misses
    };
  }
}

module.exports = new CacheManager();