/**
 * Graph Updater
 * 
 * Background service to periodically update liquidity graphs.
 */

import { getGraphBuilder } from './graph-builder';

/**
 * Graph Updater Service
 * 
 * Manages periodic updates of liquidity graphs.
 */
export class GraphUpdater {
  private updateInterval: NodeJS.Timeout | null = null;
  private isUpdating: boolean = false;
  
  /**
   * Start periodic graph updates
   * 
   * @param intervalMinutes - Update interval in minutes (default: 5)
   */
  start(intervalMinutes: number = 5): void {
    // Update immediately
    this.updateAllGraphs();
    
    // Then update periodically
    this.updateInterval = setInterval(() => {
      this.updateAllGraphs();
    }, intervalMinutes * 60 * 1000);
    
    console.log(`[GraphUpdater] Started with ${intervalMinutes} minute interval`);
  }
  
  /**
   * Stop periodic updates
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('[GraphUpdater] Stopped');
    }
  }
  
  /**
   * Update all graphs
   */
  private async updateAllGraphs(): Promise<void> {
    if (this.isUpdating) {
      console.log('[GraphUpdater] Update already in progress, skipping...');
      return;
    }
    
    this.isUpdating = true;
    const chains = [1, 56, 137, 42161, 10, 8453]; // Supported chains
    const graphBuilder = getGraphBuilder();
    
    console.log(`[GraphUpdater] Starting graph update for ${chains.length} chains...`);
    
    // Update chains in parallel (but limit concurrency)
    const updatePromises = chains.map(async (chainId) => {
      try {
        const result = await graphBuilder.buildGraph(chainId);
        console.log(`[GraphUpdater] Updated graph for chain ${chainId}: ${result.pairsTotal} pairs, ${result.pairsUpdated} updated`);
        return { chainId, success: true, result };
      } catch (error: any) {
        console.error(`[GraphUpdater] Error updating chain ${chainId}:`, error);
        return { chainId, success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(updatePromises);
    const successful = results.filter(r => r.success).length;
    
    console.log(`[GraphUpdater] Update complete: ${successful}/${chains.length} chains updated successfully`);
    
    this.isUpdating = false;
  }
  
  /**
   * Force immediate update
   */
  async forceUpdate(): Promise<void> {
    await this.updateAllGraphs();
  }
  
  /**
   * Check if updater is running
   */
  isRunning(): boolean {
    return this.updateInterval !== null;
  }
}

// Singleton instance
let graphUpdaterInstance: GraphUpdater | null = null;

/**
 * Get singleton GraphUpdater instance
 */
export function getGraphUpdater(): GraphUpdater {
  if (!graphUpdaterInstance) {
    graphUpdaterInstance = new GraphUpdater();
  }
  return graphUpdaterInstance;
}

/**
 * Start graph updater (call this on app startup)
 * 
 * @param intervalMinutes - Update interval in minutes (default: 5)
 */
export function startGraphUpdater(intervalMinutes: number = 5): GraphUpdater {
  const updater = getGraphUpdater();
  if (!updater.isRunning()) {
    updater.start(intervalMinutes);
  }
  return updater;
}

