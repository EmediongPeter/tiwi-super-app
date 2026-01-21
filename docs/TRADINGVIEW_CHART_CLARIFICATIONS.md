# TradingView Chart Integration - Clarifications

## Your Questions & My Answers

### 1. Why Separate API Endpoints? (config, symbols, history)

**Your Question**: "I thought we could just get the historical data then build it from there all those chart and symbol config and even the real time."

**Answer**: You're absolutely right that we *could* simplify, but here's why TradingView requires separate methods:

**TradingView's Architecture:**
TradingView's charting library expects a datafeed object with these methods that are called **at different times**:

1. **`onReady()`** - Called **immediately** when chart initializes
   - Needs: Chart configuration (supported resolutions, features, etc.)
   - This is **static** - doesn't change per symbol
   - Can be cached forever

2. **`resolveSymbol()`** - Called when user selects/changes symbol
   - Needs: Symbol metadata (name, pricescale, supported resolutions, etc.)
   - This is **per-symbol** - different for each token pair
   - Can be cached for 1 hour

3. **`getBars()`** - Called when chart needs historical data
   - Needs: OHLC bars for specific time range and resolution
   - This is **per-symbol, per-resolution, per-time-range**
   - Should be cached for 12-24 hours (your requirement)

4. **`subscribeBars()`** - Called for real-time updates
   - Needs: WebSocket connection for live data
   - This is **continuous** - stays open while chart is active

**Why Not One Endpoint?**
We *could* use a single endpoint like `/api/v1/charts/data?method=config|symbol|history`, but:
- TradingView's library calls these methods **independently** at different times
- Better caching strategy (cache config separately from history)
- Easier debugging (each endpoint has clear purpose)
- Follows UDF standard (well-documented)

**However**, the frontend datafeed is still simple - it just calls different backend endpoints based on what TradingView requests.

---

### 2. Real-Time OHLC Data via WebSocket

**Your Question**: "Even the real time data ohlc, is a WebSocket call to the endpoint which I don't know if it has been handled."

**Answer**: You're correct - real-time OHLC requires WebSocket. Here's the plan:

**Challenge**: Next.js App Router doesn't support WebSocket directly.

**Solutions**:

**Option A: Polling (Simpler - Start Here)**
- Frontend polls backend every 5-10 seconds
- Backend fetches latest bar from provider
- **Pros**: Simple, works immediately, no WebSocket complexity
- **Cons**: Less efficient, slight delay

**Option B: WebSocket (Better - Future)**
- Backend establishes WebSocket to data provider (Bitquery/other)
- Backend forwards bars to frontend via WebSocket
- **Pros**: Real-time, efficient
- **Cons**: More complex, requires WebSocket server setup

**Option C: Server-Sent Events (SSE)**
- HTTP-based, simpler than WebSocket
- Backend pushes updates to frontend
- **Pros**: Simpler than WebSocket, works with Next.js
- **Cons**: One-way (server → client)

**RECOMMENDATION**: 
- **Phase 1-3**: Use **polling** (every 5-10 seconds)
- **Phase 4**: Upgrade to **WebSocket** or **SSE** for true real-time

