interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  flush(): Promise<void>;
}

class MemoryCache implements CacheProvider {
  private store = new Map<string, { value: unknown; expires: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expires && entry.expires < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl = 300): Promise<void> {
    this.store.set(key, {
      value,
      expires: Date.now() + ttl * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async flush(): Promise<void> {
    this.store.clear();
  }
}

class CacheManager {
  private provider: CacheProvider;

  constructor(provider?: CacheProvider) {
    this.provider = provider || new MemoryCache();
  }

  async get<T>(key: string): Promise<T | null> {
    return this.provider.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    return this.provider.set(key, value, ttl);
  }

  async delete(key: string): Promise<void> {
    return this.provider.delete(key);
  }

  async flush(): Promise<void> {
    return this.provider.flush();
  }

  key(parts: string[]): string {
    return parts.join(":");
  }
}

export const cache = new CacheManager();
export { CacheManager, MemoryCache };
export type { CacheProvider };
