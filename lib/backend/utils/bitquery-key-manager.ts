/**
 * Bitquery API Key Manager
 * 
 * Manages multiple Bitquery API keys with automatic rotation when rate limits are hit.
 * Tracks exhausted keys and rotates to the next available key.
 * Similar to MoralisKeyManager pattern.
 */

// ============================================================================
// API Key Configuration
// ============================================================================

/**
 * Filter out undefined/null keys and ensure we have at least one valid key
 */
function getValidKeys(): string[] {
  // Dynamically collect Bitquery API keys from environment variables: BITQUERY_API_KEY_1, _2, _3, ...
  const keys: string[] = [];
  let i = 1;
  while (true) {
    const key = process.env[`BITQUERY_API_KEY_${i}` as const];
    if (typeof key === 'undefined') break;
    if (key && typeof key === 'string' && key.trim()) {
      keys.push(key);
    }
    i += 1;
  }
  if (keys.length === 0) {
    throw new Error('[BitqueryKeyManager] No valid API keys provided. Set BITQUERY_API_KEY_1, BITQUERY_API_KEY_2, etc.');
  }
  
  return keys;
}

const BITQUERY_API_KEYS: string[] = getValidKeys();

// ============================================================================
// Key State Management
// ============================================================================

/**
 * Track which keys have been exhausted (hit rate limit)
 * Reset on server restart
 */
const exhaustedKeys = new Set<number>();

/**
 * Current active key index
 */
let currentKeyIndex = 0;

// ============================================================================
// Key Management Functions
// ============================================================================

/**
 * Get the current active API key
 */
export function getCurrentApiKey(): string {
  return BITQUERY_API_KEYS[currentKeyIndex];
}

/**
 * Get all available API keys
 */
export function getAllApiKeys(): string[] {
  return [...BITQUERY_API_KEYS];
}

/**
 * Check if a key is exhausted (hit rate limit)
 */
export function isKeyExhausted(keyIndex: number): boolean {
  return exhaustedKeys.has(keyIndex);
}

/**
 * Mark a key as exhausted (hit rate limit)
 */
export function markKeyAsExhausted(keyIndex: number): void {
  exhaustedKeys.add(keyIndex);
  console.warn(`[BitqueryKeyManager] Marked API key ${keyIndex + 1} as exhausted (rate limit hit)`);
}

/**
 * Get the next available API key index
 * Returns null if all keys are exhausted
 */
export function getNextAvailableKeyIndex(): number | null {
  // Try current key first (might have been reset)
  if (!exhaustedKeys.has(currentKeyIndex)) {
    return currentKeyIndex;
  }
  
  // Find next available key
  for (let i = 0; i < BITQUERY_API_KEYS.length; i++) {
    const nextIndex = (currentKeyIndex + i + 1) % BITQUERY_API_KEYS.length;
    if (!exhaustedKeys.has(nextIndex)) {
      return nextIndex;
    }
  }
  
  // All keys exhausted
  return null;
}

/**
 * Rotate to the next available API key
 * Returns the new API key, or null if all keys are exhausted
 */
export function rotateToNextKey(): string | null {
  const nextIndex = getNextAvailableKeyIndex();
  
  if (nextIndex === null) {
    console.error('[BitqueryKeyManager] All API keys exhausted. Please add more keys or upgrade plan.');
    return null;
  }
  
  if (nextIndex !== currentKeyIndex) {
    console.log(`[BitqueryKeyManager] Rotating from key ${currentKeyIndex + 1} to key ${nextIndex + 1}`);
    currentKeyIndex = nextIndex;
  }
  
  return BITQUERY_API_KEYS[currentKeyIndex];
}

/**
 * Check if error is a rate limit error
 * Bitquery typically returns 429 (Too Many Requests) or 401 (Unauthorized) for rate limits
 * Also checks for points limit errors
 */
export function isRateLimitError(error: any): boolean {
  // Check for HTTP status codes
  const status = error?.response?.status || error?.status || error?.statusCode;
  
  if (status === 429 || status === 401) {
    return true;
  }
  
  // Check error message for rate limit indicators
  const message = (error?.message || '').toLowerCase();
  const errorMessage = (error?.error?.message || '').toLowerCase();
  const responseText = (error?.responseText || error?.response || '').toLowerCase();
  
  // Check for points limit (should be treated as rate limit for key rotation)
  const pointsLimitIndicators = [
    'points limit',
    'points lim',
    'quota exceeded',
    'usage limit',
    'quota limit',
  ];
  
  const hasPointsLimit = pointsLimitIndicators.some(indicator => 
    message.includes(indicator) || 
    errorMessage.includes(indicator) ||
    responseText.includes(indicator)
  );
  
  if (hasPointsLimit) {
    return true;
  }
  
  // Check for rate limit indicators
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests')
  ) {
    return true;
  }
  
  // Check for GraphQL errors
  if (error?.errors && Array.isArray(error.errors)) {
    const hasRateLimitError = error.errors.some((err: any) => {
      const errMsg = (err.message || '').toLowerCase();
      return (
        errMsg.includes('rate limit') || 
        errMsg.includes('quota') || 
        errMsg.includes('usage limit') ||
        errMsg.includes('points limit') ||
        errMsg.includes('points lim')
      );
    });
    if (hasRateLimitError) return true;
  }
  
  // Check response object for errors
  if (error?.response?.errors && Array.isArray(error.response.errors)) {
    const hasRateLimitError = error.response.errors.some((err: any) => {
      const errMsg = (err.message || '').toLowerCase();
      return (
        errMsg.includes('rate limit') || 
        errMsg.includes('quota') || 
        errMsg.includes('usage limit') ||
        errMsg.includes('points limit') ||
        errMsg.includes('points lim')
      );
    });
    if (hasRateLimitError) return true;
  }
  
  return false;
}

/**
 * Get current key index (for debugging)
 */
export function getCurrentKeyIndex(): number {
  return currentKeyIndex;
}

/**
 * Get count of exhausted keys
 */
export function getExhaustedKeysCount(): number {
  return exhaustedKeys.size;
}

/**
 * Reset exhausted keys (for testing or manual reset)
 */
export function resetExhaustedKeys(): void {
  exhaustedKeys.clear();
  console.log('[BitqueryKeyManager] Reset all exhausted keys');
}

