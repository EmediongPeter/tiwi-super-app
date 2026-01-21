# Phase 4: NFT Features - Implementation Plan

## Overview
Implement comprehensive NFT features to display user's NFT collection with detailed information including floor price, total volume, owners, creation date, and recent activities. This will replace the current mock NFT data in the portfolio page.

## Requirements Analysis (Based on Screenshot)

### NFT Grid View (Left Panel)
- **Display:** NFT thumbnail images in grid layout
- **Info Shown:**
  - NFT name
  - Floor price (e.g., "6.10 ETH" or "0 ETH")
  - Clickable to view details

### NFT Detail View (Right Panel)
- **Basic Info:**
  - Large NFT image
  - NFT name with verification checkmark
  - Creator name (e.g., "By Alien Amphibian_deployer")
  
- **Statistics (Required):**
  1. **Total Volume** (e.g., "1.2M ETH")
  2. **Owners** (e.g., "5,320")
  3. **Floor Price** (e.g., "6.10 ETH")
  4. **Chain** (e.g., "Ethereum")
  5. **Listed** (e.g., "3.05%")
  6. **Creation Date** (e.g., "April 2025")
  
- **Recent Activities:**
  - Activity type (e.g., "Received")
  - Date (e.g., "Jan 4, 2024")
  - NFT name
  - Price when received (e.g., "$725.00")

## Moralis API Endpoints Research

### 1. Get Wallet NFTs
**Endpoint:** `GET /{address}/nft`
**Documentation:** https://docs.moralis.com/web3-data-api/evm/reference/get-wallet-nfts

**Returns:**
```typescript
{
  total: number;
  page: number;
  page_size: number;
  cursor: string;
  result: Array<{
    token_address: string;      // Contract address
    token_id: string;           // Token ID
    amount: string;              // Quantity (for ERC1155)
    owner_of: string;            // Current owner
    token_hash: string;          // Unique hash
    block_number_minted: string; // Block when minted
    block_number: string;        // Current block
    contract_type: string;       // "ERC721" or "ERC1155"
    name: string;                // NFT name
    symbol: string;              // Collection symbol
    token_uri?: string;          // Metadata URI
    metadata?: {
      name?: string;
      description?: string;
      image?: string;
      attributes?: Array<{
        trait_type: string;
        value: string | number;
      }>;
    };
    last_token_uri_sync?: string;
    last_metadata_sync?: string;
    minter_address?: string;     // Creator address
  }>;
}
```

**Query Parameters:**
- `chain`: Chain name (eth, polygon, bsc, etc.)
- `format`: "decimal" (recommended)
- `limit`: Number of results (default: 100, max: 100)
- `cursor`: Pagination cursor
- `normalize_metadata`: true/false (normalize metadata format)

### 2. Get NFT Collection Metadata
**Endpoint:** `GET /nft/{address}/metadata`
**Documentation:** https://docs.moralis.com/web3-data-api/evm/reference/get-nft-metadata

**Returns:**
```typescript
{
  token_address: string;
  name: string;
  symbol: string;
  contract_type: string;
  synced_at?: string;
  // Note: Floor price and volume may require external APIs (OpenSea, Reservoir, etc.)
}
```

**Important:** Moralis does NOT directly provide:
- ❌ Floor price
- ❌ Total volume
- ❌ Number of owners
- ❌ Listed percentage

**Solution:** We'll need to:
1. Use Moralis for basic NFT data
2. Integrate with OpenSea API or Reservoir API for market data
3. Or calculate from transfer history

### 3. Get NFT Transfers
**Endpoint:** `GET /{address}/nft/transfers`
**Documentation:** https://docs.moralis.com/web3-data-api/evm/reference/get-wallet-nft-transfers

**Returns:**
```typescript
{
  total: number;
  page: number;
  page_size: number;
  cursor: string;
  result: Array<{
    token_address: string;
    token_id: string;
    from_address: string;
    to_address: string;
    value?: string;              // Transfer value (if ERC1155)
    amount?: string;             // Amount transferred
    contract_type: string;
    block_number: string;
    block_timestamp: string;     // ISO 8601 format
    transaction_hash: string;
    transaction_type: string;    // "Single" or "Batch"
    operator?: string;
  }>;
}
```

