# Market Page (`/market/[pair]`) - Data Analysis & Implementation Plan

## Executive Summary

This document provides a comprehensive analysis of the `/market/[pair]` page, clearly differentiating between **mock data** and **real data**, and provides detailed implementation recommendations for each component to achieve industry-standard real-time trading functionality.

---

## 1. MOCK DATA IDENTIFICATION

### 1.1 Token Header Component (`components/market/token-header.tsx`)

**MOCK DATA:**
- ✅ **Token Data** (`token` prop):
  - `symbol`: From `getTokenByPair()` - **MOCK** (hardcoded in `trading-mock-data.ts`)
  - `pair`: From `getTokenByPair()` - **MOCK** (parsed from URL, but data is hardcoded)
  - `icon`: From `getTokenByPair()` - **MOCK** (hardcoded Figma URL)
  - `price`: From `getTokenStats()` - **MOCK** (hardcoded "$89,000.02")
  - `change`: From `getTokenStats()` - **MOCK** (hardcoded "+1.13%")
  - `changePositive`: From `getTokenStats()` - **MOCK** (hardcoded `true`)

- ✅ **Token Stats** (`stats` prop):
  - `price`: **MOCK** - Hardcoded "$89,000.02"
  - `change`: **MOCK** - Hardcoded "+1.13%"
  - `changePositive`: **MOCK** - Hardcoded `true`
  - `vol24h`: **MOCK** - Hardcoded "$905.87B"
  - `high24h`: **MOCK** - Hardcoded "$243.08M"
  - `low24h`: **MOCK** - Hardcoded "$202.08M"

**REAL DATA SOURCES AVAILABLE:**
- ✅ Token metadata: `TokenService` (already exists) - Can fetch real token data by address/chainId
- ✅ Token prices: `PriceProvider` (already exists) - Can fetch real USD prices
- ✅ 24h stats: Can be calculated from chart data or fetched from DexScreener/Bitquery

---

### 1.2 Trading Form Component (`components/market/trading-form.tsx`)

**MOCK DATA:**
- ✅ **Available Balance**: Hardcoded `"10 USDT"` (line 22)
- ✅ **Market Price Calculation**: Placeholder logic (line 49: `quantity = "0.00000000"` for Market orders)
- ✅ **Fee Calculation**: Hardcoded `"0.00"` (line 55)

**REAL DATA SOURCES AVAILABLE:**
- ✅ Wallet balance: `WalletBalanceService` (already exists) - Can fetch real wallet balances
- ✅ Current market price: Available from orderbook or chart data
- ✅ Fee calculation: Can be fetched from router service or DEX protocol

**NOT MOCK (Functional):**
- ✅ Buy/Sell toggle - **REAL** (UI state)
- ✅ Market/Limit order type - **REAL** (UI state)
- ✅ Order value input - **REAL** (UI state)
- ✅ Limit price input - **REAL** (UI state)
- ✅ Percentage slider - **REAL** (UI state)
- ✅ Order validation logic - **REAL** (functional)

**MISSING FUNCTIONALITY:**
- ❌ Wallet connection check
- ❌ Order submission to backend
- ❌ Transaction signing
- ❌ Order confirmation modal

---

### 1.3 Chart Section Component (`components/market/chart-section.tsx`)

**MOCK DATA:**
- ❌ **NONE** - Chart uses TradingView Advanced Charts with real datafeed

**REAL DATA:**
- ✅ **Chart Data**: Uses `TradingViewDatafeed` which connects to `/api/v1/charts/history` - **REAL**
- ✅ **OHLCV Data**: Fetched from Bitquery/DexScreener via `ChartDataService` - **REAL**
- ✅ **Chart Widget**: TradingView library - **REAL**

**NOTES:**
- Chart is already fully functional with real data
- Uses the same charting system implemented for swap page
- No changes needed for chart functionality

---

### 1.4 Orderbook Section Component (`components/market/orderbook-section.tsx`)

**MOCK DATA:**
- ✅ **Orderbook Data**:
  - `MOCK_ASKS`: Hardcoded array of 8 sell orders (lines 41-50 in `trading-mock-data.ts`)
  - `MOCK_BIDS`: Hardcoded array of 8 buy orders (lines 53-62 in `trading-mock-data.ts`)
  - `currentPrice`: Hardcoded `"89,000.02"` (line 19)
  - `getDepthHeight()`: Hardcoded height arrays (lines 24-27)

