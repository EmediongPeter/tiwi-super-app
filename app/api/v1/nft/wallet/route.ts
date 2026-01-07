import { NextRequest, NextResponse } from 'next/server';
import { NFTService } from '@/lib/backend/services/nft-service';
import { isValidEVMAddress, isValidSolanaAddress } from '@/lib/backend/providers/moralis-rest-client';

const nftService = new NFTService();

/**
 * GET /api/v1/nft/wallet
 * 
 * Get all NFTs for a wallet address across multiple chains
 * 
 * Query Parameters:
 * - address: Wallet address (required)
 * - chains: Comma-separated chain IDs (optional, defaults to major chains)
 */
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
    let chainIds = chainIdsParam
      ? chainIdsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id))
      : [1, 56, 137, 42161, 43114, 8453]; // Default chains (Ethereum, BSC, Polygon, Arbitrum, Avalanche, Base)

    // Check if address is Solana
    const isSolanaAddress = isValidSolanaAddress(address);
    const isEVMAddress = isValidEVMAddress(address);
    
    if (isSolanaAddress) {
      // For Solana addresses, add Solana chain ID if not already included
      const { SOLANA_CHAIN_ID } = await import('@/lib/backend/providers/moralis');
      if (!chainIds.includes(SOLANA_CHAIN_ID)) {
        chainIds = [SOLANA_CHAIN_ID];
      }
    } else if (!isEVMAddress) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }

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