**Query Parameters:**
- `chain`: Chain name
- `format`: "decimal"
- `limit`: Number of results
- `cursor`: Pagination cursor
- `direction`: "both" | "to" | "from" (filter transfers)

### 4. Alternative: OpenSea API for Market Data

**For Floor Price, Volume, Owners:**
- **OpenSea API v2:** https://docs.opensea.io/reference/api-overview
- **Endpoint:** `GET /api/v2/collection/{collection_slug}/stats`
- **Returns:**
  ```typescript
  {
    total_volume: number;        // Total volume in ETH
    floor_price: number;         // Floor price in ETH
    num_owners: number;          // Number of unique owners
    total_supply: number;        // Total NFTs in collection
    listed_count?: number;      // Number of listed NFTs
  }
  ```

**Limitations:**
- Requires OpenSea API key (free tier available)
- Only works for collections listed on OpenSea
- Rate limits apply

### 5. Alternative: Reservoir API (Recommended)

**Reservoir API:** https://docs.reservoir.tools/
- **Free tier available**
- **Multi-marketplace data** (OpenSea, LooksRare, X2Y2, etc.)
- **Better coverage** than OpenSea alone

**Endpoints:**
- `GET /collections/v5` - Collection stats
- `GET /tokens/v5` - Token details
- `GET /transfers/v3` - Transfer history

## Implementation Plan

### Phase 4.1: Backend - NFT Data Fetching

#### Step 1: Create NFT Types
**File:** `lib/backend/types/nft.ts` (NEW)

```typescript
export interface NFT {
  // Basic Info
  contractAddress: string;
  tokenId: string;
  name: string;
  description?: string;
  image?: string;
  imageThumbnail?: string;
  chainId: number;
  
  // Collection Info
  collectionName?: string;
  collectionSymbol?: string;
  contractType: 'ERC721' | 'ERC1155';
  
  // Ownership
  owner: string;
  amount?: string; // For ERC1155
  
  // Minting Info
  minterAddress?: string;
  blockNumberMinted?: string;
  blockTimestampMinted?: number; // Unix timestamp
  
  // Metadata
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  
  // Market Data (from OpenSea/Reservoir)
  floorPrice?: string;        // In ETH
  floorPriceUSD?: string;     // In USD
  totalVolume?: string;       // In ETH
  totalVolumeUSD?: string;   // In USD
  owners?: number;            // Number of unique owners
  listed?: number;            // Number of listed NFTs
  listedPercentage?: number;  // Percentage listed
  supply?: number;            // Total supply
}

export interface NFTCollection {
  contractAddress: string;
  name: string;
  symbol: string;
  chainId: number;
  
  // Market Stats
  floorPrice?: string;
  floorPriceUSD?: string;
  totalVolume?: string;
  totalVolumeUSD?: string;
  owners?: number;
  listed?: number;
  listedPercentage?: number;
  supply?: number;
  
  // Metadata
  description?: string;
  image?: string;
  externalUrl?: string;
}

export interface NFTTransfer {
  contractAddress: string;
  tokenId: string;
  from: string;
  to: string;
  transactionHash: string;
  blockNumber: string;
  blockTimestamp: number; // Unix timestamp
  value?: string;         // Transfer value (if ERC1155)
  amount?: string;        // Amount transferred
  type: 'received' | 'sent' | 'mint' | 'burn';
  priceUSD?: string;      // Price when transferred (if available)
}

export interface NFTActivity {
  type: 'received' | 'sent' | 'mint' | 'burn' | 'list' | 'sale';
  date: string;           // Formatted date (e.g., "Jan 4, 2024")
  timestamp: number;      // Unix timestamp
  nftName: string;
  price?: string;         // Price in ETH
  priceUSD?: string;      // Price in USD
  from?: string;
  to?: string;
  transactionHash: string;
}
```

