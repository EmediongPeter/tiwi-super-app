# Moralis Integration: Comprehensive Review & Implementation Plan

## Executive Summary

After deep research of Moralis documentation and analysis of your codebase, I've identified critical issues and opportunities for optimization. The primary error (`404 Not Found` for chain 137) is due to incorrect endpoint usage. More importantly, we're making **2x more API calls than necessary** by using separate endpoints for native and ERC20 tokens.

## 🔍 Critical Findings

### 1. **Current Error: 404 Not Found for Chain 137**

**Root Cause:**
- Current implementation uses: `/{address}/erc20?chain=0x89`
- **Correct endpoint:** `/wallets/{address}/tokens?chain=polygon` (or `eth`, `bsc`, etc.)
- Moralis expects chain names (lowercase strings), not hex values for the `/wallets/` endpoints

**Current Code Issue:**
```typescript
// ❌ WRONG - This is causing 404 errors
return makeMoralisRequest(
  `/${address}/erc20`,  // Missing /wallets/ prefix
  {
    params: { chain: chainHex },  // Using hex (0x89) instead of name (polygon)
  }
);
```

**Correct Implementation:**
```typescript
// ✅ CORRECT
return makeMoralisRequest(
  `/wallets/${address}/tokens`,  // Note: /wallets/ prefix
  {
    params: { chain: 'polygon' },  // Use chain name, not hex
  }
);
```

### 2. **Inefficient API Usage (2x API Calls)**

**Current Approach:**
- Call 1: `/{address}/balance` → Get native token
- Call 2: `/{address}/erc20` → Get ERC20 tokens
- **Total: 2 API calls per chain**

**Optimal Approach (from notes.txt):**
- Call 1: `/wallets/{address}/tokens?chain=eth` → Get **BOTH** native + ERC20 tokens with prices
- **Total: 1 API call per chain** (50% reduction!)

**Benefits of `/wallets/{address}/tokens` endpoint:**
- ✅ Returns native token + all ERC20 tokens in one response
- ✅ Includes USD prices (`usd_price`, `usd_value`)
- ✅ Includes 24h price change (`usd_price_24hr_percent_change`)
- ✅ Includes portfolio percentage (`portfolio_percentage`)
- ✅ Includes spam detection (`possible_spam`)
- ✅ Includes verified contract status (`verified_contract`)
- ✅ Pagination support for wallets with many tokens

### 3. **Chain Parameter Format**

Moralis accepts chain parameters in **two formats**:
- **Hex format** (0x1, 0x89): Used for endpoints like `/{address}/balance`, `/{address}/erc20`
- **Name format** (eth, polygon, bsc): Used for endpoints like `/wallets/{address}/tokens`

**Chain Name Mapping:**
```typescript
const CHAIN_NAME_MAP: Record<number, string> = {
  1: 'eth',
  10: 'optimism',
  56: 'bsc',
  137: 'polygon',
  42161: 'arbitrum',
  43114: 'avalanche',
  8453: 'base',
  250: 'fantom',
  100: 'gnosis',
  1101: 'polygon-zkevm',
  324: 'zksync',
  5000: 'mantle',
  59144: 'linea',
  534352: 'scroll',
};
```

## 📊 Moralis API Endpoints Analysis

### Wallet & Token Endpoints

| Endpoint | Purpose | Returns | API Calls Saved |
|----------|---------|---------|----------------|
| `/wallets/{address}/tokens` | **Native + ERC20 with prices** | All tokens with USD values | ✅ **1 call instead of 2** |
| `/{address}/balance` | Native balance only | Balance string | ❌ Redundant |
| `/{address}/erc20` | ERC20 tokens only | Token array | ❌ Redundant |
| `/wallets/{address}/net-worth` | Total portfolio value | USD value across chains | ✅ Useful for total balance |
| `/wallets/{address}/history` | Transaction history | Full transaction data | ✅ For activity feed |

### NFT Endpoints

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `/{address}/nft` | All NFTs by wallet | NFT array with metadata |
| `/{address}/nft/collections` | NFT collections | Collection summaries |
| `/{address}/nft/transfers` | NFT transfer history | Transfer events |
| `/nft/{address}/metadata` | NFT contract metadata | Collection info, floor price |

