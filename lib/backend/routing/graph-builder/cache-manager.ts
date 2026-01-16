/**
 * Cache Manager
 * 
 * Manages tiered caching for liquidity graph data.
 * This implementation uses in-memory caching initially (Redis can be added later).
 */

import type { PairEdge, TokenNode, CacheTierConfig } from '../types';

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Cache Manager for tiered caching
 * 
 * Tiers:
 * - Hot: In-memory, fast access, small size
 * - Warm: Redis (optional), medium access, medium size
 * - Cold: Database (optional), slow access, large size
 */
export class CacheManager {
  private hotCache: Map<string, CacheEntry<PairEdge | TokenNode>> = new Map();
  private config: CacheTierConfig;
  private maxHotCacheSize: number;
  
  constructor(config?: Partial<CacheTierConfig>) {
    this.config = {
      hot: {
        enabled: true,
        ttl: 300, // 5 minutes
        maxSize: 10000, // 10k pairs
      },
      warm: {
        enabled: false, // Redis not implemented yet
        ttl: 900, // 15 minutes
        provider: 'memory',
      },
      cold: {
        enabled: false, // Database not implemented yet
        ttl: 86400, // 24 hours
        provider: 'memory',
      },
      ...config,
    };
    
    this.maxHotCacheSize = this.config.hot.maxSize;
  }
  
  /**
   * Get from hot cache
   */
  getHot(key: string): PairEdge | TokenNode | null {
    if (!this.config.hot.enabled) {
      return null;
    }
    
    const entry = this.hotCache.get(key);
    if (!entry) {
      return null;
    }
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.hotCache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Set in hot cache
   */
  setHot(key: string, data: PairEdge | TokenNode): void {
    if (!this.config.hot.enabled) {
      return;
    }
    
    // Evict oldest entries if cache is full
    if (this.hotCache.size >= this.maxHotCacheSize) {
      this.evictOldestHot();
    }
    
    const expiresAt = Date.now() + (this.config.hot.ttl * 1000);
    this.hotCache.set(key, { data, expiresAt });
  }
  
  /**
   * Check if key exists in hot cache
   */
  hasHot(key: string): boolean {
    if (!this.config.hot.enabled) {
      return false;
    }
    
    const entry = this.hotCache.get(key);
    if (!entry) {
      return false;
    }
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.hotCache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Clear hot cache
   */
  clearHot(): void {
    this.hotCache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    hotSize: number;
    hotMaxSize: number;
    hotHitRate: number; // Will be calculated by usage tracking
  } {
    return {
      hotSize: this.hotCache.size,
      hotMaxSize: this.maxHotCacheSize,
      hotHitRate: 0, // TODO: Implement hit rate tracking
    };
  }
  
  /**
   * Evict oldest entries from hot cache
   */
  private evictOldestHot(): void {
    // Remove 10% of oldest entries
    const entriesToRemove = Math.floor(this.maxHotCacheSize * 0.1);
    const entries = Array.from(this.hotCache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
      .slice(0, entriesToRemove);
    
    for (const [key] of entries) {
      this.hotCache.delete(key);
    }
  }
  
  /**
   * Clean expired entries from hot cache
   */
  cleanExpired(): number {
    let cleaned = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.hotCache.entries()) {
      if (now > entry.expiresAt) {
        this.hotCache.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

