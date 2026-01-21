# Moralis Integration: Implementation Plan

## 🎯 Goals

1. **Fix 404 Error** - Resolve Avalanche (chain 43114) and other chain errors
2. **Optimize API Calls** - Use `/wallets/{address}/tokens` endpoint (50% reduction)
3. **Portfolio Features** - Replace mock data with real Moralis data
4. **Future-Proof** - Build foundation for AI copilot features

## 🔍 Current Issues

### Issue 1: 404 Error for Chain 43114 (Avalanche)
**Root Cause:**
- Fallback function `getEVMWalletTokensFallback` uses old endpoint `/{address}/erc20`
- Old endpoint uses hex chain format (`0xa86a`) which may not work for all chains
- Should use `/wallets/{address}/tokens` with chain names

**Fix:**
- Remove or update fallback to use correct endpoint format
- Ensure all chains use `/wallets/{address}/tokens` endpoint

### Issue 2: Portfolio Page Uses Mock Data
**Current Mock Data:**
- `balance` - Hardcoded "$4,631.21"
- `assets` - Hardcoded token list
- `nfts` - Hardcoded NFT list
- `transactions` - Hardcoded transaction list
- Daily change - Hardcoded "+$61.69 (+2.15%)"

**Needs Real Data:**
- Total wallet balance (USD)
- Daily percentage change (calculated from token price changes)
- Token list with real balances and prices
- NFT list with metadata
- Transaction history

## 📋 Implementation Phases

### Phase 1: Fix Critical Errors (IMMEDIATE)
**Priority: CRITICAL**
**Time: 1-2 hours**

#### 1.1 Fix 404 Error for Avalanche
- [ ] Remove or fix `getEVMWalletTokensFallback` to use correct endpoint
- [ ] Ensure all chains use `/wallets/{address}/tokens` with chain names
- [ ] Test with Avalanche (43114) and other chains
- [ ] Add proper error handling and logging

#### 1.2 Verify Chain Name Mapping
- [ ] Verify all supported chains are in `CHAIN_NAME_MAP`
- [ ] Test each chain to ensure correct mapping
- [ ] Add missing chains if needed

### Phase 2: Enhance Wallet Balance Service (HIGH PRIORITY)
**Priority: HIGH**
**Time: 2-3 hours**

#### 2.1 Add Total Balance Endpoint
- [ ] Implement `/wallets/{address}/net-worth` endpoint
- [ ] Add `getWalletNetWorth()` function in `moralis-rest-client.ts`
- [ ] Update `WalletBalanceService` to use net-worth endpoint
- [ ] Fallback to sum of token USD values if endpoint fails

#### 2.2 Calculate Daily Percentage Change
- [ ] Extract `usd_price_24hr_percent_change` from token data
- [ ] Calculate weighted average based on USD values
- [ ] Add `dailyChange` and `dailyChangeUSD` to response
- [ ] Handle edge cases (no tokens, no price data)

#### 2.3 Enhance Token Data
- [ ] Ensure all token fields are extracted from Moralis response:
  - `usd_price` → `priceUSD`
  - `usd_value` → `usdValue`
  - `usd_price_24hr_percent_change` → `priceChange24h`
  - `portfolio_percentage` → `portfolioPercentage`
  - `verified_contract` → `verified`
  - `logo` / `thumbnail` → `logoURI`

### Phase 3: Portfolio Page Integration (HIGH PRIORITY)
**Priority: HIGH**
**Time: 3-4 hours**

#### 3.1 Replace Mock Balance Data
- [ ] Create hook `usePortfolioBalance()` to fetch total balance
- [ ] Display real total balance from API
- [ ] Show daily change with color (green/red)
- [ ] Add loading states and error handling

#### 3.2 Replace Mock Assets
- [ ] Use existing `useWalletBalances()` hook
- [ ] Map `WalletToken[]` to portfolio asset format
- [ ] Display real token balances, prices, and values
- [ ] Add sparkline charts (Phase 4)

#### 3.3 Replace Mock NFTs
- [ ] Create `useWalletNFTs()` hook
- [ ] Implement NFT fetching from Moralis
- [ ] Display NFT gallery with metadata
- [ ] Add NFT detail modal

#### 3.4 Replace Mock Transactions
- [ ] Use existing `useWalletTransactions()` hook
- [ ] Map transaction data to portfolio format
- [ ] Display real transaction history
- [ ] Add transaction filters

### Phase 4: NFT Features (MEDIUM PRIORITY)
**Priority: MEDIUM**
**Time: 4-6 hours**

#### 4.1 NFT Endpoints
- [ ] Implement `/{address}/nft` endpoint
- [ ] Implement `/nft/{address}/metadata` endpoint
- [ ] Implement `/{address}/nft/transfers` endpoint
- [ ] Add caching for NFT data

