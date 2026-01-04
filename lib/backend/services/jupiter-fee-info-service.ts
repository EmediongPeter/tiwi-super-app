/**
 * Jupiter Fee Info Service
 * 
 * Fetches fee information from Jupiter's /fees endpoint.
 * Used to display fee breakdown to users before swap execution.
 */

/**
 * Jupiter fee information response
 */
export interface JupiterFeeInfo {
  feeBps: number;
  category?: string;
  feeMint?: string;
}

/**
 * Jupiter Fee Info Service
 * Handles fee information fetching from Jupiter Ultra API
 */
export class JupiterFeeInfoService {
  private apiKey: string;
  private ultraApiBase = 'https://api.jup.ag/ultra/v1';
  
  constructor() {
    this.apiKey = process.env.JUPITER_API_KEY || process.env.NEXT_PUBLIC_JUPITER_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[JupiterFeeInfoService] JUPITER_API_KEY not configured. Fee info will not be available.');
    }
  }
  
  /**
   * Get fee information for a token pair
   * Returns Jupiter's default fees and category
   */
  async getFeeInfo(
    inputMint: string,
    outputMint: string
  ): Promise<JupiterFeeInfo | null> {
    if (!this.apiKey) {
      return null; // Can't fetch without API key
    }
    
    try {
      const url = `${this.ultraApiBase}/fees?inputMint=${inputMint}&outputMint=${outputMint}`;
      
      const response = await fetch(url, {
        headers: {
          'x-api-key': this.apiKey,
        },
      });
      
      if (!response.ok) {
        console.warn(`[JupiterFeeInfoService] Failed to fetch fee info: ${response.statusText}`);
        return null;
      }
      
      const data = await response.json();
      
      return {
        feeBps: data.feeBps || 10, // Default 10 bps if not provided
        category: data.category,
        feeMint: data.feeMint,
      };
    } catch (error) {
      console.error('[JupiterFeeInfoService] Error fetching fee info:', error);
      return null;
    }
  }
  
  /**
   * Calculate total fees for a swap
   * Includes: Jupiter default fees + Tiwi protocol fee
   */
  async calculateTotalFees(
    inputMint: string,
    outputMint: string,
    fromAmountUSD: number
  ): Promise<{
    jupiterFeeBps: number;
    jupiterFeeUSD: number;
    tiwiFeeBps: number;
    tiwiFeeUSD: number;
    totalFeeBps: number;
    totalFeeUSD: number;
  } | null> {
    const feeInfo = await this.getFeeInfo(inputMint, outputMint);
    
    if (!feeInfo) {
      // Fallback to default fees if API call fails
      return {
        jupiterFeeBps: 10, // Default 10 bps
        jupiterFeeUSD: (fromAmountUSD * 10) / 10000,
        tiwiFeeBps: 31, // 31 bps = 0.25% net after 20% cut
        tiwiFeeUSD: (fromAmountUSD * 31) / 10000,
        totalFeeBps: 41,
        totalFeeUSD: (fromAmountUSD * 41) / 10000,
      };
    }
    
    // Jupiter's default fee (from response)
    const jupiterFeeBps = feeInfo.feeBps || 10;
    const jupiterFeeUSD = (fromAmountUSD * jupiterFeeBps) / 10000;
    
    // Tiwi protocol fee (31 bps to get 0.25% net after Jupiter's 20% cut)
    const tiwiFeeBps = 31;
    const tiwiFeeUSD = (fromAmountUSD * tiwiFeeBps) / 10000;
    
    // Total fees
    const totalFeeBps = jupiterFeeBps + tiwiFeeBps;
    const totalFeeUSD = jupiterFeeUSD + tiwiFeeUSD;
    
    return {
      jupiterFeeBps,
      jupiterFeeUSD,
      tiwiFeeBps,
      tiwiFeeUSD,
      totalFeeBps,
      totalFeeUSD,
    };
  }
}

// Singleton instance
let feeInfoServiceInstance: JupiterFeeInfoService | null = null;

/**
 * Get singleton JupiterFeeInfoService instance
 */
export function getJupiterFeeInfoService(): JupiterFeeInfoService {
  if (!feeInfoServiceInstance) {
    feeInfoServiceInstance = new JupiterFeeInfoService();
  }
  return feeInfoServiceInstance;
}