#### Step 2: Create NFT REST Client Functions
**File:** `lib/backend/providers/moralis-rest-client.ts` (UPDATE)

**Add Functions:**
```typescript
/**
 * Get wallet NFTs
 * Endpoint: GET /{address}/nft
 */
export async function getWalletNFTs(
  address: string,
  chainId: number,
  options?: {
    limit?: number;
    cursor?: string;
    normalizeMetadata?: boolean;
  }
): Promise<any> {
  const chainName = getChainName(chainId);
  return makeMoralisRequest(
    `/${address}/nft`,
    {
      params: {
        chain: chainName,
        format: 'decimal',
        limit: options?.limit || 100,
        normalize_metadata: options?.normalizeMetadata !== false,
        ...(options?.cursor && { cursor: options.cursor }),
      },
      cacheKey: `nfts:${chainId}:${address.toLowerCase()}:${options?.limit || 100}`,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
    }
  );
}

/**
 * Get NFT collection metadata
 * Endpoint: GET /nft/{address}/metadata
 */
export async function getNFTCollectionMetadata(
  contractAddress: string,
  chainId: number
): Promise<any> {
  const chainName = getChainName(chainId);
  return makeMoralisRequest(
    `/nft/${contractAddress}/metadata`,
    {
      params: {
        chain: chainName,
      },
      cacheKey: `nft-metadata:${chainId}:${contractAddress.toLowerCase()}`,
      cacheTTL: 60 * 60 * 1000, // 1 hour (metadata rarely changes)
    }
  );
}

/**
 * Get NFT transfers for a wallet
 * Endpoint: GET /{address}/nft/transfers
 */
export async function getNFTTransfers(
  address: string,
  chainId: number,
  options?: {
    limit?: number;
    cursor?: string;
    direction?: 'both' | 'to' | 'from';
    contractAddress?: string; // Filter by contract
  }
): Promise<any> {
  const chainName = getChainName(chainId);
  return makeMoralisRequest(
    `/${address}/nft/transfers`,
    {
      params: {
        chain: chainName,
        format: 'decimal',
        limit: options?.limit || 100,
        direction: options?.direction || 'both',
        ...(options?.cursor && { cursor: options.cursor }),
        ...(options?.contractAddress && { 
          token_addresses: [options.contractAddress] 
        }),
      },
      cacheKey: `nft-transfers:${chainId}:${address.toLowerCase()}:${options?.limit || 100}`,
      cacheTTL: 2 * 60 * 1000, // 2 minutes
    }
  );
}
```

#### Step 3: Create Market Data Provider (OpenSea/Reservoir)
**File:** `lib/backend/providers/market-data-provider.ts` (NEW)

**Purpose:** Fetch floor price, volume, owners, listed count from marketplaces

**Options:**
1. **OpenSea API** (simpler, but limited to OpenSea)
2. **Reservoir API** (better, multi-marketplace)

**Recommendation:** Start with Reservoir API (free tier, better coverage)