- ✅ **Recent Trades**:
  - `MOCK_RECENT_TRADES`: Hardcoded array (lines 65-74 in `trading-mock-data.ts`)
  - Currently shows "Trades view coming soon..." (line 220)

**REAL DATA SOURCES NEEDED:**
- ❌ Orderbook API endpoint - **NOT YET IMPLEMENTED**
- ❌ WebSocket connection for real-time orderbook updates - **NOT YET IMPLEMENTED**
- ❌ Recent trades API endpoint - **NOT YET IMPLEMENTED**

---

### 1.5 Orders Table Component (`components/market/orders-table.tsx`)

**MOCK DATA:**
- ✅ **Orders Data**: `MOCK_ORDERS` - Hardcoded array with 1 order (lines 77-86 in `trading-mock-data.ts`)
- ✅ **Transaction History**: Not implemented (tab exists but no data)

**REAL DATA SOURCES AVAILABLE:**
- ✅ Transaction history: `TransactionHistoryService` (already exists) - Can fetch user's transaction history
- ❌ User orders: **NOT YET IMPLEMENTED** - Need order management API

**MISSING FUNCTIONALITY:**
- ❌ Fetch user's active orders from backend
- ❌ Display order status (pending, filled, cancelled)
- ❌ Cancel order functionality
- ❌ Transaction history filtering and pagination

---

### 1.6 Overview Section Component (`components/market/overview-section.tsx`)

**MOCK DATA:**
- ✅ **Token Information**:
  - `about`: Hardcoded Bitcoin description (line 19)
  - `tokenName`: Hardcoded "Bitcoin" (line 20)
  - `network`: Hardcoded "BTC" (line 21)
  - `contract`: Hardcoded "0x1111...fc69" (line 22)
  - `officialX`: Hardcoded "@BTC" (line 23)
  - `website`: Hardcoded "bitcoin.com" (line 24)

- ✅ **Market Stats**:
  - `marketCap`: Hardcoded "$520.98M" (line 25)
  - `liquidity`: Hardcoded "$2.08T" (line 26)
  - `volume24h`: Hardcoded "$9.55M" (line 27)

- ✅ **Supply Stats**:
  - `circulatingSupply`: Hardcoded "4,469,999,998" (line 28)
  - `totalSupply`: Hardcoded "10,000,000,000" (line 29)
  - `maxSupply`: Hardcoded "10,000,000,000" (line 30)

**REAL DATA SOURCES AVAILABLE:**
- ✅ Token metadata: `TokenService` - Can fetch real token name, symbol, contract address
- ✅ Token prices: `PriceProvider` - Can fetch real prices
- ✅ Market stats: Can be calculated from token price and supply, or fetched from DexScreener
- ❌ Token description/about: Need to fetch from CoinGecko API or similar
- ❌ Social links: Need to fetch from token metadata or CoinGecko

---

### 1.7 Main Page Component (`app/market/[pair]/page.tsx`)

**MOCK DATA:**
- ✅ **Token Data Fetching**: Uses `getTokenByPair()` and `getTokenStats()` - **MOCK** (lines 48-49)
- ✅ **Loading Simulation**: `setTimeout(500ms)` - **MOCK** (line 47)

**REAL DATA SOURCES AVAILABLE:**
- ✅ Token service: `TokenService` - Can fetch real token data
- ✅ Price service: `PriceProvider` - Can fetch real prices
- ✅ Chart service: `ChartDataService` - Already functional

---

## 2. IMPLEMENTATION RECOMMENDATIONS

### 2.1 Token Header - Real Data Integration

**Current State:** All data is mock (hardcoded values)

**Implementation Plan:**

1. **Create API Route**: `app/api/v1/market/[pair]/route.ts`
   ```typescript
   // GET /api/v1/market/BTC-USDT
   // Returns: { token, stats }
   ```

2. **Backend Service**: `lib/backend/services/market-service.ts`
   ```typescript
   class MarketService {
     async getTokenByPair(pair: string): Promise<TokenData>
     async getTokenStats(pair: string): Promise<TokenStats>
   }
   ```

