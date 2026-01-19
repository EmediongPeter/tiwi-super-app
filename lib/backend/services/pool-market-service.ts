/**
 * Pool Market Service
 *
 * Fetches pool/pair-based market data from CoinGecko Onchain APIs
 * and normalizes it into the existing NormalizedToken shape that
 * the rest of the app (and homepage market table) already uses.
 *
 * Design goals:
 * - CoinGecko is the primary source for price, 24h change, volume, liquidity.
 * - We avoid hitting DexScreener here to prevent extra rate-limit pressure.
 *   (DexScreener is still used elsewhere for featured tokens and TWC.)
 * - Category semantics:
 *   - "hot"    → trending_pools
 *   - "new"    → new_pools
 *   - "gainers"→ trending_pools sorted by 24h change desc, > 0
 *   - "losers" → trending_pools sorted by 24h change asc, < 0
 */

import type { NormalizedToken } from '@/lib/backend/types/backend-tokens';
import { getCanonicalChain } from '@/lib/backend/registry/chains';
import { getCache, CACHE_TTL } from '@/lib/backend/utils/cache';

// CoinGecko onchain base URL
const COINGECKO_ONCHAIN_BASE = 'https://api.coingecko.com/api/v3/onchain';

// Map canonical chain IDs to CoinGecko onchain network slugs
// Extend this map over time as needed.
const COINGECKO_NETWORK_BY_CHAIN: Record<number, string> = {
  1: 'eth',          // Ethereum
  56: 'bsc',         // BNB Smart Chain
  137: 'polygon',    // Polygon
  42161: 'arbitrum', // Arbitrum
  10: 'optimism',    // Optimism
  8453: 'base',      // Base
  43114: 'avax',     // Avalanche
  7565164: 'solana', // Solana
};

// Inverse map for going from network slug → canonical chainId
const CHAIN_BY_COINGECKO_NETWORK: Record<string, number> = Object.entries(
  COINGECKO_NETWORK_BY_CHAIN
).reduce((acc, [id, slug]) => {
  acc[slug] = Number(id);
  return acc;
}, {} as Record<string, number>);

type Category = 'hot' | 'new' | 'gainers' | 'losers';

interface CoingeckoPoolAttributes {
  base_token_price_usd?: string;
  base_token_price_native_currency?: string;
  quote_token_price_usd?: string;
  quote_token_price_native_currency?: string;
  base_token_price_quote_token?: string;
  quote_token_price_base_token?: string;
  address: string;
  name: string;
  pool_created_at?: string;
  fdv_usd?: string;
  market_cap_usd?: string;
  price_change_percentage?: {
    m5?: string;
    m15?: string;
    m30?: string;
    h1?: string;
    h6?: string;
    h24?: string;
  };
  transactions?: {
    m5?: { buys?: number; sells?: number; buyers?: number; sellers?: number };
    m15?: { buys?: number; sells?: number; buyers?: number; sellers?: number };
    m30?: { buys?: number; sells?: number; buyers?: number; sellers?: number };
    h1?: { buys?: number; sells?: number; buyers?: number; sellers?: number };
    h6?: { buys?: number; sells?: number; buyers?: number; sellers?: number };
    h24?: { buys?: number; sells?: number; buyers?: number; sellers?: number };
  };
  volume_usd?: {
    m5?: string;
    m15?: string;
    m30?: string;
    h1?: string;
    h6?: string;
    h24?: string;
  };
  reserve_in_usd?: string;
}

interface CoingeckoRelationshipData {
  id: string;
  type: string;
}

interface CoingeckoPool {
  id: string;
  type: 'pool';
  attributes: CoingeckoPoolAttributes;
  relationships: {
    base_token?: { data?: CoingeckoRelationshipData | null };
    quote_token?: { data?: CoingeckoRelationshipData | null };
    network?: { data?: CoingeckoRelationshipData | null };
    dex?: { data?: CoingeckoRelationshipData | null };
  };
}

interface CoingeckoTokenAttributes {
  name?: string;
  symbol?: string;
  address?: string;
  image?: {
    small?: string;
    thumb?: string;
    large?: string;
  };
}

interface CoingeckoIncludedToken {
  id: string; // e.g. "eth_0x..." or "solana_<mint>"
  type: 'token';
  attributes: CoingeckoTokenAttributes;
}

interface CoingeckoPoolsResponse {
  data: CoingeckoPool[];
  included?: CoingeckoIncludedToken[];
}

interface DexScreenerSearchPairInfo {
  imageUrl?: string;
}

interface DexScreenerSearchPair {
  info?: DexScreenerSearchPairInfo;
}

interface DexScreenerSearchResponse {
  pairs?: DexScreenerSearchPair[];
}