```typescript
/**
 * Market Data Provider
 * Fetches NFT market data (floor price, volume, owners) from Reservoir API
 */

const RESERVOIR_BASE_URL = 'https://api.reservoir.tools';

interface ReservoirCollectionStats {
  id: string;
  name: string;
  slug?: string;
  image?: string;
  banner?: string;
  description?: string;
  tokenCount?: number;
  onSaleCount?: number;
  primaryContract?: string;
  floorAsk?: {
    price?: {
      amount: {
        native: string;  // In ETH
        usd?: number;    // In USD
      };
    };
  };
  volume?: {
    '1day'?: {
      native: string;
      usd?: number;
    };
    '7day'?: {
      native: string;
      usd?: number;
    };
    '30day'?: {
      native: string;
      usd?: number;
    };
    allTime?: {
      native: string;
      usd?: number;
    };
  };
  ownerCount?: number;
}

/**
 * Get collection stats from Reservoir API
 */
export async function getCollectionStats(
  contractAddress: string,
  chainId: number
): Promise<ReservoirCollectionStats | null> {
  try {
    // Map chain ID to Reservoir chain name
    const chainName = getReservoirChainName(chainId);
    if (!chainName) {
      console.warn(`[MarketData] Chain ${chainId} not supported by Reservoir`);
      return null;
    }

    const response = await fetch(
      `${RESERVOIR_BASE_URL}/collections/v5?id=${contractAddress}&includeTopBid=false`,
      {
        headers: {
          'X-API-Key': process.env.RESERVOIR_API_KEY || '', // Optional, but recommended
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Reservoir API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.collections?.[0] || null;
  } catch (error) {
    console.error('[MarketData] Error fetching collection stats:', error);
    return null;
  }
}

function getReservoirChainName(chainId: number): string | null {
  const chainMap: Record<number, string> = {
    1: 'ethereum',
    137: 'polygon',
    56: 'bsc',
    42161: 'arbitrum',
    43114: 'avalanche',
    8453: 'base',
    10: 'optimism',
  };
  return chainMap[chainId] || null;
}
```

#### Step 4: Create NFT Service
**File:** `lib/backend/services/nft-service.ts` (NEW)

**Purpose:** Orchestrate NFT data fetching, normalization, and enrichment