3. **Data Sources:**
   - **Token metadata**: Use `TokenService.searchTokens()` to find token by symbol
   - **Price**: Use `PriceProvider.getTokenPrice()` for current price
   - **24h stats**: 
     - Calculate from chart data (fetch last 24h bars)
     - OR use DexScreener API: `https://api.dexscreener.com/latest/dex/tokens/{address}`
   - **24h High/Low**: Calculate from 24h OHLCV data
   - **24h Volume**: Sum volume from 24h bars or fetch from DexScreener

4. **Real-time Updates:**
   - Use WebSocket or polling (every 5-10 seconds) for price updates
   - Update `stats.price` and `stats.change` in real-time

**Files to Create/Modify:**
- ✅ Create: `lib/backend/services/market-service.ts`
- ✅ Create: `app/api/v1/market/[pair]/route.ts`
- ✅ Modify: `app/market/[pair]/page.tsx` - Replace mock data fetching with API call
- ✅ Modify: `components/market/token-header.tsx` - Add real-time price updates

---

### 2.2 Trading Form - Real Data Integration

**Current State:** Balance is mock, order submission is placeholder

**Implementation Plan:**

1. **Wallet Balance Integration:**
   - Use `WalletBalanceService.getWalletTokensWithPrices()`
   - Filter for quote token (USDT, WBNB, etc.)
   - Display real balance: `availableBalance = balance[quoteToken]`

2. **Market Price Integration:**
   - For Market orders: Fetch current price from orderbook or chart
   - Use `currentPrice` from orderbook component
   - Calculate quantity: `quantity = orderValue / currentPrice`

3. **Fee Calculation:**
   - Fetch fee rate from router service (e.g., 0.3% for Uniswap V2)
   - Calculate: `fee = orderValue * feeRate`
   - Display: `fee.toFixed(2)`

4. **Order Submission:**
   - Create API route: `app/api/v1/orders/route.ts` (POST)
   - Validate order (balance check, price check)
   - Create order in database
   - Return order ID
   - Frontend: Show confirmation modal
   - Execute via wallet (use existing wallet connection)
   - Track order status

**Files to Create/Modify:**
- ✅ Create: `app/api/v1/orders/route.ts`
- ✅ Create: `lib/backend/services/order-service.ts`
- ✅ Modify: `components/market/trading-form.tsx`:
  - Replace hardcoded balance with `WalletBalanceService`
  - Add wallet connection check
  - Implement order submission
  - Add confirmation modal
  - Add error handling

---

### 2.3 Orderbook Section - Real Data Integration

**Current State:** All orderbook data is mock

**Implementation Plan:**

1. **Orderbook Data Source Options:**

   **Option A: Aggregate from Multiple DEXs (Recommended)**
   - Fetch orderbook from multiple DEXs (Uniswap, PancakeSwap, etc.)
   - Aggregate orders by price level
   - Use existing router adapters (Uniswap, PancakeSwap)

   **Option B: Use DexScreener API**
   - Endpoint: `https://api.dexscreener.com/latest/dex/pairs/{chainId}/{address}`
   - Provides orderbook depth data
   - Free, no API key needed

   **Option C: Build Custom Orderbook Aggregator**
   - Query multiple DEX contracts directly
   - Aggregate orders
   - More complex but most accurate

2. **Backend Implementation:**
   ```typescript
   // lib/backend/services/orderbook-service.ts
   class OrderbookService {
     async getOrderbook(pair: string, chainId: number): Promise<Orderbook>
     async subscribeOrderbook(pair: string, callback: (orderbook: Orderbook) => void)
   }
   ```

3. **Real-time Updates:**
   - **WebSocket Connection** (Recommended):
     - Create WebSocket endpoint: `app/api/v1/market/ws/route.ts`
     - Subscribe to orderbook updates
     - Push updates to client every 100-500ms
   - **Polling** (Fallback):
     - Poll every 1-2 seconds
     - Less efficient but simpler

4. **Depth Visualization:**
   - Calculate depth heights from actual orderbook data
   - Formula: `height = (cumulativeQuantity / maxCumulativeQuantity) * maxHeight`

5. **Recent Trades:**
   - Fetch from Bitquery: Recent trades query
   - OR use DexScreener trades endpoint
   - Display last 20-50 trades
   - Update in real-time via WebSocket

**Files to Create/Modify:**
- ✅ Create: `lib/backend/services/orderbook-service.ts`
- ✅ Create: `app/api/v1/market/orderbook/[pair]/route.ts`
- ✅ Create: `app/api/v1/market/trades/[pair]/route.ts`
- ✅ Create: `lib/frontend/hooks/use-orderbook.ts` (WebSocket hook)
- ✅ Modify: `components/market/orderbook-section.tsx`:
  - Replace `MOCK_ASKS` and `MOCK_BIDS` with API data
  - Add WebSocket subscription
  - Calculate real depth heights
  - Implement trades tab

