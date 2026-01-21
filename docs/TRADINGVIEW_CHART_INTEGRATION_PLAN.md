# TradingView Chart Integration Plan

**Status:** 📋 **PLAN - AWAITING APPROVAL**

**Goal:** Integrate TradingView Advanced Charting Library with Bitquery (primary) and DexScreener (fallback) data providers for OHLC historical and real-time chart data.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Design](#architecture-design)
3. [Implementation Phases](#implementation-phases)
4. [Technical Details](#technical-details)
5. [File Structure](#file-structure)
6. [API Design](#api-design)
7. [Data Flow](#data-flow)
8. [Error Handling & Fallbacks](#error-handling--fallbacks)
9. [Testing Strategy](#testing-strategy)
10. [Risks & Considerations](#risks--considerations)

---

## Overview

### Objectives
- ✅ Integrate TradingView Advanced Charting Library (already available in `charting_library/`)
- ✅ Fetch OHLC historical data from Bitquery GraphQL API
- ✅ Implement API key rotation system (similar to Moralis pattern)
- ✅ Create backend API endpoints for chart data (secure, reusable for web + mobile)
- ✅ Implement fallback to DexScreener when Bitquery fails
- ✅ Handle native tokens by converting to wrapped versions (WETH, WBNB, etc.)
- ✅ Support data fetching strategy: Pair → Base Token → Quote Token
- ✅ Create reusable React component for chart display
- ✅ Start with TWC/BNB pair on BSC (chainId: 56)

### Key Requirements
- **Simplicity**: Clean, maintainable code
- **Modularity**: Reusable components and services
- **Reusability**: Works across Swap page, Market page, and future pages
- **Security**: API keys stored server-side only
- **Performance**: Efficient data fetching and caching
- **Reliability**: Graceful fallbacks and error handling

---

## Architecture Design

### Why Separate Methods? (Important Clarification)

**TradingView's Datafeed Interface Requirements:**

TradingView's charting library **requires** a datafeed object with these methods:
- `onReady(callback)` - Called **first** to get chart configuration
- `resolveSymbol(symbolName, callback)` - Called to resolve symbol metadata (name, pricescale, supported resolutions, etc.)
- `getBars(symbolInfo, resolution, periodParams, callback)` - Called to fetch historical OHLC data
- `subscribeBars(...)` - Called for real-time WebSocket updates

**However**, we have two implementation options:

**Option A: Separate API Endpoints (UDF Protocol)**
- `/api/v1/charts/config` → Returns configuration
- `/api/v1/charts/symbols?symbol=...` → Returns symbol info
- `/api/v1/charts/history?symbol=...&resolution=...&from=...&to=...` → Returns OHLC bars
- **Pros**: Standard UDF protocol, easier to debug, clear separation
- **Cons**: Multiple HTTP calls, more endpoints to maintain

**Option B: Single Endpoint with Method Parameter (Simplified)**
- `/api/v1/charts/data?method=config|symbol|history&...` → Single endpoint handles all
- **Pros**: Simpler backend, fewer endpoints
- **Cons**: Less standard, harder to debug

**RECOMMENDATION**: Use **Option A (UDF Protocol)** because:
1. TradingView's UDF is a well-documented standard
2. Easier to debug (each endpoint has a clear purpose)
3. Better caching strategy (cache config separately from history)
4. The frontend datafeed adapter can still be simple - it just calls different endpoints

**But you're right** - we can simplify the frontend datafeed to just call our backend, and the backend handles all the complexity.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TradingViewChart Component (Reusable)                │  │
│  │  - Uses TradingView widget                            │  │
│  │  - Custom datafeed (implements TradingView interface) │  │
│  │  - Calls backend API endpoints                        │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP/WebSocket
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Backend API Routes (Next.js)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/v1/charts/config                                │  │
│  │  /api/v1/charts/symbols?symbol=...                   │  │
│  │  /api/v1/charts/history?symbol=...&resolution=...    │  │
│  │  /api/v1/charts/ws (WebSocket for real-time)          │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Chart Data Service Layer                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ChartDataService                                      │  │
│  │  - Orchestrates data fetching                         │  │
│  │  - Implements fallback logic                          │  │
│  │  - Handles data transformation                       │  │
│  │  - Manages caching (Redis - future)                  │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼────────┐          ┌─────────▼──────────┐
│ [Primary]      │          │ [Fallback]          │
│ Provider       │          │ DexScreener         │
│ (TBD - better  │          │ Provider            │
│  than Bitquery)│          │ - REST API          │
│ - GraphQL/REST │          │ - Limited history   │
│ - Key Rotation │          │                     │
└────────────────┘          └────────────────────┘
```

### Component Layers

1. **Frontend Layer**
   - `TradingViewChart` component (React)
   - Custom datafeed adapter (connects to backend API)
   - Symbol resolution logic

2. **API Layer**
   - Next.js API routes implementing UDF (Unified Data Feed) protocol
   - Handles TradingView's datafeed API requirements

3. **Service Layer**
   - `ChartDataService`: Main orchestration service
   - `BitqueryChartProvider`: Bitquery-specific implementation
   - `DexScreenerChartProvider`: DexScreener fallback implementation

4. **Utility Layer**
   - `BitqueryKeyManager`: API key rotation (similar to Moralis pattern)
   - `TokenAddressHelper`: Native token → wrapped token conversion
   - `ChartDataTransformer`: Bitquery/DexScreener → TradingView format

---

## Implementation Phases

### Phase 1: Backend Foundation (Week 1)

#### 1.1 Bitquery Key Manager
**File:** `lib/backend/utils/bitquery-key-manager.ts`

- Create key manager similar to `moralis-key-manager.ts`
- Support multiple API keys from env vars (`BITQUERY_API_KEY_1`, `BITQUERY_API_KEY_2`, ...)
- Implement key rotation on rate limit errors
- Track exhausted keys

**Key Functions:**
```typescript
- getCurrentApiKey(): string
- rotateToNextKey(): string | null
- markKeyAsExhausted(keyIndex: number): void
- isRateLimitError(error: any): boolean
```

#### 1.2 Token Address Helper
**File:** `lib/backend/utils/token-address-helper.ts`

- Convert native token addresses (0x000..., 0xeee...) to wrapped versions
- Use existing `WETH_ADDRESSES` mapping from router adapters
- Support all EVM chains

**Key Functions:**
```typescript
- convertToWrappedToken(address: string, chainId: number): string
- isNativeToken(address: string): boolean
```

#### 1.3 Primary Chart Provider (Better than Bitquery - TBD)
**File:** `lib/backend/providers/chart-provider.ts` (or specific provider name)

**Provider Options to Research:**
1. **CoinGecko** - Has OHLC API, free tier available
2. **CryptoCompare** - Historical OHLC data, good coverage
3. **Binance API** - For BSC pairs, free, reliable
4. **The Graph** - DEX indexing, on-chain data
5. **CoinAPI** - Unified data from multiple exchanges
6. **Finage Crypto API** - Real-time + historical OHLC

**Decision Needed**: Research and choose best provider based on:
- Cost (free tier availability)
- Data quality and coverage
- Historical data depth
- Real-time WebSocket support
- API rate limits
- Ease of integration

**Key Methods:**
```typescript
- fetchPairOHLC(params: PairOHLCParams): Promise<OHLCBar[]>
- fetchTokenOHLC(params: TokenOHLCParams): Promise<OHLCBar[]>
- subscribeRealtime(symbol: string, callback: (bar: OHLCBar) => void): WebSocket
- getSupportedResolutions(): ResolutionString[]
```

**Note**: We'll implement a provider interface so we can swap providers easily.

#### 1.4 DexScreener Chart Provider (Fallback)
**File:** `lib/backend/providers/dexscreener-chart-provider.ts`

- Implement REST API calls to DexScreener
- Fetch pair data: `GET /latest/dex/pairs/{chainId}/{pairAddress}`
- Transform DexScreener response to TradingView format
- Handle limited historical data (DexScreener has less history than Bitquery)

**Key Methods:**
```typescript
- fetchPairOHLC(params: PairOHLCParams): Promise<OHLCBar[]>
- fetchTokenOHLC(params: TokenOHLCParams): Promise<OHLCBar[]>
```

#### 1.5 Chart Data Service
**File:** `lib/backend/services/chart-data-service.ts`

- Orchestrate data fetching with fallback logic
- Implement strategy: Pair → Base Token → Quote Token
- **Caching Strategy** (Redis - future implementation):
  - Cache pair OHLC data for **12-24 hours** per pair per day
  - First user query → fetch from provider → store in cache
  - Subsequent users → serve from cache (no provider call)
  - Cache key format: `chart:ohlc:{pair}:{chainId}:{date}:{resolution}`
  - TTL: 24 hours (or until next day)
- Handle errors gracefully

**Key Methods:**
```typescript
- getHistoricalBars(params: ChartDataParams): Promise<OHLCBar[]>
  // Checks cache first, then provider, then stores in cache
- resolveSymbol(symbolName: string): Promise<SymbolInfo>
- getConfiguration(): Promise<ChartConfiguration>
- getCachedBars(cacheKey: string): Promise<OHLCBar[] | null>
- setCachedBars(cacheKey: string, bars: OHLCBar[], ttl: number): Promise<void>
```

**Data Fetching Strategy:**
1. **Check Redis cache** (if implemented)
   - Cache key: `chart:ohlc:{baseAddress}-{quoteAddress}-{chainId}:{date}:{resolution}`
   - If found and not expired → return cached data
2. If not cached, try to fetch pair OHLC data (base + quote)
3. If pair data not available, try base token OHLC
4. If base token not available, try quote token OHLC
5. If all fail, fallback to DexScreener
6. **Store in cache** (if successful) with 24-hour TTL
7. Return data

**Caching Implementation (Future - Phase 4):**
- Use Redis for distributed caching
- Cache structure:
  ```typescript
  {
    key: "chart:ohlc:0x123-0x456-56:2024-01-15:1h",
    value: OHLCBar[],
    ttl: 86400 // 24 hours in seconds
  }
  ```
- Benefits:
  - Multiple users querying same pair → only 1 provider call
  - Reduces API costs significantly
  - Faster response times

### Phase 2: API Routes (Week 1-2)

#### 2.1 Why Separate Endpoints? (Explanation)

**TradingView's Datafeed Interface:**
TradingView's charting library **requires** a datafeed object with specific methods:
- `onReady()` - Called **first** when chart initializes to get configuration
- `resolveSymbol()` - Called to get symbol metadata (name, pricescale, resolutions, etc.)
- `getBars()` - Called to fetch historical OHLC data
- `subscribeBars()` - Called to subscribe to real-time updates via WebSocket

**Why Not Just One Endpoint?**
You're right that we could use a single endpoint, but TradingView's architecture expects these methods to be called **at different times**:
1. Chart loads → calls `onReady()` → needs config immediately
2. User selects symbol → calls `resolveSymbol()` → needs symbol metadata
3. Chart requests data → calls `getBars()` → needs historical bars
4. Chart subscribes → calls `subscribeBars()` → needs WebSocket connection

**However**, we can simplify:
- **Frontend**: Custom datafeed that implements TradingView's interface
- **Backend**: Separate endpoints (easier to cache, debug, and maintain)
- **Alternative**: Single endpoint with `method` parameter (less standard, but possible)

**RECOMMENDATION**: Use separate endpoints because:
- Better caching (cache config separately from history)
- Easier debugging (each endpoint has clear purpose)
- Follows UDF standard (well-documented)
- Frontend datafeed is still simple (just calls different endpoints)

#### 2.2 API Routes Implementation
**Files:**
- `app/api/v1/charts/config/route.ts` - Chart configuration (static, cache forever)
- `app/api/v1/charts/symbols/route.ts` - Symbol resolution (cache 1 hour)
- `app/api/v1/charts/history/route.ts` - Historical OHLC data (cache 12-24 hours per pair)
- `app/api/v1/charts/ws/route.ts` - WebSocket endpoint for real-time updates

**UDF Protocol Endpoints:**

**GET /api/v1/charts/config**
```json
{
  "supported_resolutions": ["1", "5", "15", "30", "60", "1D", "1W", "1M"],
  "supports_group_request": false,
  "supports_marks": false,
  "supports_search": false,
  "supports_time": true,
  "supports_timescale_marks": false
}
```

**GET /api/v1/charts/symbols?symbol={symbolName}**
```json
{
  "name": "TWC/BNB",
  "ticker": "TWC/BNB",
  "description": "TWC/BNB on BSC",
  "type": "crypto",
  "session": "24x7",
  "timezone": "Etc/UTC",
  "exchange": "BSC",
  "listed_exchange": "BSC",
  "minmov": 1,
  "pricescale": 1000000000,
  "has_intraday": true,
  "has_daily": true,
  "has_weekly_and_monthly": false,
  "supported_resolutions": ["1", "5", "15", "30", "60", "1D", "1W", "1M"],
  "intraday_multipliers": ["1", "5", "15", "30", "60"],
  "volume_precision": 2,
  "data_status": "streaming"
}
```

**GET /api/v1/charts/history?symbol={symbol}&resolution={resolution}&from={timestamp}&to={timestamp}**
```json
{
  "s": "ok",
  "t": [1704067200, 1704067260, ...],
  "o": [0.001, 0.0011, ...],
  "h": [0.0012, 0.0013, ...],
  "l": [0.0009, 0.001, ...],
  "c": [0.0011, 0.0012, ...],
  "v": [1000000, 1200000, ...]
}
```

#### 2.2 Symbol Format
**Format:** `{baseTokenAddress}-{quoteTokenAddress}-{chainId}`

**Examples:**
- `0x123...abc-0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c-56` (TWC/BNB on BSC)
- `0x123...abc-0x0000000000000000000000000000000000000000-56` (TWC/ETH, auto-convert to WBNB)

**Parsing Logic:**
- Split by `-` to get base, quote, chainId
- Convert native tokens to wrapped versions
- Resolve token metadata (symbol, name, decimals)

### Phase 3: Frontend Integration (Week 2)

#### 3.1 Custom Datafeed Implementation
**File:** `lib/frontend/charts/tradingview-datafeed.ts`

- Implement TradingView's `IExternalDatafeed` interface
- Connect to backend API routes
- Handle symbol resolution
- Fetch historical bars
- Support real-time updates (optional, via WebSocket or polling)

**Key Methods:**
```typescript
- onReady(callback: OnReadyCallback): void
- resolveSymbol(symbolName: string, onResolve: ResolveCallback, onError: DatafeedErrorCallback): void
- getBars(symbolInfo: LibrarySymbolInfo, resolution: ResolutionString, periodParams: PeriodParams, onResult: HistoryCallback, onError: DatafeedErrorCallback): void
- subscribeBars(...): void (optional)
- unsubscribeBars(...): void (optional)
```

#### 3.2 TradingView Chart Component
**File:** `components/charts/tradingview-chart.tsx`

- React component wrapping TradingView widget
- Accepts props: `symbol`, `chainId`, `baseToken`, `quoteToken`
- Handles widget initialization and cleanup
- Responsive design
- Error boundaries

**Props Interface:**
```typescript
interface TradingViewChartProps {
  baseToken: string; // Token address
  quoteToken: string; // Token address (or native)
  chainId: number;
  height?: string | number;
  theme?: 'light' | 'dark';
  interval?: ResolutionString;
  onError?: (error: Error) => void;
}
```

**Usage Example:**
```tsx
<TradingViewChart
  baseToken="0xDA1060158F7D593667cCE0a15DB346BB3FfB3596"
  quoteToken="0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
  chainId={56}
  height="600px"
  theme="dark"
/>
```

#### 3.3 Integration Points
- **Swap Page**: Show chart for selected token pair
- **Market Page**: Show chart for each token in the table
- **Token Detail Page** (future): Full-screen chart view

### Phase 4: Testing & Optimization (Week 2-3)

#### 4.1 Unit Tests
- Test key rotation logic
- Test token address conversion
- Test data transformation
- Test fallback logic

#### 4.2 Integration Tests
- Test API endpoints
- Test datafeed implementation
- Test component rendering

#### 4.3 Performance Optimization
- Implement caching (Redis or in-memory)
- Optimize GraphQL queries
- Batch requests where possible
- Lazy load chart library

---

## Technical Details

### Bitquery GraphQL Queries

#### Pair OHLC Query (EVM)
```graphql
query PairOHLC(
  $network: evm_network!
  $baseToken: String!
  $quoteToken: String!
  $from: ISO8601DateTime!
  $to: ISO8601DateTime!
  $interval: Int!
) {
  EVM(network: $network, dataset: realtime) {
    DEXTradeByTokens(
      orderBy: { ascendingByField: "Block_Time" }
      where: {
        Trade: {
          Currency: { SmartContract: { is: $baseToken } }
          Side: { Currency: { SmartContract: { is: $quoteToken } } }
          PriceAsymmetry: { lt: 0.1 }
        }
        Block: { Time: { gte: $from, lte: $to } }
      }
    ) {
      Block {
        Time(interval: { count: $interval, in: minutes })
      }
      Trade {
        open: Price(minimum: Block_Number)
        close: Price(maximum: Block_Number)
        high: Price(maximum: Trade_Price)
        low: Price(minimum: Trade_Price)
      }
      volume: sum(of: Trade_Amount)
    }
  }
}
```

#### Single Token OHLC Query (EVM)
```graphql
query TokenOHLC(
  $network: evm_network!
  $token: String!
  $from: ISO8601DateTime!
  $to: ISO8601DateTime!
  $interval: Int!
) {
  EVM(network: $network) {
    DEXTradeByTokens(
      orderBy: { ascendingByField: "Block_Time" }
      where: {
        Trade: {
          Currency: { SmartContract: { is: $token } }
          PriceAsymmetry: { lt: 0.1 }
        }
        Block: { Time: { gte: $from, lte: $to } }
      }
    ) {
      Block {
        Time(interval: { count: $interval, in: minutes })
      }
      Trade {
        open: PriceInUSD(minimum: Block_Number)
        close: PriceInUSD(maximum: Block_Number)
        high: PriceInUSD(maximum: Trade_PriceInUSD)
        low: PriceInUSD(minimum: Trade_PriceInUSD)
      }
      volume: sum(of: Trade_Side_AmountInUSD, selectWhere: { gt: "0" })
    }
  }
}
```

### Resolution Mapping

TradingView resolutions → Bitquery intervals:
- `"1"` → 1 minute
- `"5"` → 5 minutes
- `"15"` → 15 minutes
- `"30"` → 30 minutes
- `"60"` → 1 hour
- `"1D"` → 1 day
- `"1W"` → 1 week
- `"1M"` → 1 month

### Data Transformation

**Bitquery Response → TradingView Format:**
```typescript
interface BitqueryOHLCResponse {
  EVM: {
    DEXTradeByTokens: Array<{
      Block: { Time: string };
      Trade: {
        open: number;
        close: number;
        high: number;
        low: number;
      };
      volume: string;
    }>;
  };
}

// Transform to:
interface TradingViewBar {
  time: number; // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

---

## File Structure

```
lib/
├── backend/
│   ├── providers/
│   │   ├── bitquery-chart-provider.ts      # NEW: Bitquery OHLC provider
│   │   └── dexscreener-chart-provider.ts    # NEW: DexScreener fallback
│   ├── services/
│   │   └── chart-data-service.ts            # NEW: Main chart data service
│   └── utils/
│       ├── bitquery-key-manager.ts          # NEW: API key rotation
│       └── token-address-helper.ts           # NEW: Native token conversion
│
├── frontend/
│   └── charts/
│       └── tradingview-datafeed.ts          # NEW: Custom datafeed adapter
│
app/
└── api/
    └── v1/
        └── charts/
            ├── config/
            │   └── route.ts                 # NEW: Chart configuration
            ├── symbols/
            │   └── route.ts                 # NEW: Symbol resolution
            ├── history/
            │   └── route.ts                 # NEW: Historical OHLC data
            └── quotes/
                └── route.ts                 # NEW: Real-time quotes (optional)

components/
└── charts/
    └── tradingview-chart.tsx                # NEW: Reusable chart component

charting_library/                            # EXISTING: TradingView library
└── ...
```

---

## API Design

### Request/Response Types

```typescript
// Chart Data Request
interface ChartDataRequest {
  symbol: string; // Format: "base-quote-chainId"
  resolution: ResolutionString; // "1", "5", "15", etc.
  from: number; // Unix timestamp (seconds)
  to: number; // Unix timestamp (seconds)
  countback?: number; // Optional: number of bars to fetch
}

// Chart Data Response (UDF format)
interface ChartDataResponse {
  s: 'ok' | 'no_data' | 'error';
  t?: number[]; // Timestamps (seconds)
  o?: number[]; // Open prices
  h?: number[]; // High prices
  l?: number[]; // Low prices
  c?: number[]; // Close prices
  v?: number[]; // Volumes
  nextTime?: number; // For pagination
  errmsg?: string; // Error message
}

// Symbol Info
interface SymbolInfo {
  name: string;
  ticker: string;
  description: string;
  type: string;
  session: string;
  timezone: string;
  exchange: string;
  listed_exchange: string;
  minmov: number;
  pricescale: number;
  has_intraday: boolean;
  has_daily: boolean;
  has_weekly_and_monthly: boolean;
  supported_resolutions: ResolutionString[];
  intraday_multipliers: string[];
  volume_precision: number;
  data_status: 'streaming' | 'endofday' | 'pulsed' | 'delayed_streaming';
}
```

---

## Data Flow

### Historical Data Flow

```
1. User opens Swap/Market page
   ↓
2. TradingViewChart component mounts
   ↓
3. TradingView widget requests symbol resolution
   ↓
4. Custom datafeed calls /api/v1/charts/symbols
   ↓
5. Backend resolves symbol, converts native tokens to wrapped
   ↓
6. TradingView widget requests historical bars
   ↓
7. Custom datafeed calls /api/v1/charts/history
   ↓
8. ChartDataService orchestrates data fetching:
   a. Try Bitquery pair OHLC
   b. If fails, try Bitquery base token OHLC
   c. If fails, try Bitquery quote token OHLC
   d. If all fail, try DexScreener
   ↓
9. Data transformed to TradingView format
   ↓
10. Chart renders with historical data
```

### Real-Time Data Flow (WebSocket Implementation)

**Important**: Real-time OHLC data requires WebSocket connection to data provider.

```
1. TradingView widget calls subscribeBars()
   ↓
2. Custom datafeed establishes WebSocket to /api/v1/charts/ws
   ↓
3. Backend WebSocket handler:
   a. Validates symbol and resolution
   b. Establishes WebSocket connection to data provider (Bitquery/other)
   c. Subscribes to real-time OHLC stream for that symbol
   ↓
4. Data provider sends new OHLC bars via WebSocket
   ↓
5. Backend transforms and forwards to frontend
   ↓
6. Frontend receives bar → TradingView chart updates in real-time
   ↓
7. On unsubscribeBars() → Close WebSocket connections
```

**WebSocket Implementation Details:**

**Backend WebSocket Route:** `app/api/v1/charts/ws/route.ts`
- Next.js 13+ App Router doesn't support WebSocket directly
- **Options**:
  1. Use **Server-Sent Events (SSE)** instead (simpler, HTTP-based)
  2. Use **separate WebSocket server** (Node.js + ws library)
  3. Use **polling** (simpler, but less efficient)

**RECOMMENDATION**: Start with **polling** (every 5-10 seconds), then upgrade to WebSocket/SSE later.

**Polling Implementation:**
```typescript
// Frontend datafeed
subscribeBars(symbolInfo, resolution, onTick, subscriberUID) {
  // Poll backend every 5 seconds
  const interval = setInterval(async () => {
    const latestBar = await fetch('/api/v1/charts/latest?symbol=...');
    if (latestBar) onTick(latestBar);
  }, 5000);
  
  this.subscribers[subscriberUID] = interval;
}
```

**WebSocket Implementation (Future):**
- Use `graphql-ws` client for Bitquery WebSocket
- Or provider's native WebSocket API
- Handle reconnection logic
- Forward bars to frontend via WebSocket

---

## Error Handling & Fallbacks

### Error Hierarchy

1. **Bitquery Rate Limit** → Rotate to next API key
2. **Bitquery API Error** → Fallback to DexScreener
3. **DexScreener Error** → Return empty data with error message
4. **Network Error** → Retry with exponential backoff
5. **Invalid Symbol** → Return `unknown_symbol` error

### Fallback Strategy

```
Primary: Bitquery (Pair OHLC)
  ↓ (if fails)
Fallback 1: Bitquery (Base Token OHLC)
  ↓ (if fails)
Fallback 2: Bitquery (Quote Token OHLC)
  ↓ (if fails)
Fallback 3: DexScreener (Pair data)
  ↓ (if fails)
Return: Empty data with error message
```

### Error Response Format

```typescript
interface ErrorResponse {
  s: 'error';
  errmsg: string;
  // TradingView will handle this gracefully
}
```

---

## Testing Strategy

### Unit Tests

1. **BitqueryKeyManager**
   - Test key rotation
   - Test exhausted key tracking
   - Test rate limit detection

2. **TokenAddressHelper**
   - Test native token conversion
   - Test all EVM chains
   - Test edge cases (invalid addresses)

3. **BitqueryChartProvider**
   - Test GraphQL query construction
   - Test response transformation
   - Test error handling

4. **ChartDataService**
   - Test fallback logic
   - Test data fetching strategy
   - Test caching

### Integration Tests

1. **API Routes**
   - Test `/api/v1/charts/config`
   - Test `/api/v1/charts/symbols`
   - Test `/api/v1/charts/history`
   - Test error responses

2. **End-to-End**
   - Test chart rendering on Swap page
   - Test chart rendering on Market page
   - Test symbol switching
   - Test resolution changes

### Manual Testing Checklist

- [ ] TWC/BNB pair displays correctly
- [ ] Historical data loads (1m, 5m, 15m, 1h, 1D)
- [ ] Chart updates when switching tokens
- [ ] Error handling works (invalid symbol, API failure)
- [ ] Fallback to DexScreener works
- [ ] Key rotation works when rate limited
- [ ] Native tokens convert to wrapped versions
- [ ] Responsive design works on different screen sizes

---

## Risks & Considerations

### Technical Risks

1. **Bitquery Rate Limits**
   - **Mitigation**: Multiple API keys with rotation
   - **Monitoring**: Track key usage and exhaustion

2. **Limited Historical Data**
   - **Risk**: Some tokens may have limited history
   - **Mitigation**: Graceful degradation, show available data

3. **GraphQL Query Complexity**
   - **Risk**: Complex queries may timeout
   - **Mitigation**: Optimize queries, add timeouts, pagination

4. **TradingView Library Size**
   - **Risk**: Large bundle size (~2MB)
   - **Mitigation**: Lazy load, code splitting

### Business Risks

1. **API Key Costs**
   - **Risk**: Bitquery API keys may be expensive
   - **Mitigation**: Monitor usage, implement caching

2. **Data Accuracy**
   - **Risk**: Bitquery data may not match other sources
   - **Mitigation**: Compare with DexScreener, document discrepancies

### Performance Considerations

1. **Caching Strategy**
   - Cache historical data (1-5 minutes TTL)
   - Cache symbol resolution (longer TTL)
   - Invalidate on new trades

2. **Query Optimization**
   - Limit time ranges for initial load
   - Use pagination for large datasets
   - Batch requests where possible

3. **Frontend Optimization**
   - Lazy load TradingView library
   - Debounce symbol changes
   - Virtualize chart if needed

---

## Next Steps

### Immediate Actions:
1. **Research Data Providers**: Compare alternatives to Bitquery
   - CoinGecko, CryptoCompare, Binance API, The Graph, CoinAPI, Finage
   - Evaluate: cost, data quality, historical depth, WebSocket support
   - **Decision**: Choose primary provider before Phase 1

2. **Review & Approval**: Get stakeholder approval on this revised plan
   - Address concerns about separate endpoints (explained above)
   - Confirm caching strategy (Redis, 12-24 hours)
   - Confirm real-time approach (polling first, WebSocket later)

3. **Environment Setup**: Configure chosen provider API keys in `.env`
   - Format: `CHART_PROVIDER_API_KEY_1`, `CHART_PROVIDER_API_KEY_2`, etc.
   - Similar to Moralis key rotation pattern

### Implementation Order:
1. **Phase 1**: Backend foundation (provider, service, helpers)
2. **Phase 2**: API routes (config, symbols, history)
3. **Phase 3**: Frontend integration (datafeed, component)
4. **Phase 4**: Optimization (Redis caching, WebSocket real-time)

### Testing Strategy:
- Test with TWC/BNB pair on BSC first
- Verify historical data loads correctly
- Test fallback logic (provider → DexScreener)
- Test caching (when Redis is implemented)
- Test real-time updates (polling, then WebSocket)

---

## Questions & Decisions Needed

### ✅ RESOLVED:
1. **Caching Strategy**: ✅ Use Redis (future), cache pair data for 12-24 hours per day
2. **Real-Time Updates**: ✅ Start with polling, upgrade to WebSocket later
3. **Data Provider**: ✅ Research and choose better provider than Bitquery

### 🔄 PENDING DECISIONS:
1. **Primary Data Provider**: Which provider to use? (CoinGecko, CryptoCompare, Binance API, The Graph, etc.)
   - **Action**: Research providers, compare costs, data quality, WebSocket support
   - **Timeline**: Before Phase 1 implementation

2. **WebSocket vs Polling**: Start with polling (simpler), or implement WebSocket from day 1?
   - **Recommendation**: Start with polling (5-10 second intervals), upgrade later
   - **Reason**: Simpler implementation, works immediately, can optimize later

3. **Mobile App**: How will mobile app consume the chart data?
   - **Answer**: Same API endpoints (`/api/v1/charts/*`)
   - **Mobile**: Can use TradingView mobile SDK or custom chart library

4. **Chart Customization**: What TradingView features should we enable/disable?
   - **Default**: Enable basic features, disable advanced (study templates, etc.)
   - **Can be configured per page/component**

5. **Error UI**: How should we display errors to users?
   - **Recommendation**: Inline error message in chart container
   - **Fallback**: Show "Chart unavailable" message with retry button

6. **Redis Implementation**: When to implement Redis caching?
   - **Recommendation**: Phase 4 (after basic functionality works)
   - **Reason**: Get basic chart working first, then optimize with caching

---

**End of Plan**