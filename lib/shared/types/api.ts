/**
 * API Response Types
 * 
 * These types define the API contract between backend and frontend.
 * They are shared because both sides need to agree on the response format.
 * 
 * Platform-agnostic types that can be used in both web and mobile.
 */

import type { NormalizedToken, ChainDTO, MarketTokenPair } from '@/lib/backend/types/backend-tokens';

/**
 * Tokens API Response
 * 
 * Response format for /api/v1/tokens endpoint.
 * Matches Relay's predictable format for consistency.
 */
export interface TokensAPIResponse {
  tokens: NormalizedToken[];
  total: number;
  chainIds?: number[];
  term?: string;
  query?: string;
  limit?: number | null;
}

/**
 * Market Pairs API Response
 * 
 * Response format for /api/v1/market-pairs endpoint.
 * Returns pool/pair-based market data with both base and quote tokens.
 */
export interface MarketPairsAPIResponse {
  pairs: MarketTokenPair[];
  total: number;
  category?: 'hot' | 'new' | 'gainers' | 'losers';
  network?: string;
  limit?: number | null;
  page?: number | null;
}

/**
 * Chains API Response
 * 
 * Response format for /api/v1/chains endpoint.
 */
export interface ChainsAPIResponse {
  chains: ChainDTO[];
  total: number;
}

