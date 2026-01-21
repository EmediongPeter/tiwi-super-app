# Token Provider Testing Guide

**Date:** 2024  
**Phase:** Token Provider Integration - Testing  
**Status:** Comprehensive Test Cases

---

## Overview

This document outlines all edge cases and test scenarios for the token provider aggregation system. Use this guide to verify that the system works correctly across all scenarios.

---

## API Endpoint

**Base URL:** `/api/v1/tokens`

**Methods:**
- `GET` - Query parameters
- `POST` - JSON body

---

## Test Cases

### 1. Basic Token Fetching (No Query)

#### 1.1 Get All Tokens (No Filters)
```bash
# GET Request
GET /api/v1/tokens

# Expected:
# - Returns up to 30 tokens from all supported chains
# - Uses primary providers (LiFi for EVM, etc.)
# - No DexScreener fallback (no query)
```

#### 1.2 Get Tokens for Single Chain
```bash
# GET Request
GET /api/v1/tokens?chains=1

# Expected:
# - Returns tokens from Ethereum (chain ID 1)
# - Uses LiFi + Relay (both primary for EVM)
# - Max 30 tokens
```

#### 1.3 Get Tokens for Multiple Chains
```bash
# GET Request
GET /api/v1/tokens?chains=1,56,137

# Expected:
# - Returns tokens from Ethereum, BNB Chain, Polygon
# - Uses primary providers for each chain
# - Deduplicates tokens (same address on multiple chains = separate tokens)
# - Max 30 tokens total
```

#### 1.4 Invalid Chain ID
```bash
# GET Request
GET /api/v1/tokens?chains=99999

# Expected:
# - Returns 400 error
# - Error message: "Invalid chains parameter..."
```

---

### 2. Token Search (With Query)

#### 2.1 Exact Symbol Match
```bash
# GET Request
GET /api/v1/tokens?query=USDC&chains=1

# Expected:
# - Returns USDC token from Ethereum
# - Exact match should be ranked first
# - Similarity score = 1.0
# - No DexScreener fallback (exact match found)
```

#### 2.2 Partial Symbol Match
```bash
# GET Request
GET /api/v1/tokens?query=USDC&chains=1,56

# Expected:
# - Returns USDC tokens from Ethereum and BNB Chain
# - Similarity score >= 0.5 (50% threshold)
# - Sorted by exact match > similarity > liquidity
```

#### 2.3 Name Search
```bash
# GET Request
GET /api/v1/tokens?query=USD%20Coin

# Expected:
# - Returns tokens with "USD Coin" in name
# - Similarity scoring applied
# - Results from all chains (if no chain filter)
```

#### 2.4 Address Search
```bash
# GET Request
GET /api/v1/tokens?query=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# Expected:
# - Returns token with matching address
# - Address match gets 0.8 similarity score
# - Exact address match = 1.0
```

#### 2.5 Low Results - DexScreener Fallback
```bash
# GET Request
GET /api/v1/tokens?query=TWC&chains=1

# Expected:
# - Primary provider (LiFi) returns < 3 results OR no exact match
# - DexScreener fallback triggered
# - Results include tokens from both providers
# - Deduplicated and sorted
```

#### 2.6 No Results from Primary - DexScreener Fallback
```bash
# GET Request
GET /api/v1/tokens?query=OBSCURETOKEN123&chains=1

# Expected:
# - Primary provider returns 0 results
# - DexScreener fallback triggered
# - Returns DexScreener results (if found)
# - Or empty array if not found anywhere
```

#### 2.7 Query Too Short (No DexScreener)
```bash
# GET Request
GET /api/v1/tokens?query=AB&chains=1

# Expected:
# - Query length <= 3 characters
# - DexScreener fallback NOT triggered (unless < 3 results)
# - Only primary provider results
```

---

### 3. Chain-Specific Provider Selection

#### 3.1 EVM Chain (LiFi + Relay)
```bash
# GET Request
GET /api/v1/tokens?chains=1

# Expected:
# - Both LiFi and Relay are primary providers
# - Both fetch in parallel
# - Results merged and deduplicated
# - Provider attribution: ['lifi', 'relay'] or ['lifi'] or ['relay']
```

#### 3.2 Solana Chain (Jupiter - Future)
```bash
# GET Request
GET /api/v1/tokens?chains=7565164

# Expected:
# - Jupiter is primary provider (when implemented)
# - LiFi, Squid, Relay for routing compatibility
# - Results from Jupiter
```

#### 3.3 Cosmos Chain (Squid - Future)
```bash
# GET Request
GET /api/v1/tokens?chains=<cosmos-chain-id>

# Expected:
# - Squid is primary provider (when implemented)
# - Results from Squid
```