```typescript
/**
 * NFT Service
 * Orchestrates NFT data fetching, normalization, and enrichment
 */

import { getWalletNFTs, getNFTCollectionMetadata, getNFTTransfers } from '@/lib/backend/providers/moralis-rest-client';
import { getCollectionStats } from '@/lib/backend/providers/market-data-provider';
import type { NFT, NFTCollection, NFTTransfer, NFTActivity } from '@/lib/backend/types/nft';

export class NFTService {
  /**
   * Get all NFTs for a wallet across multiple chains
   */
  async getWalletNFTs(
    address: string,
    chainIds: number[]
  ): Promise<NFT[]> {
    // Fetch NFTs from all chains in parallel
    const promises = chainIds.map(chainId => 
      this.getWalletNFTsForChain(address, chainId)
    );
    
    const results = await Promise.allSettled(promises);
    const allNFTs: NFT[] = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allNFTs.push(...result.value);
      }
    }
    
    return allNFTs;
  }

  /**
   * Get NFTs for a specific chain
   */
  private async getWalletNFTsForChain(
    address: string,
    chainId: number
  ): Promise<NFT[]> {
    try {
      const response = await getWalletNFTs(address, chainId, {
        limit: 100,
        normalizeMetadata: true,
      });

      const nfts: NFT[] = [];
      
      for (const item of response.result || []) {
        const nft = await this.normalizeNFT(item, chainId);
        if (nft) {
          nfts.push(nft);
        }
      }
      
      return nfts;
    } catch (error) {
      console.error(`[NFTService] Error fetching NFTs for chain ${chainId}:`, error);
      return [];
    }
  }

  /**
   * Normalize Moralis NFT response to our NFT type
   */
  private async normalizeNFT(
    item: any,
    chainId: number
  ): Promise<NFT | null> {
    try {
      // Extract image URL (try multiple sources)
      const image = item.metadata?.image || 
                   item.token_uri?.image || 
                   item.image || 
                   null;
      
      // Normalize image URL (handle IPFS, HTTP, etc.)
      const normalizedImage = this.normalizeImageUrl(image);
      
      // Get collection stats (floor price, volume, owners)
      const collectionStats = await getCollectionStats(
        item.token_address,
        chainId
      );

      return {
        contractAddress: item.token_address,
        tokenId: item.token_id,
        name: item.name || item.metadata?.name || `#${item.token_id}`,
        description: item.metadata?.description,
        image: normalizedImage,
        imageThumbnail: normalizedImage, // Could generate thumbnail
        chainId,
        collectionName: item.metadata?.collection?.name,
        collectionSymbol: item.symbol,
        contractType: item.contract_type as 'ERC721' | 'ERC1155',
        owner: item.owner_of,
        amount: item.amount,
        minterAddress: item.minter_address,
        blockNumberMinted: item.block_number_minted,
        blockTimestampMinted: item.block_number_minted 
          ? await this.getBlockTimestamp(item.block_number_minted, chainId)
          : undefined,
        attributes: item.metadata?.attributes || [],
        
        // Market data from Reservoir
        floorPrice: collectionStats?.floorAsk?.price?.amount?.native,
        floorPriceUSD: collectionStats?.floorAsk?.price?.amount?.usd?.toString(),
        totalVolume: collectionStats?.volume?.allTime?.native,
        totalVolumeUSD: collectionStats?.volume?.allTime?.usd?.toString(),
        owners: collectionStats?.ownerCount,
        listed: collectionStats?.onSaleCount,
        listedPercentage: collectionStats?.onSaleCount && collectionStats?.tokenCount
          ? (collectionStats.onSaleCount / collectionStats.tokenCount) * 100
          : undefined,
        supply: collectionStats?.tokenCount,
      };
    } catch (error) {
      console.error('[NFTService] Error normalizing NFT:', error);
      return null;
    }
  }

  /**
   * Get NFT transfers/activity
   */
  async getNFTActivity(
    address: string,
    contractAddress: string,
    tokenId: string,
    chainId: number
  ): Promise<NFTActivity[]> {
    try {
      const response = await getNFTTransfers(address, chainId, {
        limit: 50,
        direction: 'both',
        contractAddress,
      });

      const activities: NFTActivity[] = [];
      
      for (const transfer of response.result || []) {
        // Filter by token ID
        if (transfer.token_id !== tokenId) continue;
        
        const activity = this.normalizeTransferToActivity(
          transfer,
          address,
          contractAddress
        );
        if (activity) {
          activities.push(activity);
        }
      }
      
      // Sort by timestamp (newest first)
      return activities.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('[NFTService] Error fetching NFT activity:', error);
      return [];
    }
  }

  /**
   * Normalize transfer to activity
   */
  private normalizeTransferToActivity(
    transfer: any,
    walletAddress: string,
    contractAddress: string
  ): NFTActivity | null {
    try {
      const timestamp = new Date(transfer.block_timestamp).getTime();
      const date = new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      // Determine activity type
      let type: NFTActivity['type'] = 'transfer';
      if (transfer.from_address === '0x0000000000000000000000000000000000000000') {
        type = 'mint';
      } else if (transfer.to_address.toLowerCase() === walletAddress.toLowerCase()) {
        type = 'received';
      } else if (transfer.from_address.toLowerCase() === walletAddress.toLowerCase()) {
        type = 'sent';
      }

      // TODO: Fetch price from transaction (requires additional API call)
      // For now, we'll leave price as undefined
      // Can be enriched later with OpenSea/Reservoir sale data

      return {
        type,
        date,
        timestamp,
        nftName: contractAddress, // Will be enriched with actual name
        price: undefined, // TODO: Fetch from sale data
        priceUSD: undefined, // TODO: Fetch from sale data
        from: transfer.from_address,
        to: transfer.to_address,
        transactionHash: transfer.transaction_hash,
      };
    } catch (error) {
      console.error('[NFTService] Error normalizing transfer:', error);
      return null;
    }
  }

  /**
   * Normalize image URL (handle IPFS, HTTP, etc.)
   */
  private normalizeImageUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    
    // Handle IPFS
    if (url.startsWith('ipfs://')) {
      return `https://ipfs.io/ipfs/${url.replace('ipfs://', '')}`;
    }
    
    // Handle HTTP/HTTPS
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Handle data URIs
    if (url.startsWith('data:')) {
      return url;
    }
    
    return undefined;
  }

  /**
   * Get block timestamp (helper function)
   * TODO: Implement using blockchain RPC or Moralis
   */
  private async getBlockTimestamp(
    blockNumber: string,
    chainId: number
  ): Promise<number | undefined> {
    // This would require an RPC call or Moralis endpoint
    // For now, return undefined and calculate from block_timestamp if available
    return undefined;
  }
}
```

### Phase 4.2: Backend API Routes

#### Step 5: Create NFT API Route
**File:** `app/api/v1/nft/wallet/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { NFTService } from '@/lib/backend/services/nft-service';
import { isValidEVMAddress, isValidSolanaAddress } from '@/lib/backend/providers/moralis-rest-client';