---

### 2.4 Orders Table - Real Data Integration

**Current State:** Orders are mock, transaction history not implemented

**Implementation Plan:**

1. **User Orders:**
   - Create API route: `app/api/v1/orders/user/route.ts` (GET)
   - Fetch user's active orders from database
   - Filter by pair if needed
   - Return: `{ orders: Order[] }`

2. **Order Management:**
   - Create API route: `app/api/v1/orders/[orderId]/route.ts` (DELETE)
   - Cancel order functionality
   - Update order status

3. **Transaction History:**
   - Use existing `TransactionHistoryService`
   - Filter by pair
   - Display: Date, Type, Amount, Price, Status
   - Add pagination

4. **Database Schema** (if not exists):
   ```typescript
   interface Order {
     id: string;
     userId: string;
     pair: string;
     side: 'buy' | 'sell';
     type: 'market' | 'limit';
     price?: number;
     quantity: number;
     value: number;
     status: 'pending' | 'filled' | 'cancelled';
     createdAt: Date;
     filledAt?: Date;
   }
   ```

**Files to Create/Modify:**
- ✅ Create: `app/api/v1/orders/user/route.ts`
- ✅ Create: `app/api/v1/orders/[orderId]/route.ts`
- ✅ Create: `lib/backend/services/order-service.ts`
- ✅ Modify: `components/market/orders-table.tsx`:
  - Replace `MOCK_ORDERS` with API data
  - Implement transaction history tab
  - Add cancel order functionality
  - Add loading states

---

### 2.5 Overview Section - Real Data Integration

**Current State:** All data is mock (hardcoded Bitcoin info)

**Implementation Plan:**

1. **Token Metadata:**
   - Use `TokenService` to fetch token data
   - Get: name, symbol, contract address, chain
   - Fetch logo from token metadata

2. **Token Description:**
   - **CoinGecko API** (Recommended):
     - Endpoint: `https://api.coingecko.com/api/v3/coins/{id}`
     - Provides: description, links (website, twitter), market data
   - **Fallback**: Use token name and basic info

3. **Market Stats:**
   - **Market Cap**: `price * totalSupply`
   - **Liquidity**: Fetch from DexScreener or calculate from DEX reserves
   - **24h Volume**: Sum from 24h chart data or fetch from DexScreener

4. **Supply Stats:**
   - **Circulating Supply**: Fetch from CoinGecko or token contract
   - **Total Supply**: Fetch from token contract (`totalSupply()`)
   - **Max Supply**: Fetch from token contract or CoinGecko

**Files to Create/Modify:**
- ✅ Create: `lib/backend/providers/coingecko-provider.ts` (if not exists)
- ✅ Create: `app/api/v1/market/[pair]/overview/route.ts`
- ✅ Modify: `components/market/overview-section.tsx`:
  - Replace mock data with API data
  - Add loading states
  - Handle missing data gracefully

---

## 3. DATA FLOW ARCHITECTURE

### 3.1 Recommended Architecture

```
Frontend (React Components)
    ↓
API Routes (/api/v1/market/*)
    ↓
Backend Services (MarketService, OrderbookService, OrderService)
    ↓
Data Providers (DexScreener, Bitquery, CoinGecko, DEX Contracts)
    ↓
External APIs / Blockchain
```

### 3.2 Real-time Updates Strategy

**Option 1: WebSocket (Recommended for Orderbook)**
- Single WebSocket connection per page
- Subscribe to: orderbook updates, price updates, trades
- Efficient, low latency

**Option 2: Server-Sent Events (SSE)**
- Simpler than WebSocket
- One-way (server → client)
- Good for price updates

**Option 3: Polling**
- Simple to implement
- Less efficient
- Good for non-critical updates (every 5-10 seconds)

**Recommendation:**
- **Orderbook**: WebSocket (high frequency, critical)
- **Price Updates**: WebSocket or SSE (medium frequency)
- **Token Stats**: Polling (low frequency, every 30-60 seconds)

---

## 4. IMPLEMENTATION PRIORITY