**Implementation**:
```typescript
// Frontend datafeed
subscribeBars(symbolInfo, resolution, onTick, subscriberUID) {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/v1/charts/latest?symbol=${symbolInfo.ticker}`);
    const latestBar = await response.json();
    if (latestBar) onTick(latestBar);
  }, 5000); // Poll every 5 seconds
  
  this.subscribers[subscriberUID] = interval;
}
```

---

### 3. Caching Strategy (Redis - 12-24 Hours)

**Your Question**: "I was thinking of a scenario where if a user queries and get's the chart of pair for that day and let's say the chart is loaded and that's the first time the chart of that pair is loaded for that day what we can do is to get the historical data of that pair and maybe cache it or store it in a db and when another user comes to query for that exact pair we don't query from the provider we query from the cache which will contain the data we stored for that pair. and the data stored in the cache will only be stored for let's say 12-24 hours"

**Answer**: Perfect strategy! Here's how we'll implement it:

**Caching Strategy**:

1. **Cache Key Format**:
   ```
   chart:ohlc:{baseAddress}-{quoteAddress}-{chainId}:{date}:{resolution}
   ```
   Example: `chart:ohlc:0x123-0x456-56:2024-01-15:1h`

2. **Cache Flow**:
   ```
   User 1 requests TWC/BNB chart for today
   → Check Redis cache
   → Not found (first request)
   → Fetch from provider
   → Store in Redis with 24-hour TTL
   → Return data to user
   
   User 2 requests same TWC/BNB chart for today
   → Check Redis cache
   → Found! (cached from User 1)
   → Return cached data (no provider call)
   ```

3. **Cache TTL**: 24 hours (or until next day)
   - After 24 hours, cache expires
   - Next request fetches fresh data and caches again

4. **Implementation**:
   ```typescript
   // ChartDataService
   async getHistoricalBars(params: ChartDataParams): Promise<OHLCBar[]> {
     const cacheKey = `chart:ohlc:${params.baseAddress}-${params.quoteAddress}-${params.chainId}:${getDateString()}:${params.resolution}`;
     
     // Check cache first
     const cached = await redis.get(cacheKey);
     if (cached) {
       return JSON.parse(cached);
     }
     
     // Not cached - fetch from provider
     const bars = await this.fetchFromProvider(params);
     
     // Store in cache for 24 hours
     await redis.setex(cacheKey, 86400, JSON.stringify(bars)); // 86400 = 24 hours
     
     return bars;
   }
   ```

5. **Benefits**:
   - **Cost Savings**: Multiple users → 1 provider API call per day
   - **Performance**: Cached responses are much faster
   - **Reliability**: Reduces dependency on provider rate limits

**When to Implement**:
- **Phase 1-3**: Basic chart functionality (no caching)
- **Phase 4**: Add Redis caching for optimization

---

### 4. Better Data Provider Than Bitquery

**Your Question**: "Then as for a data provider for OHLC data, we need to find another provider better than Bitquery"

**Answer**: Agreed. Let's research alternatives:

**Provider Options**:

1. **CoinGecko**
   - ✅ Free tier available
   - ✅ Good API documentation
   - ✅ Historical OHLC data
   - ❌ Limited real-time updates
   - ❌ May not have all DEX pairs

2. **CryptoCompare**
   - ✅ Comprehensive historical data
   - ✅ Good coverage of exchanges
   - ❌ Paid plans for high volume
   - ❌ May not cover all DEX pairs

3. **Binance API** (For BSC pairs)
   - ✅ Free
   - ✅ Reliable, fast
   - ✅ WebSocket support
   - ❌ Only for Binance-listed pairs
   - ❌ Limited to BSC chain

4. **The Graph**
   - ✅ On-chain DEX data
   - ✅ Good for DEX pairs
   - ✅ Free tier available
   - ❌ Requires GraphQL knowledge
   - ❌ May have rate limits

5. **CoinAPI**
   - ✅ Unified data from multiple exchanges
   - ✅ Good coverage
   - ❌ Paid service
   - ❌ May be expensive

6. **Finage Crypto API**
   - ✅ Real-time + historical
   - ✅ WebSocket support
   - ❌ Paid service

**Recommendation**: 
- **Research each provider** for:
  - Cost (free tier availability)
  - Data quality and coverage
  - Historical data depth
  - Real-time WebSocket support
  - API rate limits
  - Ease of integration

- **Decision**: Choose before Phase 1 implementation

**Fallback Strategy**:
- Primary: [Chosen Provider]
- Fallback: DexScreener (already integrated)

---

## Summary of Changes to Plan

1. ✅ **Separate Endpoints Explained**: TradingView requires them, but we can simplify frontend
2. ✅ **WebSocket Handling**: Start with polling, upgrade to WebSocket later
3. ✅ **Caching Strategy**: Redis, 12-24 hours per pair per day (Phase 4)
4. ✅ **Better Provider**: Research and choose before implementation

**Next Steps**:
1. Research and choose data provider
2. Implement basic chart functionality (Phase 1-3)
3. Add Redis caching (Phase 4)
4. Upgrade to WebSocket real-time (Phase 4)

---

**Questions?** Let me know if you need clarification on any point!