export class PoolMarketService {
  private cache = getCache();
  private static readonly CACHE_TTL_MS = CACHE_TTL.PRICES; // 60s – good balance for "trending"

  /**
   * Public entrypoint: get category-based "token rows" for the market table.
   * Behind the scenes this is pool-based, but we expose a NormalizedToken
   * representing the base token of each pool.
   */
  async getTokensByCategory(
    category: Category,
    limit: number = 30
  ): Promise<NormalizedToken[]> {
    // For now, we aggregate across the core networks we mapped above.
    const networkSlugs = Object.values(COINGECKO_NETWORK_BY_CHAIN);

    const allTokens: NormalizedToken[] = [];

    for (const network of networkSlugs) {
      const chainId = CHAIN_BY_COINGECKO_NETWORK[network];
      if (!chainId) continue;

      const pools = await this.fetchPoolsForNetwork(network, category);

      // Derive gainers/losers from trending pools by sorting
      const sortedPools =
        category === 'gainers'
          ? pools
              .filter((p) => this.getPriceChange24h(p) > 0)
              .sort(
                (a, b) => this.getPriceChange24h(b) - this.getPriceChange24h(a)
              )
          : category === 'losers'
          ? pools
              .filter((p) => this.getPriceChange24h(p) < 0)
              .sort(
                (a, b) => this.getPriceChange24h(a) - this.getPriceChange24h(b)
              )
          : pools;

      const limitedPools = sortedPools.slice(0, limit);
      const tokensForNetwork = this.normalizePoolsToTokens(
        limitedPools,
        chainId,
        network
      );

      allTokens.push(...tokensForNetwork);
    }

    // Sort "hot" by volume across networks, "new" by pool_created_at (desc)
    if (category === 'hot') {
      allTokens.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    } else if (category === 'new') {
      allTokens.sort((a, b) => {
        const aTime = (a as any).poolCreatedAt
          ? new Date((a as any).poolCreatedAt).getTime()
          : 0;
        const bTime = (b as any).poolCreatedAt
          ? new Date((b as any).poolCreatedAt).getTime()
          : 0;
        return bTime - aTime;
      });
    }

    // Deduplicate by chainId+address and cap final list
    const seen = new Set<string>();
    const deduped: NormalizedToken[] = [];
    for (const token of allTokens) {
      const key = `${token.chainId}:${token.address.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(token);
      if (deduped.length >= limit) break;
    }

    // Enrich with logos from DexScreener (best-effort, rate-limited via cache + cap)
    const enriched = await this.enrichLogosWithDexScreener(deduped);

    return enriched;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async fetchPoolsForNetwork(
    network: string,
    category: Category
  ): Promise<CoingeckoPool[]> {
    const cacheKey = `cg:pools:${network}:${category}`;
    const cached = this.cache.get<CoingeckoPool[]>(cacheKey);
    if (cached) return cached;

    const apiKey =
      process.env.COINGECKO_API_KEY ||
      process.env.COINGECKO_DEMO_API_KEY ||
      process.env.NEXT_PUBLIC_COINGECKO_API_KEY;

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['x-cg-demo-api-key'] = apiKey;
    }

    const endpoint =
      category === 'new'
        ? `${COINGECKO_ONCHAIN_BASE}/networks/${network}/new_pools?include=base_token`
        : `${COINGECKO_ONCHAIN_BASE}/networks/${network}/trending_pools?include=base_token`;

    try {
      const res = await fetch(endpoint, { headers });
      if (!res.ok) {
        console.warn(
          `[PoolMarketService] CoinGecko ${category} pools failed for ${network}:`,
          res.status,
          res.statusText
        );
        return [];
      }

      const json = (await res.json()) as CoingeckoPoolsResponse;
      const pools = Array.isArray(json.data) ? json.data : [];

      this.cache.set(cacheKey, pools, PoolMarketService.CACHE_TTL_MS);
      return pools;
    } catch (error) {
      console.error(
        `[PoolMarketService] Error fetching CoinGecko pools for ${network} (${category}):`,
        error
      );
      return [];
    }
  }

  private getPriceChange24h(pool: CoingeckoPool): number {
    const raw = pool.attributes.price_change_percentage?.h24;
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  private normalizePoolsToTokens(
    pools: CoingeckoPool[],
    chainId: number,
    network: string
  ): NormalizedToken[] {
    const tokens: NormalizedToken[] = [];

    const canonicalChain = getCanonicalChain(chainId);
    if (!canonicalChain) return tokens;

    for (const pool of pools) {
      const attrs = pool.attributes;
      const priceUSD = Number(attrs.base_token_price_usd ?? '0');
      const volume24h = Number(attrs.volume_usd?.h24 ?? '0');
      const liquidity = Number(attrs.reserve_in_usd ?? '0');
      const priceChange24h = this.getPriceChange24h(pool);

      const tx = attrs.transactions?.h24;
      const buys = tx?.buys ?? 0;
      const sells = tx?.sells ?? 0;
      const buyers = tx?.buyers ?? 0;
      const transactionCount = buys + sells;

      const baseRel = pool.relationships.base_token?.data;
      const baseId = baseRel?.id || '';

      // Fallback: derive address from id like "eth_0x..." or "solana_<mint>"
      const [, derivedAddress] = baseId.split('_');
      const address = derivedAddress || attrs.address;

      if (!address) continue;

      // Basic symbol/name are taken from pool.name when token info is missing.
      const symbolGuess = this.deriveSymbolFromPoolName(attrs.name);

      const token: NormalizedToken = {
        chainId,
        address,
        symbol: attrs.name,
        name: attrs.name || symbolGuess,
        decimals: undefined, // can be enriched on demand
        logoURI: '', // CoinGecko base_token image can be wired later if needed
        priceUSD: priceUSD.toString(),
        providers: ['coingecko'],
        verified: false,
        vmType: canonicalChain.type === 'EVM' ? 'evm' : undefined,
        chainBadge: canonicalChain.name.toLowerCase(),
        chainName: canonicalChain.name,
        volume24h: volume24h || undefined,
        liquidity: liquidity || undefined,
        marketCap: attrs.market_cap_usd
          ? Number(attrs.market_cap_usd)
          : attrs.fdv_usd
          ? Number(attrs.fdv_usd)
          : undefined,
        priceChange24h,
        holders: buyers || undefined, // approximate "holders" as 24h unique buyers
        transactionCount: transactionCount || undefined,
      };

      // Attach poolCreatedAt as non-typed metadata for "new" sorting
      (token as any).poolCreatedAt = attrs.pool_created_at;

      tokens.push(token);
    }

    return tokens;
  }

  /**
   * Best-effort logo enrichment:
   * - For tokens without logoURI, search DexScreener by token name.
   * - Take the first pair's info.imageUrl as the logo.
   * - Cache results by (chainId, name) to avoid repeated lookups.
   * - Hard-cap the number of logo lookups per call to avoid rate limits.
   */
  private async enrichLogosWithDexScreener(
    tokens: NormalizedToken[]
  ): Promise<NormalizedToken[]> {
    const MAX_ENRICH_PER_CALL = 30;
    const LOGO_TTL = 5 * 60 * 1000; // 5 minutes

    const result = [...tokens];
    const toEnrich = result
      .filter((t) => !t.logoURI)
      .slice(0, MAX_ENRICH_PER_CALL);

    await Promise.all(
      toEnrich.map(async (token) => {
        const lookupName = token.name || token.symbol;
        if (!lookupName) return;

        const cacheKey = `dexlogo:${token.chainId}:${lookupName.toLowerCase()}`;
        const cached = this.cache.get<string>(cacheKey);
        if (cached) {
          token.logoURI = cached;
          return;
        }

        try {
          const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(
            lookupName
          )}`;
          const res = await fetch(url);
          if (!res.ok) return;

          const data = (await res.json()) as DexScreenerSearchResponse;
          // Find the first pair that has info.imageUrl (not just the first pair)
          const pairWithImage = Array.isArray(data.pairs)
            ? data.pairs.find((pair) => pair.info?.imageUrl)
            : undefined;
          console.log("🚀 ~ PoolMarketService ~ enrichLogosWithDexScreener ~ pairWithImage:", pairWithImage)
          const imageUrl = pairWithImage?.info?.imageUrl;
          if (!imageUrl) return;

          token.logoURI = imageUrl;
          this.cache.set(cacheKey, imageUrl, LOGO_TTL);
        } catch (error) {
          console.warn(
            `[PoolMarketService] DexScreener logo lookup failed for ${lookupName} on chain ${token.chainId}:`,
            error
          );
        }
      })
    );

    return result;
  }

  /**
   * Very small helper to guess a symbol from pool name like "WETH / SOL" or "BlackBull / SOL".
   * We take the first segment before " / ".
   */
  private deriveSymbolFromPoolName(name?: string): string {
    if (!name) return '';
    const [first] = name.split('/').map((s) => s.trim());
    // If it already looks like a ticker (<= 12 chars, uppercase-ish), use as is.
    if (first && first.length <= 12) {
      return first.replace(/\s+/g, '');
    }
    return first;
  }
}

// Singleton
let poolMarketServiceInstance: PoolMarketService | null = null;

export function getPoolMarketService(): PoolMarketService {
  if (!poolMarketServiceInstance) {
    poolMarketServiceInstance = new PoolMarketService();
  }
  return poolMarketServiceInstance;
}


