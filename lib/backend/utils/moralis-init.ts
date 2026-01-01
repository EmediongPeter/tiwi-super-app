/**
 * Moralis Initialization Utility
 * 
 * Centralized Moralis initialization to avoid duplicate initializations.
 * This ensures Moralis is initialized only once across the application.
 */

import Moralis from 'moralis';
import { getCurrentApiKey, getCurrentKeyIndex, markKeyAsExhausted, rotateToNextKey } from './moralis-key-manager';

// ============================================================================
// Initialization State
// ============================================================================

let initializationPromise: Promise<void> | null = null;
let isInitialized = false;
let currentApiKey: string | null = null;

// ============================================================================
// Initialization Function
// ============================================================================

/**
 * Initialize Moralis SDK
 * This function is idempotent - safe to call multiple times
 * 
 * @param forceReinit - Force re-initialization with a new API key (for key rotation)
 */
export async function initializeMoralis(forceReinit: boolean = false): Promise<void> {
  // If already initialized and not forcing reinit, return early
  if (isInitialized && !forceReinit && currentApiKey === getCurrentApiKey()) {
    return;
  }
  
  const apiKey = getCurrentApiKey();
  const wasInitialized = isInitialized;
  
  // If forcing reinit, reset state
  if (forceReinit) {
    isInitialized = false;
    initializationPromise = null;
    try {
      // Try to stop Moralis if it's running (Moralis doesn't have a stop method, so we'll just reset state)
      currentApiKey = null;
    } catch (error) {
      // Ignore errors when stopping
    }
  }
  
  // If there's an ongoing initialization, wait for it
  if (initializationPromise && !forceReinit) {
    return initializationPromise;
  }
  
  initializationPromise = (async () => {
    try {
      // CRITICAL: Moralis SDK doesn't support changing API keys after initialization
      // If we're forcing reinit and Moralis was already initialized, update the API key in Core
      if (forceReinit && wasInitialized) {
        try {
          // Access Moralis internal Core to update API key in all places
          // @ts-ignore - Accessing internal Moralis Core state
          const Core = (Moralis as any).Core;
          if (Core) {
            // Update the main config
            // @ts-ignore
            if (Core.config) {
              // @ts-ignore
              Core.config.apiKey = apiKey;
            }
            
            // Update in all modules
            // @ts-ignore
            if (Core.modules) {
              // @ts-ignore
              Object.values(Core.modules).forEach((module: any) => {
                if (module) {
                  // Update module config
                  // @ts-ignore
                  if (module.config) {
                    // @ts-ignore
                    module.config.apiKey = apiKey;
                  }
                  // Update module's API key property if it exists
                  // @ts-ignore
                  if (module.apiKey !== undefined) {
                    // @ts-ignore
                    module.apiKey = apiKey;
                  }
                  // Update HTTP client if it exists
                  // @ts-ignore
                  if (module.requestClient) {
                    // @ts-ignore
                    if (module.requestClient.config) {
                      // @ts-ignore
                      module.requestClient.config.apiKey = apiKey;
                    }
                    // @ts-ignore
                    if (module.requestClient.defaults?.headers) {
                      // @ts-ignore
                      module.requestClient.defaults.headers['x-api-key'] = apiKey;
                    }
                  }
                }
              });
            }
            
            console.log(`[MoralisInit] Updated API key in Moralis Core to key ${getCurrentKeyIndex() + 1}`);
            // Update our tracking
            currentApiKey = apiKey;
            isInitialized = true;
            return; // Skip reinitialization, just update the key
          }
        } catch (updateError) {
          console.warn('[MoralisInit] Could not update API key in Core, will attempt full reset:', updateError);
          // Reset state and fall through to full reinitialization
          isInitialized = false;
          currentApiKey = null;
        }
      }
      
      console.log(`[MoralisInit] Initializing with API key ${getCurrentKeyIndex() + 1} (${apiKey.substring(0, 20)}...)`);
      
      // Initialize or reinitialize Moralis
      await Moralis.start({
        apiKey: apiKey,
      });
      isInitialized = true;
      currentApiKey = apiKey;
      console.log(`[MoralisInit] Moralis initialized successfully with key ${getCurrentKeyIndex() + 1}`);
    } catch (error: any) {
      // Handle "already initialized" errors gracefully
      if (error?.message?.includes('Modules are started already') || 
          error?.message?.includes('C0009') ||
          error?.code === 'C0009') {
        isInitialized = true;
        currentApiKey = apiKey;
        console.log('[MoralisInit] Moralis already initialized (concurrent call handled)');
      } else {
        console.error('[MoralisInit] Error initializing Moralis:', error);
        initializationPromise = null;
        throw error;
      }
    }
  })();
  
  return initializationPromise;
}

/**
 * Reinitialize Moralis with the next available API key
 * Called when rate limit is hit on current key
 */
export async function reinitializeWithNextKey(): Promise<boolean> {
  const currentIndex = getCurrentKeyIndex();
  
  // Mark current key as exhausted
  markKeyAsExhausted(currentIndex);
  
  // Get next available key
  const nextKey = rotateToNextKey();
  
  if (!nextKey) {
    console.error('[MoralisInit] No more API keys available. All keys exhausted.');
    return false;
  }
  
  // Reinitialize with new key
  try {
    await initializeMoralis(true);
    console.log(`[MoralisInit] Successfully reinitialized with key ${getCurrentKeyIndex() + 1}`);
    return true;
  } catch (error) {
    console.error('[MoralisInit] Failed to reinitialize with next key:', error);
    return false;
  }
}

/**
 * Get Moralis instance (ensures initialization)
 */
export async function getMoralis(): Promise<typeof Moralis> {
  await initializeMoralis();
  return Moralis;
}

