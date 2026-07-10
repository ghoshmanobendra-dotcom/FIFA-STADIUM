/**
 * Minimal in-memory TTL cache with a bounded size (approximate LRU by
 * insertion order). Used to memoise identical GenAI completions, cutting
 * latency and provider cost for repeated questions during a match — a real
 * efficiency win given thousands of fans ask the same things ("where are the
 * toilets?") at once.
 */
export class TtlCache {
  /** @param {{ ttlMs?: number, max?: number }} [opts] */
  constructor({ ttlMs = 5 * 60_000, max = 500 } = {}) {
    this.ttlMs = ttlMs;
    this.max = max;
    /** @type {Map<string, { value: any, expires: number }>} */
    this.store = new Map();
  }

  /** @param {string} key */
  get(key) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh recency.
    this.store.delete(key);
    this.store.set(key, hit);
    return hit.value;
  }

  /** @param {string} key @param {any} value */
  set(key, value) {
    if (this.store.size >= this.max) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  get size() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }
}

export default TtlCache;
