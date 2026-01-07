/**
 * NFT Service
 * 
 * Orchestrates NFT data fetching and normalization.
 * Uses Moralis API which provides all necessary data including metadata, floor prices, and rarity.
 * 
 * For EVM: Uses /api/v2.2/:address/nft which returns complete data (no enrichment needed)
 * For Solana: Gets NFTs from portfolio endpoint and enriches with metadata endpoint
 */

import { 
  getWalletNFTs, 
  getNFTTransfers,
  getSolanaNFTsFromPortfolio,
  getSolanaNFTMetadata,
  getAddressType
} from '@/lib/backend/providers/moralis-rest-client';
import { SOLANA_CHAIN_ID } from '@/lib/backend/providers/moralis';
import type { NFT, NFTActivity } from '@/lib/backend/types/nft';

// ============================================================================
// NFT Service Class
// ============================================================================

export class NFTService {
  /**
   * Get all NFTs for a wallet across multiple chains
   * 
   * @param address - Wallet address
   * @param chainIds - Array of chain IDs to fetch
   * @returns Array of NFTs
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
      } else {
        console.error('[NFTService] Error fetching NFTs:', result.reason);
      }
    }
    
    return allNFTs;
  }

  /**
   * Get NFTs for a specific chain
   * 
   * @param address - Wallet address
   * @param chainId - Chain ID
   * @returns Array of NFTs for the chain
   */
  private async getWalletNFTsForChain(
    address: string,
    chainId: number
  ): Promise<NFT[]> {
    try {
      // Handle Solana NFTs differently
      if (chainId === SOLANA_CHAIN_ID) {
        return await this.getSolanaWalletNFTs(address);
      }
      
      // EVM chains - Moralis /api/v2.2/:address/nft returns all data we need
      const response = await getWalletNFTs(address, chainId, {
        limit: 100,
        normalizeMetadata: true,
      });

      const nfts: NFT[] = [];
      const tokenDataArray = response.result || [];
      
      if (!Array.isArray(tokenDataArray)) {
        console.warn('[NFTService] Invalid response format from getWalletNFTs');
        return [];
      }
      
      // Normalize each NFT - Moralis already provides all market data, rarity, etc.
      for (const item of tokenDataArray) {
        try {
          const nft = this.normalizeEVMNFT(item, chainId);
          if (nft) {
            nfts.push(nft);
          }
        } catch (error) {
          console.error('[NFTService] Error processing NFT:', error);
          continue;
        }
      }
      
      return nfts;
    } catch (error) {
      console.error(`[NFTService] Error fetching NFTs for chain ${chainId}:`, error);
      return [];
    }
  }

