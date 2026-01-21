# Chart Data Sources Comparison

## Current Implementation: Bitquery

### Pros:
- ✅ Comprehensive blockchain data
- ✅ Real-time and historical data
- ✅ GraphQL API (flexible queries)
- ✅ Supports multiple chains
- ✅ Good documentation

### Cons:
- ❌ **Point-based pricing** (expensive for high volume)
- ❌ Rate limits on free tier (10 requests/minute)
- ❌ Limited free tier (10,000 points)
- ❌ Complex queries can be costly

### Pricing:
- Free: 10,000 points, 10 rows/request, 10 req/min
- Commercial: Custom pricing based on usage

---

## Alternative Data Sources

### 1. **DexScreener API** (RECOMMENDED)

**Best for: DEX pairs, free tier, good coverage**

#### Pros:
- ✅ **FREE** (no API key required for basic usage)
- ✅ Good coverage of DEX pairs
- ✅ Simple REST API
- ✅ Real-time data available
- ✅ No rate limits (reasonable usage)
- ✅ Already integrated as fallback

#### Cons:
- ❌ Limited historical data (typically 24-48 hours)
- ❌ May not have all pairs
- ❌ Less detailed than Bitquery

#### API Endpoint:
```
GET https://api.dexscreener.com/latest/dex/pairs/{chainId}/{pairAddress}
```

#### Recommendation:
**Use DexScreener as PRIMARY source for chart data**, with Bitquery as fallback for historical data beyond 48 hours.

---

### 2. **CoinGecko API**

**Best for: Token prices, market data**

#### Pros:
- ✅ FREE tier available
- ✅ Good coverage of tokens
- ✅ Historical price data
- ✅ Market cap, volume data
- ✅ Well-documented

#### Cons:
- ❌ Limited OHLCV data (mainly daily candles)
- ❌ Rate limits (10-50 calls/minute on free tier)
- ❌ May not have all DEX pairs
- ❌ Not real-time (15-30 min delay)

#### API Endpoint:
```
GET https://api.coingecko.com/api/v3/coins/{id}/ohlc?vs_currency=usd&days=1
```

#### Recommendation:
**Good for token price data, but limited for intraday OHLCV.**

---

### 3. **CoinMarketCap API**

**Best for: Market data, rankings**

#### Pros:
- ✅ Comprehensive market data
- ✅ Historical data available
- ✅ Good documentation

#### Cons:
- ❌ **PAID** (free tier very limited)
- ❌ Rate limits
- ❌ Not ideal for DEX pairs
- ❌ Focus on CEX data

#### Recommendation:
**Not recommended for DEX pair charting (too expensive, wrong focus).**

---

### 4. **The Graph Protocol**

**Best for: On-chain data, DEX data**

#### Pros:
- ✅ Decentralized indexing
- ✅ Good for DEX data
- ✅ GraphQL API
- ✅ Free tier available

#### Cons:
- ❌ Requires subgraph setup
- ❌ May not have all pairs
- ❌ Complex setup
- ❌ Rate limits

#### Recommendation:
**Good for long-term, but requires significant setup.**

---

### 5. **1inch API**

**Best for: DEX aggregation, price data**

#### Pros:
- ✅ FREE
- ✅ Good DEX coverage
- ✅ Real-time prices

#### Cons:
- ❌ Limited historical data
- ❌ Focus on prices, not full OHLCV
- ❌ Rate limits

#### Recommendation:
**Good for price data, but limited for full charting.**

---

## **RECOMMENDED STRATEGY**

### Primary: DexScreener API
- **Why**: Free, good coverage, simple API, real-time data
- **Use for**: Recent data (last 48 hours), primary chart display
- **Implementation**: Already have `DexScreenerChartProvider` - make it primary

### Fallback: Bitquery
- **Why**: Comprehensive historical data, multiple chains
- **Use for**: Historical data beyond 48 hours, when DexScreener fails
- **Implementation**: Keep as fallback, use sparingly to save points

### Data Filling
- **Why**: Ensure chart always displays even with sparse data
- **Implementation**: Use `fillChartData` utility to generate synthetic bars

---

## Implementation Priority

1. ✅ **Switch to DexScreener as PRIMARY** (free, good coverage)
2. ✅ **Keep Bitquery as FALLBACK** (for historical data)
3. ✅ **Add data filling** (ensure chart always displays)
4. ✅ **Add caching** (prevent repeated API calls)

---

## Cost Comparison

| Source | Free Tier | Paid Tier | Best For |
|--------|-----------|-----------|----------|
| **DexScreener** | ✅ Unlimited (reasonable) | N/A | **DEX pairs** |
| Bitquery | 10K points | Custom | Historical data |
| CoinGecko | 10-50 calls/min | $129+/mo | Token prices |
| CoinMarketCap | Very limited | $79+/mo | Market data |
| The Graph | Free tier | Custom | On-chain data |

**Winner: DexScreener for DEX pair charting** 🏆