#### 4.2 NFT Service
- [ ] Create `NFTService` class
- [ ] Aggregate NFTs across chains
- [ ] Fetch collection metadata
- [ ] Calculate NFT values and floor prices

#### 4.3 NFT Components
- [ ] Create NFT gallery component
- [ ] Create NFT detail modal
- [ ] Display NFT metadata (name, image, attributes)
- [ ] Show NFT activity timeline

### Phase 5: Sparkline Charts (MEDIUM PRIORITY)
**Priority: MEDIUM**
**Time: 3-4 hours**

#### 5.1 Price History Endpoint
- [ ] Implement `/token/{address}/price-history` endpoint
- [ ] Add caching (5 minutes TTL)
- [ ] Support different time intervals

#### 5.2 Sparkline Generation
- [ ] Create `SparklineService` to generate SVG
- [ ] Calculate trend (green/red)
- [ ] Optimize for performance

#### 5.3 Integration
- [ ] Add sparklines to portfolio assets
- [ ] Add sparklines to wallet balance panel
- [ ] Responsive design

### Phase 6: AI Copilot Foundation (LOW PRIORITY - Future)
**Priority: LOW**
**Time: 16-24 hours (Future)**

#### 6.1 Data Aggregation
- [ ] Create `WalletAnalyticsService`
- [ ] Aggregate all wallet data
- [ ] Calculate metrics (risk, diversification)
- [ ] Identify patterns

#### 6.2 AI Integration
- [ ] Design AI copilot architecture
- [ ] Choose LLM provider
- [ ] Create prompt templates
- [ ] Implement insights generation

## 🏗️ Architecture Decisions

### 1. Endpoint Strategy
**Decision:** Use `/wallets/{address}/tokens` for all EVM chains
**Reason:**
- 50% fewer API calls
- Prices included in response
- 24h change included
- Portfolio percentage included

**Fallback:** Only if endpoint truly doesn't exist (shouldn't happen)

### 2. Caching Strategy
**Decision:** Provider-level caching with TTL
**TTLs:**
- Token balances: 30 seconds
- Total net worth: 30 seconds
- NFT metadata: 1 hour
- Price history: 5 minutes
- Transaction history: 5 minutes

### 3. Error Handling
**Decision:** Graceful degradation
- If one chain fails, continue with others
- If price fetch fails, show tokens without prices
- If NFT fetch fails, show empty state
- Log errors for debugging

### 4. Data Flow
```
Frontend Component
  ↓
Hook (useWalletBalances, usePortfolioBalance)
  ↓
API Route (/api/v1/wallet/balances)
  ↓
Service (WalletBalanceService)
  ↓
Provider (Moralis REST Client)
  ↓
Moralis API
```

## 📝 Code Structure

### New Files to Create
```
lib/backend/
├── providers/
│   └── moralis-rest-client.ts (UPDATE - fix endpoints)
├── services/
│   ├── wallet-balance-service.ts (UPDATE - add net-worth, daily change)
│   ├── nft-service.ts (NEW)
│   └── sparkline-service.ts (NEW)
└── types/
    ├── wallet.ts (UPDATE - add dailyChange fields)
    └── nft.ts (NEW)
```

### Updated Files
```
app/portfolio/page.tsx (REPLACE mock data)
components/wallet/wallet-balance-panel.tsx (ENHANCE with daily change)
hooks/useWalletBalances.ts (ENHANCE with daily change)
hooks/usePortfolioBalance.ts (NEW)
hooks/useWalletNFTs.ts (NEW)
```

## ✅ Success Criteria

### Phase 1 (Critical)
- [ ] No 404 errors for any supported chain
- [ ] All chains use `/wallets/{address}/tokens` endpoint
- [ ] Proper error handling and logging

### Phase 2 (High Priority)
- [ ] Total balance displayed correctly
- [ ] Daily change calculated and displayed
- [ ] All token fields populated from Moralis

### Phase 3 (High Priority)
- [ ] Portfolio page shows real data
- [ ] No mock data in portfolio
- [ ] Loading states and error handling

### Phase 4 (Medium Priority)
- [ ] NFTs displayed in portfolio
- [ ] NFT metadata fetched and displayed
- [ ] NFT activity timeline working

### Phase 5 (Medium Priority)
- [ ] Sparklines displayed for all tokens
- [ ] Correct colors (green/red)
- [ ] Performance optimized

## 🚀 Next Steps

1. **Start with Phase 1** - Fix critical 404 error
2. **Then Phase 2** - Enhance wallet balance service
3. **Then Phase 3** - Integrate with portfolio page
4. **Then Phase 4 & 5** - Add NFTs and sparklines
5. **Finally Phase 6** - AI copilot (future)

## 📊 Performance Targets

- API calls: 50% reduction (from 2 per chain to 1 per chain)
- Response time: < 500ms for wallet balance
- Cache hit rate: > 80% for repeated requests
- Error rate: < 1% for supported chains