  /**
   * Get Solana NFTs for a wallet
   * 
   * Gets NFTs from portfolio endpoint (limited data) and enriches with metadata endpoint
   * 
   * @param address - Solana wallet address
   * @returns Array of Solana NFTs
   */
  private async getSolanaWalletNFTs(address: string): Promise<NFT[]> {
    try {
      // Get NFTs from portfolio endpoint (returns limited data)
      const nftArray = await getSolanaNFTsFromPortfolio(address);
      
      if (!Array.isArray(nftArray) || nftArray.length === 0) {
        return [];
      }
      
      const nfts: NFT[] = [];
      
      // Fetch metadata for each NFT in parallel to enrich with full data
      const metadataPromises = nftArray.map(async (item) => {
        try {
          const mintAddress = item.mint || item.associatedTokenAddress;
          if (!mintAddress) {
            return null;
          }
          
          // Fetch detailed metadata (includes image, attributes, collection info, floor prices, rarity, etc.)
          let metadata = null;
          try {
            metadata = await getSolanaNFTMetadata(mintAddress);
          } catch (error) {
            // Metadata fetch failed, use basic info from portfolio endpoint
            console.warn(`[NFTService] Failed to fetch metadata for ${mintAddress}:`, error);
          }
          
          // Normalize Solana NFT to our unified NFT type
          const nft = this.normalizeSolanaNFT(item, metadata, address);
          return nft;
        } catch (error) {
          console.error('[NFTService] Error processing Solana NFT:', error);
          return null;
        }
      });
      
      const results = await Promise.allSettled(metadataPromises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          nfts.push(result.value);
        }
      }
      
      return nfts;
    } catch (error) {
      console.error('[NFTService] Error fetching Solana NFTs:', error);
      return [];
    }
  }

  /**
   * Normalize Solana NFT response to our unified NFT type
   * 
   * Combines data from portfolio endpoint (basic info) with metadata endpoint (enriched data)
   * 
   * @param item - Raw NFT data from portfolio endpoint (limited data)
   * @param metadata - Detailed metadata from metadata endpoint (includes image, attributes, floor prices, rarity, etc.)
   * @param owner - Owner address
   * @returns Normalized NFT in unified format
   */
  private normalizeSolanaNFT(item: any, metadata: any, owner: string): NFT {
    const mintAddress = item.mint || item.associatedTokenAddress || '';
    const tokenId = mintAddress; // For Solana, mint address serves as token ID
    
    // Use metadata if available (enriched), otherwise use basic info from portfolio endpoint
    const name = metadata?.name || item.name || 'Unnamed NFT';
    const description = metadata?.description || null;
    
    // Image from metadata (enriched) or portfolio endpoint
    const image = metadata?.imageOriginalUrl || 
                 metadata?.image || 
                 item.media || 
                 null;
    
    // Collection info from metadata or portfolio endpoint
    const collectionName = metadata?.collection?.name || 
                          metadata?.contract?.name || 
                          item.name || 
                          null;
    const collectionSymbol = metadata?.collection?.symbol || 
                           metadata?.contract?.symbol || 
                           item.symbol || 
                           null;
    
    // Extract attributes from metadata (enriched with rarity info if available)
    const attributes = metadata?.attributes?.map((attr: any) => ({
      trait_type: attr.traitType || attr.trait_type || 'Unknown',
      value: attr.value || 'Unknown',
    })) || [];
    
    return {
      contractAddress: mintAddress,
      tokenId,
      name,
      description,
      image,
      imageThumbnail: image, // Use same image for thumbnail
      chainId: SOLANA_CHAIN_ID,
      collectionName,
      collectionSymbol,
      contractType: 'ERC721', // Solana NFTs are similar to ERC721
      owner,
      amount: item.amount || item.amountRaw || '1',
      attributes,
      // Market data from metadata endpoint (if available)
      floorPrice: metadata?.floorPrice || null,
      floorPriceUSD: metadata?.floorPriceUSD || null,
      // Note: Solana metadata endpoint may not provide totalVolume, owners, listed, supply
      // These would require collection-level endpoint if needed
    };
  }

  /**
   * Normalize EVM NFT response from Moralis to our unified NFT type
   * 
   * Moralis /api/v2.2/:address/nft already includes:
   * - Normalized metadata (name, description, image, attributes)
   * - Floor prices (floor_price, floor_price_usd, floor_price_currency)
   * - Rarity (rarity_rank, rarity_percentage, rarity_label)
   * - Collection info (collection_logo, collection_banner_image, etc.)
   * - List prices (list_price with marketplace info)
   * 
   * @param item - Raw NFT data from Moralis (already enriched)
   * @param chainId - Chain ID
   * @returns Normalized NFT or null if invalid
   */
  private normalizeEVMNFT(
    item: any,
    chainId: number
  ): NFT | null {
    try {
      // Extract image URL - Moralis provides normalized_metadata.image
      const image = item.normalized_metadata?.image || 
                   item.metadata?.image || 
                   item.image || 
                   null;
      
      // Normalize image URL (handle IPFS, HTTP, etc.)
      const normalizedImage = this.normalizeImageUrl(image);

      // Parse block timestamp if available
      let blockTimestampMinted: number | undefined;
      if (item.block_number_minted) {
        blockTimestampMinted = item.block_timestamp 
          ? new Date(item.block_timestamp).getTime()
          : undefined;
      }

      // Extract attributes from normalized_metadata (Moralis provides enriched attributes with rarity)
      const attributes = item.normalized_metadata?.attributes || item.metadata?.attributes || [];

      return {
        contractAddress: item.token_address,
        tokenId: item.token_id,
        name: item.normalized_metadata?.name || item.name || item.metadata?.name || `#${item.token_id}`,
        description: item.normalized_metadata?.description || item.metadata?.description,
        image: normalizedImage,
        imageThumbnail: normalizedImage,
        chainId,
        collectionName: item.name || item.normalized_metadata?.collection?.name,
        collectionSymbol: item.symbol,
        contractType: item.contract_type as 'ERC721' | 'ERC1155',
        owner: item.owner_of,
        amount: item.amount,
        minterAddress: item.minter_address,
        blockNumberMinted: item.block_number_minted,
        blockTimestampMinted,
        attributes,
        
        // Market data from Moralis (already included in response)
        floorPrice: item.floor_price || null,
        floorPriceUSD: item.floor_price_usd || null,
        // Note: Moralis doesn't provide totalVolume, owners, listed, supply in wallet endpoint
        // These would require collection-level endpoint if needed
      };
    } catch (error) {
      console.error('[NFTService] Error normalizing EVM NFT:', error);
      return null;
    }
  }

  /**
   * Get NFT transfers/activity for a specific NFT
   * 
   * @param address - Wallet address
   * @param contractAddress - NFT contract address
   * @param tokenId - Token ID
   * @param chainId - Chain ID
   * @returns Array of activities sorted by timestamp (newest first)
   */
  async getNFTActivity(
    address: string,
    contractAddress: string,
    tokenId: string,
    chainId: number
  ): Promise<NFTActivity[]> {
    try {
      // Fetch transfers from Moralis
      const transfersResponse = await getNFTTransfers(address, chainId, {
        limit: 50,
        direction: 'both',
        contractAddress,
      });

      const activities: NFTActivity[] = [];
      const transfers = transfersResponse.result || [];
      
      // Note: Moralis transfer endpoint may include price information
      // If not available, we can extract from transfer value or leave undefined
      const salesMap = new Map<string, { price: string; priceUSD?: string }>();
      
      // Process transfers
      for (const transfer of transfers) {
        // Filter by token ID
        if (transfer.token_id !== tokenId) continue;
        
        const activity = this.normalizeTransferToActivity(
          transfer,
          address,
          contractAddress,
          salesMap
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
   * 
   * @param transfer - Raw transfer data from Moralis
   * @param walletAddress - Wallet address to determine activity type
   * @param contractAddress - Contract address (for NFT name)
   * @param salesMap - Map of transaction hash to sale price
   * @returns Normalized activity or null
   */
  private normalizeTransferToActivity(
    transfer: any,
    walletAddress: string,
    contractAddress: string,
    salesMap: Map<string, { price: string; priceUSD?: string }>
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
      const fromAddress = transfer.from_address?.toLowerCase() || '';
      const toAddress = transfer.to_address?.toLowerCase() || '';
      const walletLower = walletAddress.toLowerCase();
      
      if (fromAddress === '0x0000000000000000000000000000000000000000') {
        type = 'mint';
      } else if (toAddress === walletLower) {
        type = 'received';
      } else if (fromAddress === walletLower) {
        type = 'sent';
      }

      // Get price from sales map if available
      const txHash = transfer.transaction_hash?.toLowerCase() || '';
      const saleData = salesMap.get(txHash);
      
      // Use contract address as NFT name (will be enriched with actual name if available)
      const nftName = contractAddress;

      return {
        type,
        date,
        timestamp,
        nftName,
        price: saleData?.price,
        priceUSD: saleData?.priceUSD,
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
   * 
   * @param url - Image URL (can be IPFS, HTTP, data URI, etc.)
   * @returns Normalized URL or undefined
   */
  private normalizeImageUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    
    // Handle IPFS
    if (url.startsWith('ipfs://')) {
      const ipfsHash = url.replace('ipfs://', '').replace('ipfs/', '');
      return `https://ipfs.io/ipfs/${ipfsHash}`;
    }
    
    // Handle IPFS gateway URLs
    if (url.includes('ipfs.io') || url.includes('gateway.pinata.cloud')) {
      return url;
    }
    
    // Handle HTTP/HTTPS
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Handle data URIs
    if (url.startsWith('data:')) {
      return url;
    }
    
    // Try to construct IPFS URL if it looks like a hash
    if (/^[a-zA-Z0-9]{46}$/.test(url)) {
      return `https://ipfs.io/ipfs/${url}`;
    }
    
    return undefined;
  }
}