---

### 4. Similarity Scoring & Ranking

#### 4.1 Exact Match Priority
```bash
# GET Request
GET /api/v1/tokens?query=USDC

# Expected:
# - Exact symbol match (USDC) ranked first
# - Partial matches (USDC.e, USDC.m) ranked lower
# - Similarity scores: exact = 1.0, partial < 1.0
```

#### 4.2 Similarity Threshold (50%)
```bash
# GET Request
GET /api/v1/tokens?query=XYZ123

# Expected:
# - Only tokens with >= 50% similarity shown
# - Exact matches always shown (even if < 50%)
# - Low similarity tokens filtered out
```

#### 4.3 Liquidity-Based Sorting
```bash
# GET Request
GET /api/v1/tokens?query=USDT

# Expected:
# - Exact matches first
# - Then sorted by similarity score
# - If scores equal, sort by liquidity (highest first)
```

---

### 5. Limit & Pagination

#### 5.1 Default Limit (30)
```bash
# GET Request
GET /api/v1/tokens?query=USDT

# Expected:
# - Returns max 30 tokens
# - Sorted by relevance
```

#### 5.2 Custom Limit
```bash
# GET Request
GET /api/v1/tokens?query=USDT&limit=10

# Expected:
# - Returns max 10 tokens
# - Still sorted by relevance
```

#### 5.3 Limit Too High
```bash
# GET Request
GET /api/v1/tokens?query=USDT&limit=1000

# Expected:
# - Still returns max 30 tokens (hard limit)
# - Or limit is respected if system allows
```

---

### 6. Error Handling

#### 6.1 Provider Failure (Graceful Degradation)
```bash
# Scenario: LiFi API is down
GET /api/v1/tokens?chains=1

# Expected:
# - Relay still returns results (if available)
# - Or falls back to DexScreener
# - Or returns empty array (not error)
# - Error logged but not returned to user
```

#### 6.2 DexScreener Failure
```bash
# Scenario: DexScreener API is down
GET /api/v1/tokens?query=TWC&chains=1

# Expected:
# - Primary provider results still returned
# - DexScreener failure is silent
# - No error to user
```

#### 6.3 Invalid Request Format
```bash
# GET Request
GET /api/v1/tokens?chains=invalid

# Expected:
# - Returns 400 error
# - Error message explains issue
```

---

### 7. POST Request Format

#### 7.1 POST with Chain IDs
```bash
# POST Request
POST /api/v1/tokens
Content-Type: application/json

{
  "chainIds": [1, 56],
  "query": "USDC",
  "limit": 20
}

# Expected:
# - Same behavior as GET
# - Returns tokens matching query from specified chains
```

#### 7.2 POST without Query
```bash
# POST Request
POST /api/v1/tokens
Content-Type: application/json

{
  "chainIds": [1, 56],
  "limit": 20
}

# Expected:
# - Returns popular tokens from specified chains
# - No search, just fetch
```

---

### 8. Provider Attribution

#### 8.1 Single Provider Token
```bash
# GET Request
GET /api/v1/tokens?query=USDC&chains=1

# Expected Response:
{
  "tokens": [
    {
      "chainId": 1,
      "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "symbol": "USDC",
      "providers": ["lifi"]  // or ["relay"] or ["lifi", "relay"]
    }
  ]
}
```

#### 8.2 Multi-Provider Token (Deduplicated)
```bash
# GET Request
GET /api/v1/tokens?query=USDC&chains=1

# Expected:
# - If both LiFi and Relay return same token
# - providers: ["lifi", "relay"]
# - Data merged (prefer non-empty fields)
```

---

### 9. Background Enrichment (Non-Blocking)

#### 9.1 Enrichment Happens in Background
```bash
# GET Request
GET /api/v1/tokens?query=USDC&chains=1

# Expected:
# - Response returns immediately (fast)
# - Enrichment happens in background
# - Router formats and liquidity added later
# - Cache updated when ready
```

#### 9.2 Enrichment Not Ready for Routing
```bash
# Scenario: User selects token immediately after search
# Token selected for swap before enrichment completes

# Expected:
# - Router format lookup happens on-demand
# - Fetches format if not in cache
# - Slightly slower but still works
```

---

### 10. Edge Cases

#### 10.1 Empty Query String
```bash
# GET Request
GET /api/v1/tokens?query=

# Expected:
# - Treated as no query
# - Returns popular tokens (no search)
```

#### 10.2 Whitespace-Only Query
```bash
# GET Request
GET /api/v1/tokens?query=%20%20%20

# Expected:
# - Query trimmed
# - Treated as no query
# - Returns popular tokens
```

