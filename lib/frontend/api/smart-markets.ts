/**
 * Smart Markets API (frontend mock)
 *
 * In production this would call a backend endpoint to fetch
 * active smart markets/DEX integrations configured from the admin.
 * Here we mimic that behaviour with a small async helper.
 */

export interface SmartMarket {
  id: string;
  name: string;
  icon: string;
  chainIds?: number[];
  isActive?: boolean;
  order?: number;
}

// Simulated backend fetch
export async function fetchSmartMarkets(): Promise<SmartMarket[]> {
  // Simulate small network delay
  await new Promise((resolve) => setTimeout(resolve, 150));

  return [
    { id: "uniswap", name: "Uniswap", icon: "https://www.figma.com/api/mcp/asset/c3b94ae2-a8be-4374-bf08-f085f21df47f", isActive: true, order: 1 },
    { id: "balancer", name: "Balancer", icon: "https://www.figma.com/api/mcp/asset/05125102-2c5e-427a-b230-4f596397b0b8", isActive: true, order: 2 },
    { id: "pancakeswap", name: "Pancake Swap", icon: "https://www.figma.com/api/mcp/asset/ea56379a-c885-469a-8285-653c6afa7804", isActive: true, order: 3 },
    { id: "trader-joe", name: "Trader Joe", icon: "https://www.figma.com/api/mcp/asset/6d5c202d-1a20-4f60-9030-6d78ca81c404", isActive: true, order: 4 },
    { id: "sushiswap", name: "Sushiswap", icon: "https://www.figma.com/api/mcp/asset/20aa4546-c2f8-4c25-82ef-1b30ef0a14ee", isActive: true, order: 5 },
    { id: "curve-finance", name: "Curve Finance", icon: "https://www.figma.com/api/mcp/asset/23f135ea-ac80-4770-bd28-5b5e060407c7", isActive: true, order: 6 },
    { id: "raydium", name: "Raydium", icon: "https://www.figma.com/api/mcp/asset/ab7ae506-8c06-4d91-8af0-0965fc96da42", isActive: true, order: 7 },
  ].filter(market => market.isActive).sort((a, b) => (a.order || 0) - (b.order || 0));
}