const nftService = new NFTService();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    const chainIdsParam = searchParams.get('chains');

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    // Validate address
    if (!isValidEVMAddress(address) && !isValidSolanaAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }

    // Parse chain IDs
    const chainIds = chainIdsParam
      ? chainIdsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id))
      : [1, 56, 137, 42161, 43114, 8453]; // Default chains

    // Fetch NFTs
    const nfts = await nftService.getWalletNFTs(address, chainIds);

    return NextResponse.json({
      nfts,
      total: nfts.length,
      address,
      chains: chainIds,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('[NFT API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch NFTs' },
      { status: 500 }
    );
  }
}
```

#### Step 6: Create NFT Activity API Route
**File:** `app/api/v1/nft/activity/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { NFTService } from '@/lib/backend/services/nft-service';

const nftService = new NFTService();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    const contractAddress = searchParams.get('contractAddress');
    const tokenId = searchParams.get('tokenId');
    const chainId = searchParams.get('chainId');

    if (!address || !contractAddress || !tokenId || !chainId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const activities = await nftService.getNFTActivity(
      address,
      contractAddress,
      tokenId,
      parseInt(chainId, 10)
    );

    return NextResponse.json({
      activities,
      total: activities.length,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('[NFT Activity API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch NFT activity' },
      { status: 500 }
    );
  }
}
```

### Phase 4.3: Frontend - Hooks & Components

#### Step 7: Create NFT Hooks
**File:** `hooks/useWalletNFTs.ts` (NEW)

```typescript
import { useQuery } from '@tanstack/react-query';
import type { NFT } from '@/lib/backend/types/nft';

