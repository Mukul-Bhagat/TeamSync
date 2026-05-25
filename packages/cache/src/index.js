class MemoryCache {
    store = new Map();
    async get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return null;
        if (entry.expires && entry.expires < Date.now()) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }
    async set(key, value, ttl = 300) {
        this.store.set(key, {
            value,
            expires: Date.now() + ttl * 1000,
        });
    }
    async delete(key) {
        this.store.delete(key);
    }
    async flush() {
        this.store.clear();
    }
}
class CacheManager {
    provider;
    constructor(provider) {
        this.provider = provider || new MemoryCache();
    }
    async get(key) {
        return this.provider.get(key);
    }
    async set(key, value, ttl) {
        return this.provider.set(key, value, ttl);
    }
    async delete(key) {
        return this.provider.delete(key);
    }
    async flush() {
        return this.provider.flush();
    }
    key(parts) {
        return parts.join(":");
    }
}
export const cache = new CacheManager();
export { CacheManager, MemoryCache };