#### 10.3 Very Long Query
```bash
# GET Request
GET /api/v1/tokens?query=ThisIsAVeryLongTokenNameThatProbablyDoesNotExist

# Expected:
# - Still searches
# - Returns empty if no matches
# - Or low similarity results if threshold met
```

#### 10.4 Special Characters in Query
```bash
# GET Request
GET /api/v1/tokens?query=USDC%2FETH

# Expected:
# - URL decoded properly
# - Searches for "USDC/ETH"
# - Handles special characters gracefully
```

#### 10.5 Multiple Chains with Different Types
```bash
# GET Request
GET /api/v1/tokens?chains=1,7565164

# Expected:
# - EVM (1) uses LiFi + Relay
# - Solana (7565164) uses Jupiter (when implemented)
# - Results from both chain types
# - Properly normalized
```

#### 10.6 Same Token on Multiple Chains
```bash
# GET Request
GET /api/v1/tokens?query=USDC&chains=1,56,137

# Expected:
# - Returns USDC from each chain separately
# - Each has different chainId
# - Not deduplicated (different chains = different tokens)
```

---

## Test Execution Checklist

### ✅ Basic Functionality
- [ ] Get all tokens (no filters)
- [ ] Get tokens for single chain
- [ ] Get tokens for multiple chains
- [ ] Search with exact match
- [ ] Search with partial match
- [ ] Search with address

### ✅ Provider Selection
- [ ] EVM chains use LiFi + Relay
- [ ] DexScreener fallback triggers correctly
- [ ] Provider attribution is correct
- [ ] Multi-provider tokens are merged

### ✅ Similarity & Ranking
- [ ] Exact matches ranked first
- [ ] Similarity threshold (50%) works
- [ ] Liquidity-based sorting works
- [ ] Results limited to 30

### ✅ Error Handling
- [ ] Invalid chain ID returns 400
- [ ] Provider failures are graceful
- [ ] Empty results handled correctly
- [ ] Invalid request format handled

### ✅ Edge Cases
- [ ] Empty query handled
- [ ] Whitespace-only query handled
- [ ] Special characters handled
- [ ] Very long query handled
- [ ] Multiple chain types handled

### ✅ Performance
- [ ] Response time < 500ms (primary providers)
- [ ] Background enrichment doesn't block
- [ ] Parallel provider fetching works
- [ ] Caching works correctly

---

## Manual Testing Commands

### Using cURL

```bash
# Get all tokens
curl "http://localhost:3000/api/v1/tokens"

# Search for USDC
curl "http://localhost:3000/api/v1/tokens?query=USDC"

# Search on specific chain
curl "http://localhost:3000/api/v1/tokens?query=USDC&chains=1"

# Multiple chains
curl "http://localhost:3000/api/v1/tokens?query=USDC&chains=1,56"

# POST request
curl -X POST "http://localhost:3000/api/v1/tokens" \
  -H "Content-Type: application/json" \
  -d '{"chainIds": [1, 56], "query": "USDC", "limit": 20}'
```

### Using Browser

```
# Get all tokens
http://localhost:3000/api/v1/tokens

# Search
http://localhost:3000/api/v1/tokens?query=USDC&chains=1

# Multiple chains
http://localhost:3000/api/v1/tokens?query=USDC&chains=1,56,137
```

---

## Expected Response Format

```json
{
  "tokens": [
    {
      "chainId": 1,
      "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "logoURI": "https://...",
      "priceUSD": "1.00",
      "providers": ["lifi", "relay"],
      "verified": true,
      "vmType": "evm",
      "chainBadge": "ethereum",
      "chainName": "Ethereum",
      "liquidity": 1234567.89,
      "volume24h": 987654.32,
      "routerFormats": {
        "lifi": { "chainId": 1, "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
        "relay": { "chainId": "1", "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" }
      },
      "enrichedBy": ["lifi", "relay", "dexscreener"]
    }
  ],
  "total": 1,
  "chainIds": [1],
  "query": "USDC",
  "limit": 30
}
```

---

## Performance Benchmarks

### Expected Response Times

- **Primary providers only:** 200-500ms
- **With DexScreener fallback:** 500-1000ms
- **Background enrichment:** Non-blocking (doesn't affect response time)

### Success Criteria

- ✅ All basic functionality tests pass
- ✅ Response time < 500ms for primary providers
- ✅ No errors in console
- ✅ Provider attribution correct
- ✅ Similarity scoring works
- ✅ DexScreener fallback triggers correctly

---

## Notes

- Background enrichment happens asynchronously
- Router formats may not be available immediately
- Cache is updated when enrichment completes
- Provider failures are silent (graceful degradation)
- Max 30 tokens returned (hard limit)