### Transaction & Activity Endpoints

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `/wallets/{address}/history` | Complete wallet history | All transactions, transfers, swaps |
| `/wallets/{address}/swaps` | Swap transactions only | Buy/sell events with DEX info |
| `/wallets/{address}/defi/summary` | DeFi positions summary | Total value, active protocols |
| `/wallets/{address}/defi/positions` | Detailed DeFi positions | LP positions, staking, etc. |

### Price & Market Data

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `/token/{address}/price` | Token price | Current USD price |
| `/token/{address}/price-history` | Historical prices | OHLCV data for charts |

## 🎯 Goals Analysis & Feasibility

### Goal 1: Display Total Wallet Balance ✅ **FEASIBLE**
- **Endpoint:** `/wallets/{address}/net-worth?chains=eth,polygon,bsc`
- **Returns:** `total_networth_usd`, breakdown by chain
- **Implementation:** Simple API call, cache for 30s

### Goal 2: Show Token Balances with Names/Symbols ✅ **FEASIBLE**
- **Endpoint:** `/wallets/{address}/tokens?chain=eth`
- **Returns:** All tokens with `name`, `symbol`, `balance`, `usd_value`
- **Implementation:** Already partially implemented, just need to fix endpoint

### Goal 3: Calculate Daily Percentage Change ✅ **FEASIBLE**
- **Data Source:** `/wallets/{address}/tokens` includes `usd_price_24hr_percent_change`
- **Calculation:** Aggregate weighted average based on USD values
- **Implementation:** 
  ```typescript
  const dailyChange = tokens.reduce((sum, token) => {
    const change = parseFloat(token.usd_price_24hr_percent_change || '0');
    const weight = parseFloat(token.usd_value || '0');
    return sum + (change * weight);
  }, 0) / totalUSD;
  ```