### Phase 1: Critical (Week 1)
1. ✅ Token Header - Real price and stats
2. ✅ Trading Form - Real wallet balance
3. ✅ Orderbook - Real data (even if not real-time)

### Phase 2: Important (Week 2)
4. ✅ Orderbook - Real-time updates (WebSocket)
5. ✅ Trading Form - Order submission
6. ✅ Orders Table - User orders

### Phase 3: Enhancement (Week 3)
7. ✅ Overview Section - Real token metadata
8. ✅ Recent Trades - Real-time trades feed
9. ✅ Transaction History - Full implementation

---

## 5. DATA PROVIDER RECOMMENDATIONS

### 5.1 Orderbook Data

**Primary: DexScreener API**
- ✅ Free
- ✅ Good coverage
- ✅ Simple REST API
- ❌ No WebSocket (polling required)
- Endpoint: `https://api.dexscreener.com/latest/dex/pairs/{chainId}/{address}`

**Alternative: Direct DEX Contracts**
- ✅ Most accurate
- ✅ Real-time via WebSocket
- ❌ Complex implementation
- ❌ Requires multiple DEX integrations

### 5.2 Token Metadata

**Primary: TokenService (Existing)**
- ✅ Already implemented
- ✅ Multi-provider support
- ✅ Cached

**Enhancement: CoinGecko API**
- ✅ Rich metadata (description, links)
- ✅ Market data
- ❌ Requires API key for high limits
- Endpoint: `https://api.coingecko.com/api/v3/coins/{id}`

### 5.3 Price & Stats

**Primary: PriceProvider (Existing)**
- ✅ Already implemented
- ✅ Multi-provider fallback

**Enhancement: Chart Data**
- ✅ Calculate 24h stats from OHLCV bars
- ✅ More accurate for custom pairs

---

## 6. FILES TO CREATE

### Backend Services
1. `lib/backend/services/market-service.ts` - Market data aggregation
2. `lib/backend/services/orderbook-service.ts` - Orderbook data fetching
3. `lib/backend/services/order-service.ts` - Order management

### API Routes
1. `app/api/v1/market/[pair]/route.ts` - Token data and stats
2. `app/api/v1/market/[pair]/orderbook/route.ts` - Orderbook data
3. `app/api/v1/market/[pair]/trades/route.ts` - Recent trades
4. `app/api/v1/market/[pair]/overview/route.ts` - Token overview
5. `app/api/v1/orders/route.ts` - Create order (POST)
6. `app/api/v1/orders/user/route.ts` - User orders (GET)
7. `app/api/v1/orders/[orderId]/route.ts` - Cancel order (DELETE)
8. `app/api/v1/market/ws/route.ts` - WebSocket endpoint (optional)

### Frontend Hooks
1. `lib/frontend/hooks/use-market-data.ts` - Market data fetching
2. `lib/frontend/hooks/use-orderbook.ts` - Orderbook WebSocket
3. `lib/frontend/hooks/use-orders.ts` - User orders management

### Providers (if needed)
1. `lib/backend/providers/coingecko-provider.ts` - CoinGecko API integration

---

## 7. SUMMARY

### Mock Data Summary
- ✅ **Token Header**: 100% mock (price, stats, token data)
- ✅ **Trading Form**: 80% mock (balance, fees)
- ✅ **Chart**: 0% mock (fully real)
- ✅ **Orderbook**: 100% mock (all orderbook data)
- ✅ **Orders Table**: 100% mock (orders, no transaction history)
- ✅ **Overview**: 100% mock (all token info)

### Real Data Available
- ✅ Token metadata (TokenService)
- ✅ Token prices (PriceProvider)
- ✅ Chart OHLCV data (ChartDataService)
- ✅ Wallet balances (WalletBalanceService)
- ✅ Transaction history (TransactionHistoryService)

### Missing Infrastructure
- ❌ Orderbook API/service
- ❌ Order management API/service
- ❌ Real-time WebSocket infrastructure
- ❌ Market stats calculation service
- ❌ Token metadata enrichment (CoinGecko)

---

## 8. NEXT STEPS

1. **Review this document** and prioritize features
2. **Start with Phase 1** (Token Header + Trading Form balance)
3. **Implement orderbook service** using DexScreener API
4. **Add WebSocket infrastructure** for real-time updates
5. **Build order management system** for trading functionality

Each section above includes specific implementation details, file locations, and data sources to ensure successful integration.

