interface UseWalletNFTsReturn {
  nfts: NFT[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useWalletNFTs(
  walletAddress: string | null,
  chainIds?: number[]
): UseWalletNFTsReturn {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['wallet-nfts', walletAddress?.toLowerCase(), chainIds],
    queryFn: async () => {
      if (!walletAddress) return { nfts: [], total: 0 };
      
      const chainsParam = chainIds?.join(',') || '';
      const response = await fetch(
        `/api/v1/nft/wallet?address=${encodeURIComponent(walletAddress)}${chainsParam ? `&chains=${chainsParam}` : ''}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch NFTs');
      }
      
      return response.json();
    },
    enabled: !!walletAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    nfts: data?.nfts || [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch NFTs') : null,
    refetch,
  };
}
```

**File:** `hooks/useNFTActivity.ts` (NEW)

```typescript
import { useQuery } from '@tanstack/react-query';
import type { NFTActivity } from '@/lib/backend/types/nft';

export function useNFTActivity(
  walletAddress: string | null,
  contractAddress: string | null,
  tokenId: string | null,
  chainId: number | null
) {
  return useQuery({
    queryKey: ['nft-activity', walletAddress, contractAddress, tokenId, chainId],
    queryFn: async () => {
      if (!walletAddress || !contractAddress || !tokenId || !chainId) {
        return { activities: [], total: 0 };
      }
      
      const response = await fetch(
        `/api/v1/nft/activity?address=${encodeURIComponent(walletAddress)}&contractAddress=${encodeURIComponent(contractAddress)}&tokenId=${encodeURIComponent(tokenId)}&chainId=${chainId}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch NFT activity');
      }
      
      return response.json();
    },
    enabled: !!walletAddress && !!contractAddress && !!tokenId && !!chainId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
```

#### Step 8: Create NFT Components
**File:** `components/nft/nft-grid.tsx` (NEW)
- Display NFT thumbnails in grid
- Show name and floor price
- Clickable to view details

**File:** `components/nft/nft-detail-card.tsx` (NEW)
- Large NFT image
- All statistics (volume, owners, floor, chain, listed, creation date)
- Recent activities list

**File:** `components/nft/nft-activity-item.tsx` (NEW)
- Individual activity item
- Shows type, date, price

### Phase 4.4: Update Portfolio Page

#### Step 9: Integrate NFTs into Portfolio Page
**File:** `app/portfolio/page.tsx` (UPDATE)

**Changes:**
1. Replace mock `nfts` array with real data from `useWalletNFTs`
2. Update NFT grid to use real data
3. Update NFT detail view to show real statistics
4. Add loading states and error handling

## Implementation Steps Summary

### Backend (Steps 1-6)
1. ✅ Create NFT types (`lib/backend/types/nft.ts`)
2. ✅ Add NFT endpoints to `moralis-rest-client.ts`
3. ✅ Create market data provider (`market-data-provider.ts`)
4. ✅ Create NFT service (`nft-service.ts`)
5. ✅ Create NFT API routes (`/api/v1/nft/wallet`, `/api/v1/nft/activity`)

### Frontend (Steps 7-9)
6. ✅ Create NFT hooks (`useWalletNFTs`, `useNFTActivity`)
7. ✅ Create NFT components (`nft-grid`, `nft-detail-card`, `nft-activity-item`)
8. ✅ Update portfolio page to use real NFT data

## Data Flow

```
User Wallet Address
    ↓
useWalletNFTs Hook
    ↓
/api/v1/nft/wallet API Route
    ↓
NFTService.getWalletNFTs()
    ↓
┌─────────────────┬──────────────────┐
│                 │                  │
Moralis API    Reservoir API    Normalize
(getWalletNFTs) (getCollectionStats) (combine data)
│                 │                  │
└─────────────────┴──────────────────┘
    ↓
Return NFT[] with all required fields
    ↓
Frontend Components Display
```

## Required Environment Variables

```env
# Optional but recommended for Reservoir API
RESERVOIR_API_KEY=your_reservoir_api_key_here
```

## Estimated Time

- **Backend:** 8-12 hours
  - Types & endpoints: 2 hours
  - Market data provider: 2-3 hours
  - NFT service: 3-4 hours
  - API routes: 1-2 hours
  - Testing: 1 hour

- **Frontend:** 6-8 hours
  - Hooks: 1-2 hours
  - Components: 4-5 hours
  - Portfolio integration: 1-2 hours

**Total:** 14-20 hours

## Testing Checklist

- [ ] Fetch NFTs for wallet address
- [ ] Display NFT grid with thumbnails
- [ ] Show NFT details (all statistics)
- [ ] Display recent activities
- [ ] Handle loading states
- [ ] Handle error states
- [ ] Handle empty states (no NFTs)
- [ ] Test with multiple chains
- [ ] Test with ERC721 and ERC1155
- [ ] Test image URL normalization (IPFS, HTTP)
- [ ] Test market data fetching (floor price, volume, owners)
- [ ] Test activity fetching
- [ ] Test pagination (if needed)

## Future Enhancements

1. **NFT Filtering & Sorting:**
   - Filter by chain
   - Filter by collection
   - Sort by floor price, date, etc.

2. **NFT Search:**
   - Search by name, collection, token ID

3. **Price History:**
   - Chart showing price over time
   - Historical sales data

4. **NFT Actions:**
   - Transfer NFT
   - List for sale (if marketplace integration)

5. **Collection View:**
   - Group NFTs by collection
   - Show collection-level stats

---

## Approval Required

Please review this plan and approve before implementation. Key decisions:

1. **Market Data Provider:** Reservoir API (recommended) or OpenSea API?
2. **Pagination:** Implement cursor-based pagination for large collections?
3. **Caching:** Current cache TTLs acceptable (5 min for NFTs, 1 hour for metadata)?
4. **Image Handling:** Generate thumbnails or use full-size images?

Ready to proceed upon approval! 🚀