### Goal 4: Mini Sparkline Charts (Green/Red) ✅ **FEASIBLE**
- **Data Source:** `/token/{address}/price-history?chain=eth&interval=1h&days=1`
- **Returns:** Hourly price data for last 24h
- **Implementation:** 
  - Fetch price history for each token
  - Generate SVG sparkline (similar to CoinGecko)
  - Color: green if last price > first price, red otherwise
  - Cache for 5 minutes (prices don't change frequently)

### Goal 5: NFT Data with Metadata ✅ **FEASIBLE**
- **Endpoints:**
  - `/wallets/{address}/nft` → Get all NFTs
  - `/nft/{address}/metadata` → Get collection metadata
- **Returns:**
  - NFT metadata (name, image, attributes)
  - Collection floor price (`floor_price_usd`)
  - Total volume (from collection metadata)
  - Number of owners (from collection metadata)
  - Creation date (`block_number_minted` → convert to timestamp)
  - Listed status (requires marketplace API or on-chain check)
  - Percentage change (compare current floor vs purchase price)

### Goal 6: NFT Activity Tracking ✅ **FEASIBLE**
- **Endpoint:** `/wallets/{address}/nft/transfers`
- **Returns:**
  - All NFT transfers (received, sent)
  - Transaction hashes
  - Timestamps
  - From/to addresses
- **Implementation:**
  - Filter by NFT contract address
  - Categorize: received, sent, staked (requires DeFi position check)
  - Display timeline of activity

### Goal 7: Recent Transactions & Activities ✅ **FEASIBLE**
- **Endpoint:** `/wallets/{address}/history?chain=eth&limit=50`
- **Returns:**
  - All transaction types (transfers, swaps, DeFi, etc.)
  - Categorized by type
  - Includes `erc20_transfers`, `native_transfers`, `nft_transfers`
- **Implementation:**
  - Parse transaction types from response
  - Group by category (swap, transfer, DeFi, etc.)
  - Display in activity feed

### Goal 8: AI Assistant for On-Chain Activity ✅ **FEASIBLE WITH PLANNING**

**What Users Need:**
1. **Risk Assessment:** Identify risky transactions, high gas fees, suspicious addresses
2. **Portfolio Insights:** Token concentration, diversification score, performance analysis
3. **Tax Optimization:** Identify tax-loss harvesting opportunities, calculate gains/losses
4. **DeFi Strategy:** Suggest optimal staking positions, yield opportunities
5. **Security Alerts:** Unusual activity, potential scams, unverified contracts
6. **Educational Guidance:** Explain complex transactions, DeFi concepts

**Data Sources:**
- `/wallets/{address}/history` → Transaction patterns
- `/wallets/{address}/defi/positions` → DeFi exposure
- `/wallets/{address}/swaps` → Trading patterns
- `/wallets/{address}/tokens` → Portfolio composition
- External: Token risk scores, contract verification status

**AI Tools Needed:**
- **LLM:** GPT-4 or Claude for natural language analysis
- **Analytics Engine:** Calculate metrics (diversification, risk scores)
- **Pattern Recognition:** Identify suspicious activity, opportunities

**Implementation Approach:**
1. **Phase 1:** Basic insights (portfolio summary, top tokens, recent activity)
2. **Phase 2:** Risk analysis (high gas fees, unverified contracts, concentration risk)
3. **Phase 3:** Advanced AI (natural language explanations, personalized recommendations)

## 🏗️ Implementation Plan

### Phase 1: Fix Current Issues (Priority: CRITICAL)

#### 1.1 Fix Token Balance Endpoint
**File:** `lib/backend/providers/moralis-rest-client.ts`

**Changes:**
- Replace `/{address}/erc20` with `/wallets/{address}/tokens`
- Replace `/{address}/balance` with `/wallets/{address}/tokens` (includes native)
- Add chain name mapping (hex → name)
- Update response parsing to handle new format

**Benefits:**
- ✅ Fixes 404 error
- ✅ Reduces API calls by 50%
- ✅ Gets prices included in response
- ✅ Gets 24h change data included

#### 1.2 Update Chain Parameter Format
**File:** `lib/backend/providers/moralis.ts`

**Changes:**
- Add `CHAIN_NAME_MAP` for `/wallets/` endpoints
- Keep `CHAIN_ID_TO_MORALIS` for legacy endpoints
- Create helper: `getChainName(chainId: number): string`

### Phase 2: Optimize Token Fetching (Priority: HIGH)

#### 2.1 Consolidate Token Endpoints
**File:** `lib/backend/providers/moralis-rest-client.ts`

**New Function:**
```typescript
export async function getWalletTokensWithPrices(
  address: string,
  chainId: number,
  chainName: string
): Promise<any> {
  // Single call to /wallets/{address}/tokens
  // Returns native + ERC20 with prices
}
```

**Update:**
- `getEVMWalletTokens()` to use new endpoint
- Remove separate `getEVMNativeBalance()` and `getEVMTokenBalances()` calls

#### 2.2 Update Response Parsing
**File:** `lib/backend/providers/moralis.ts`

**Changes:**
- Parse `/wallets/{address}/tokens` response format
- Handle `native_token: true` flag for native tokens
- Extract `usd_price`, `usd_value`, `usd_price_24hr_percent_change`
- Filter spam tokens (`possible_spam: false`)
- Filter unverified contracts (`verified_contract: true`)

### Phase 3: Implement Wallet Features (Priority: MEDIUM)

#### 3.1 Total Wallet Balance
**Endpoint:** `/wallets/{address}/net-worth`
**File:** `lib/backend/providers/moralis-rest-client.ts`

**Implementation:**
```typescript
export async function getWalletNetWorth(
  address: string,
  chainIds: number[]
): Promise<{
  total_networth_usd: string;
  chains: Array<{
    chain: string;
    networth_usd: string;
  }>;
}> {
  const chainNames = chainIds.map(id => getChainName(id)).join(',');
  return makeMoralisRequest(
    `/wallets/${address}/net-worth`,
    {
      params: {
        chains: chainNames,
        exclude_spam: true,
        exclude_unverified_contracts: true,
      },
    }
  );
}
```

#### 3.2 Daily Percentage Change
**Data Source:** Already in `/wallets/{address}/tokens` response
**File:** `lib/backend/services/wallet-balance-service.ts`

**Implementation:**
```typescript
function calculateDailyChange(tokens: WalletToken[]): number {
  let totalChange = 0;
  let totalWeight = 0;
  
  for (const token of tokens) {
    const change = parseFloat(token.priceChange24h || '0');
    const weight = parseFloat(token.usdValue || '0');
    if (weight > 0) {
      totalChange += change * weight;
      totalWeight += weight;
    }
  }
  
  return totalWeight > 0 ? totalChange / totalWeight : 0;
}
```

#### 3.3 Sparkline Charts
**Endpoint:** `/token/{address}/price-history`
**File:** `lib/backend/providers/moralis-rest-client.ts`

**Implementation:**
```typescript
export async function getTokenPriceHistory(
  address: string,
  chainId: number,
  days: number = 1
): Promise<Array<{ timestamp: number; price: string }>> {
  const chainName = getChainName(chainId);
  return makeMoralisRequest(
    `/token/${address}/price-history`,
    {
      params: {
        chain: chainName,
        interval: '1h',
        days,
      },
      cacheKey: `price-history:${chainId}:${address}:${days}`,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
    }
  );
}
```

**Frontend:** Generate SVG sparkline from price data

### Phase 4: NFT Features (Priority: MEDIUM)

#### 4.1 NFT List with Metadata
**Endpoint:** `/{address}/nft`
**File:** `lib/backend/providers/moralis-rest-client.ts`

**Implementation:**
```typescript
export async function getWalletNFTs(
  address: string,
  chainId: number,
  options?: {
    limit?: number;
    cursor?: string;
  }
): Promise<any> {
  const chainName = getChainName(chainId);
  return makeMoralisRequest(
    `/${address}/nft`,
    {
      params: {
        chain: chainName,
        format: 'decimal',
        limit: options?.limit || 25,
        ...(options?.cursor && { cursor: options.cursor }),
      },
    }
  );
}
```

#### 4.2 NFT Collection Metadata
**Endpoint:** `/nft/{address}/metadata`
**File:** `lib/backend/providers/moralis-rest-client.ts`

**Returns:**
- `floor_price_usd` → Current floor price
- `total_supply` → Total NFTs in collection
- Collection metadata (name, description, image)

#### 4.3 NFT Activity
**Endpoint:** `/{address}/nft/transfers`
**File:** `lib/backend/providers/moralis-rest-client.ts`

**Implementation:**
- Filter by NFT contract address
- Categorize: received, sent, staked
- Display timeline

### Phase 5: Transaction History (Priority: MEDIUM)

#### 5.1 Complete Wallet History
**Endpoint:** `/wallets/{address}/history`
**File:** `lib/backend/services/transaction-history-service.ts`

**Implementation:**
- Replace current implementation with Moralis endpoint
- Parse transaction types (transfer, swap, DeFi, etc.)
- Categorize activities
- Support pagination

#### 5.2 Swap Transactions
**Endpoint:** `/wallets/{address}/swaps`
**File:** `lib/backend/services/transaction-history-service.ts`

**Returns:**
- Swap transactions only
- DEX name, pair, price, volume

#### 5.3 DeFi Positions
**Endpoint:** `/wallets/{address}/defi/positions`
**File:** `lib/backend/services/defi-service.ts` (new)

**Returns:**
- LP positions
- Staking positions
- Lending positions
- Total USD value

### Phase 6: AI Assistant (Priority: LOW - Future)

#### 6.1 Data Aggregation Service
**File:** `lib/backend/services/wallet-analytics-service.ts` (new)

**Responsibilities:**
- Aggregate all wallet data
- Calculate metrics (diversification, risk scores)
- Identify patterns (high gas, suspicious activity)
- Prepare data for AI analysis

#### 6.2 AI Analysis Engine
**File:** `lib/backend/services/ai-insights-service.ts` (new)

**Responsibilities:**
- Send aggregated data to LLM (GPT-4/Claude)
- Generate insights and recommendations
- Format responses for frontend

#### 6.3 Frontend AI Interface
**File:** `components/wallet/ai-assistant.tsx` (new)

**Features:**
- Chat interface
- Insight cards
- Risk alerts
- Educational explanations

## 📋 Detailed Implementation Steps

### Step 1: Fix Token Balance Endpoint (IMMEDIATE)

1. **Update `moralis-rest-client.ts`:**
   - Add `CHAIN_NAME_MAP`
   - Create `getChainName(chainId: number): string`
   - Replace `getEVMTokenBalances()` with `getWalletTokensWithPrices()`
   - Update endpoint to `/wallets/{address}/tokens`
   - Update chain parameter to use name format

2. **Update `moralis.ts`:**
   - Update `getEVMWalletTokens()` to use new endpoint
   - Parse new response format
   - Extract prices and 24h change from response
   - Remove redundant `getEVMNativeBalance()` call

3. **Test:**
   - Test with Polygon (chain 137) - should fix 404
   - Verify native token is included
   - Verify prices are included
   - Verify 24h change is included

### Step 2: Implement Total Balance (HIGH PRIORITY)

1. **Add endpoint:**
   ```typescript
   export async function getWalletNetWorth(address: string, chainIds: number[]): Promise<any>
   ```

2. **Update `wallet-balance-service.ts`:**
   - Use `/wallets/{address}/net-worth` for total balance
   - Fallback to sum of token USD values if endpoint fails

3. **Frontend:**
   - Display total balance prominently
   - Show breakdown by chain

### Step 3: Implement Daily Change (HIGH PRIORITY)

1. **Update `wallet-balance-service.ts`:**
   - Extract `usd_price_24hr_percent_change` from token data
   - Calculate weighted average daily change
   - Return in response

2. **Frontend:**
   - Display percentage change with color (green/red)
   - Show absolute USD change

### Step 4: Implement Sparklines (MEDIUM PRIORITY)

1. **Add endpoint:**
   ```typescript
   export async function getTokenPriceHistory(address: string, chainId: number, days: number): Promise<any>
   ```

2. **Create service:**
   ```typescript
   // lib/backend/services/sparkline-service.ts
   export function generateSparklineSVG(prices: number[], isPositive: boolean): string
   ```

3. **Frontend:**
   - Display sparkline next to each token
   - Color: green if positive, red if negative

### Step 5: Implement NFT Features (MEDIUM PRIORITY)

1. **Add endpoints:**
   - `getWalletNFTs()`
   - `getNFTCollectionMetadata()`
   - `getNFTTransfers()`

2. **Create service:**
   ```typescript
   // lib/backend/services/nft-service.ts
   export class NFTService {
     async getWalletNFTs(address: string, chainIds: number[]): Promise<NFT[]>
     async getNFTMetadata(contractAddress: string, chainId: number): Promise<NFTMetadata>
     async getNFTActivity(address: string, contractAddress: string): Promise<NFTActivity[]>
   }
   ```

3. **Frontend:**
   - NFT gallery component
   - NFT detail modal
   - Activity timeline

### Step 6: Implement Transaction History (MEDIUM PRIORITY)

1. **Update `transaction-history-service.ts`:**
   - Use `/wallets/{address}/history` endpoint
   - Parse transaction types
   - Categorize activities

2. **Frontend:**
   - Activity feed component
   - Filter by type (swap, transfer, DeFi)
   - Transaction detail modal

### Step 7: Implement AI Assistant (LOW PRIORITY - Future)

1. **Create analytics service:**
   ```typescript
   // lib/backend/services/wallet-analytics-service.ts
   export class WalletAnalyticsService {
     async analyzeWallet(address: string): Promise<WalletAnalysis>
     calculateRiskScore(tokens: WalletToken[]): number
     calculateDiversificationScore(tokens: WalletToken[]): number
     identifyOpportunities(positions: DeFiPosition[]): Opportunity[]
   }
   ```

2. **Create AI service:**
   ```typescript
   // lib/backend/services/ai-insights-service.ts
   export class AIInsightsService {
     async generateInsights(analysis: WalletAnalysis): Promise<Insight[]>
     async explainTransaction(tx: Transaction): Promise<string>
     async recommendActions(wallet: WalletData): Promise<Recommendation[]>
   }
   ```

3. **Frontend:**
   - AI chat interface
   - Insight cards
   - Risk alerts

## 🔧 Code Structure Recommendations

### New Files to Create

```
lib/backend/
├── providers/
│   └── moralis-rest-client.ts (UPDATE - fix endpoints)
├── services/
│   ├── wallet-balance-service.ts (UPDATE - use new endpoint)
│   ├── nft-service.ts (NEW)
│   ├── defi-service.ts (NEW)
│   ├── sparkline-service.ts (NEW)
│   ├── wallet-analytics-service.ts (NEW - for AI)
│   └── ai-insights-service.ts (NEW - for AI)
└── types/
    ├── wallet.ts (UPDATE - add new fields)
    └── nft.ts (NEW)
```

### Updated Types

```typescript
// lib/backend/types/wallet.ts
export interface WalletToken {
  // ... existing fields
  priceChange24h?: string;  // NEW - from /wallets/{address}/tokens
  usdValue?: string;        // NEW - from /wallets/{address}/tokens
  portfolioPercentage?: string;  // NEW - from /wallets/{address}/tokens
}

export interface WalletBalanceResponse {
  // ... existing fields
  dailyChange?: number;     // NEW - calculated from tokens
  dailyChangeUSD?: string;   // NEW - calculated from tokens
}
```

## 🚀 Performance Optimizations

### Caching Strategy

| Data Type | Cache TTL | Reason |
|-----------|-----------|--------|
| Token balances | 30 seconds | Changes frequently |
| Total net worth | 30 seconds | Changes frequently |
| Price history (sparklines) | 5 minutes | Prices don't change hourly |
| NFT metadata | 1 hour | Rarely changes |
| Transaction history | 5 minutes | New transactions infrequent |
| DeFi positions | 1 minute | Can change with market |

### API Call Optimization

**Before:**
- Native balance: 1 call per chain
- ERC20 tokens: 1 call per chain
- **Total: 2 calls per chain**

**After:**
- All tokens (native + ERC20): 1 call per chain
- **Total: 1 call per chain (50% reduction!)**

**For 7 chains:**
- Before: 14 API calls
- After: 7 API calls
- **Savings: 50% API usage**

## 🔒 Security Considerations

1. **API Key Protection:**
   - ✅ Already implemented (server-side only)
   - ✅ Key rotation implemented
   - ✅ Rate limit handling implemented

2. **Data Privacy:**
   - Cache wallet data securely
   - Don't log sensitive information
   - Implement request rate limiting per user

3. **Error Handling:**
   - Graceful degradation if Moralis is down
   - Fallback to alternative data sources
   - User-friendly error messages

## 📈 Success Metrics

### Phase 1 (Fix Issues)
- ✅ 404 errors resolved
- ✅ API calls reduced by 50%
- ✅ Prices included in response

### Phase 2 (Core Features)
- ✅ Total balance displayed
- ✅ Daily change calculated
- ✅ Token list with prices

### Phase 3 (Enhanced Features)
- ✅ Sparklines displayed
- ✅ NFT gallery functional
- ✅ Transaction history complete

### Phase 4 (AI Assistant)
- ✅ Basic insights generated
- ✅ Risk analysis working
- ✅ User engagement with AI

## 🎯 Next Steps (Immediate Action Items)

1. **Fix token balance endpoint** (1-2 hours)
   - Update `moralis-rest-client.ts`
   - Update `moralis.ts`
   - Test with Polygon

2. **Implement total balance** (2-3 hours)
   - Add `/wallets/{address}/net-worth` endpoint
   - Update service
   - Update frontend

3. **Implement daily change** (1-2 hours)
   - Calculate from token data
   - Update frontend

4. **Implement sparklines** (4-6 hours)
   - Add price history endpoint
   - Create sparkline generator
   - Update frontend

5. **Plan AI assistant** (Research phase)
   - Define use cases
   - Choose LLM provider
   - Design data flow

## 💡 Recommendations

1. **Prioritize Phase 1 & 2:** Fix current issues and implement core features first
2. **Incremental Rollout:** Implement features one at a time, test thoroughly
3. **Monitor API Usage:** Track Moralis API calls to optimize further
4. **User Feedback:** Gather feedback on AI assistant features before full implementation
5. **Performance:** Monitor response times, optimize caching

## 📚 Resources

- [Moralis Wallet API Docs](https://docs.moralis.com/web3-data-api/evm/reference/get-wallet-tokens)
- [Moralis NFT API Docs](https://docs.moralis.com/web3-data-api/evm/reference/get-wallet-nfts)
- [Moralis Transaction API Docs](https://docs.moralis.com/web3-data-api/evm/reference/get-wallet-history)

---

**Status:** Ready for implementation
**Estimated Time:** 
- Phase 1: 2-3 hours
- Phase 2: 4-6 hours
- Phase 3: 8-12 hours
- Phase 4: 16-24 hours (future)

**Priority:** Fix current issues → Core features → Enhanced features → AI assistant

