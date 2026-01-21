# Jupiter Implementation Review & Best Practices Analysis

## Executive Summary

After analyzing Jupiter's official documentation and comparing it with our current implementation, I've identified **critical gaps** that prevent us from:
1. Getting the best prices for users
2. Collecting the correct 0.25% Tiwi protocol fee
3. Leveraging Jupiter's most advanced features

**Key Finding**: We're using Jupiter's **legacy Metis/Lite API** instead of their recommended **Ultra Swap API**, which means we're missing out on significant advantages.

---

## Critical Issues Identified

### 1. ❌ **WRONG API ENDPOINT** (Critical)

**Current Implementation:**
- Using: `https://api.jup.ag/swap/v1/quote` (Metis/Lite API)
- This is Jupiter's **legacy API**

**Jupiter's Recommendation:**
- Use: `https://api.jup.ag/ultra/v1/order` (Ultra Swap API)
- This is their **latest, most advanced API**

**Impact:**
- Missing best executed price (not just quoted price)
- Missing Real-Time Slippage Estimator (RTSE)
- Missing MEV protection
- Missing sub-second transaction landing
- Missing automatic transaction execution

### 2. ❌ **INCORRECT FEE AMOUNT** (Critical)

**Current Implementation:**
```typescript
platformFeeBps: '15', // Tiwi protocol fee (0.15%)
```

**Required:**
- Tiwi protocol fee should be **0.25% = 25 bps**
- Currently collecting only **0.15% = 15 bps**
- **We're losing 40% of our fee revenue**

**Additional Issue:**
- Using `platformFeeBps` parameter (Metis API)
- Ultra API uses `referralFee` parameter instead

### 3. ❌ **NO FEE ACCOUNT SETUP** (Critical)

**Current Implementation:**
- No fee account (`feeAccount`) configured
- Fees cannot be collected without a proper fee account

**Required for Ultra API:**
- Need `referralAccount` (main account)
- Need `referralTokenAccount` (token-specific accounts) for each mint
- Fee account must be in the swap pair (input or output mint)

### 4. ❌ **MISSING TRANSACTION EXECUTION** (High Priority)

**Current Implementation:**
- Only returns quotes
- No transaction building or execution

**Jupiter Ultra API Benefits:**
- `/order` endpoint returns ready-to-sign transaction
- `/execute` endpoint handles transaction submission
- Automatic transaction polling and status updates
- Built-in retry logic

### 5. ⚠️ **NO API KEY CONFIGURATION** (Medium Priority)

**Current Implementation:**
- API key is optional
- Not using Ultra API features that require API key

**Required:**
- Ultra Swap API **requires** an API key
- Get from: https://portal.jup.ag
- Free to generate, but required for Ultra API

---

## What Jupiter Ultra Swap API Offers

### Key Advantages Over Metis/Lite API

1. **Best Executed Price**
   - Simulates and compares **executed prices** (not just quoted)
   - Dynamically selects route with least slippage
   - Guarantees best real user outcomes

2. **Real-Time Slippage Estimator (RTSE)**
   - Automatically determines optimal slippage
   - Balances trade success vs price protection
   - Uses heuristics, algorithms, and real-time monitoring

3. **MEV Protection**
   - Complete transaction privacy until execution
   - Reduces frontrunning exposure
   - Transactions invisible to public mempool scanners
   - 50-66% faster landing (0-1 block vs 1-3 blocks)

4. **RPC-less Architecture**
   - No need to maintain Solana RPC endpoints
   - Jupiter handles all blockchain interactions
   - Automatic transaction broadcasting and polling

5. **Sub-second Transaction Landing**
   - Lands in 0-1 block (~50-400ms)
   - 95% of swaps execute under 2 seconds
   - Proprietary transaction sending engine

6. **Lower Fees**
   - Ultra Swap: 5-10 bps (0.05-0.1%)
   - Metis/Lite: Higher fees
   - Better for users = more competitive

---

## Recommended Implementation Strategy

### Phase 1: Migrate to Ultra Swap API (Critical)

**1. Update Jupiter Adapter to Use Ultra API**

```typescript
// OLD (Current)
const url = `${JUPITER_LITE_API_BASE}/swap/v1/quote?${params}`;

// NEW (Recommended)
const url = `${JUPITER_ULTRA_API_BASE}/order?${params}`;
// JUPITER_ULTRA_API_BASE = 'https://api.jup.ag/ultra/v1'
```

**2. Fix Fee Configuration**

```typescript
// OLD (Current - Wrong)
platformFeeBps: '15', // 0.15% - WRONG!

// NEW (Recommended)
referralFee: '25', // 0.25% = 25 bps - CORRECT!
referralAccount: 'YOUR_REFERRAL_ACCOUNT_ADDRESS',
```

**3. Add Fee Account Setup**

```typescript
// Need to:
// 1. Create referral account (one-time setup)
// 2. Create referral token accounts for each mint we want to collect fees in
// 3. Pass referralAccount and feeAccount in order request
```

### Phase 2: Implement Transaction Execution (High Priority)

**Add `/execute` endpoint support:**

```typescript
// After getting order with transaction
const executeResponse = await fetch('https://api.jup.ag/ultra/v1/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': JUPITER_API_KEY,
  },
  body: JSON.stringify({
    signedTransaction: signedTransaction,
    requestId: orderResponse.requestId,
  }),
});
```

### Phase 3: Leverage Advanced Features (Medium Priority)

1. **Use RTSE (Real-Time Slippage Estimator)**
   - Don't hardcode slippage
   - Let Jupiter determine optimal slippage automatically

2. **Implement Fee Account Management**
   - Create token accounts for popular mints (SOL, USDC, USDT)
   - Handle fee account creation on-demand for other tokens

3. **Add Transaction Status Polling**
   - Use `/execute` endpoint's built-in polling
   - Provide real-time status updates to users

---

## Fee Collection Strategy

### Understanding Jupiter's Fee Structure

**Jupiter's Default Fees:**
- Buying Jupiter tokens (SOL/Stable → JUP/JLP/jupSOL): **0 bps
- Pegged Assets (LST-LST, Stable-Stable): **0 bps**
- SOL-Stable: **2 bps**
- LST-Stable: **5 bps**
- Everything else: **10 bps**
- New Tokens (<24h): **50 bps**

**Integrator Fees:**
- Ultra takes **20% of your integrator fees**
- If you charge 25 bps (0.25%), Jupiter takes 5 bps (0.05%)
- You receive: **20 bps (0.20%)** net
- **BUT**: You need to set `referralFee: '25'` to get 20 bps net

**To Collect 0.25% Net Fee:**
- Set `referralFee: '31'` (31 bps)
- Jupiter takes 20% = 6.2 bps
- You receive: 24.8 bps ≈ **0.25% net**

### Fee Account Requirements

**Important Constraints:**
- For ExactIn swaps: Fee account mint can be **input OR output** mint
- For ExactOut swaps: Fee account mint can **ONLY be input** mint
- Cannot take fees in a token not part of the swap pair
- Example: SOL → USDC swap cannot take fees in JUP

**Recommended Strategy:**
1. Create fee accounts for popular tokens: SOL, USDC, USDT
2. Prefer collecting fees in stablecoins (USDC/USDT) for stability
3. Fallback to SOL if stablecoin not available in swap pair

---

## Implementation Roadmap

### Immediate Actions (Week 1)

1. ✅ **Get Jupiter API Key**
   - Register at https://portal.jup.ag
   - Add to environment variables: `JUPITER_API_KEY`

2. ✅ **Create Referral Account**
   - Use Jupiter's referral dashboard: https://referral.jup.ag/dashboard
   - Or use SDK to create programmatically
   - Store referral account address securely

3. ✅ **Update API Endpoint**
   - Change from `/swap/v1/quote` to `/ultra/v1/order`
   - Update request parameters (remove `platformFeeBps`, add `referralFee`, `referralAccount`)

4. ✅ **Fix Fee Amount**
   - Change from 15 bps to 31 bps (to get 0.25% net after Jupiter's 20% cut)
   - Or use 25 bps if 0.20% net is acceptable

### Short-term (Week 2-3)

5. ✅ **Implement Fee Account Management**
   - Create token accounts for SOL, USDC, USDT
   - Add logic to determine which fee account to use based on swap pair
   - Handle fee account creation on-demand

6. ✅ **Add Transaction Execution**
   - Implement `/execute` endpoint
   - Add transaction signing flow
   - Add status polling and error handling

### Medium-term (Month 2)

7. ✅ **Leverage RTSE**
   - Remove hardcoded slippage
   - Let Jupiter determine optimal slippage
   - Trust their Real-Time Slippage Estimator

8. ✅ **Add Advanced Features**
   - Implement transaction status updates
   - Add retry logic for failed transactions
   - Add better error messages

---

## Code Changes Required

### 1. Update Jupiter Adapter

```typescript
// lib/backend/routers/adapters/jupiter-adapter.ts

// Change API base
const JUPITER_ULTRA_API_BASE = 'https://api.jup.ag/ultra/v1';

// Update getJupiterQuote method
private async getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number,
  taker?: string, // Required for Ultra API
  referralAccount?: string, // Required for fees
  referralFee?: string // 25 bps for 0.25% net
): Promise<JupiterOrderResponse | null> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    taker: taker || '', // Required for transaction
    referralAccount: referralAccount || '', // For fee collection
    referralFee: referralFee || '31', // 31 bps = 0.25% net after 20% cut
  });
  
  const url = `${JUPITER_ULTRA_API_BASE}/order?${params.toString()}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'x-api-key': JUPITER_API_KEY, // REQUIRED for Ultra API
    },
  });
  
  // Response includes transaction, requestId, etc.
  return await response.json();
}
```

### 2. Add Fee Account Service

```typescript
// lib/backend/services/jupiter-fee-service.ts

export class JupiterFeeService {
  // Determine which fee account to use based on swap pair
  async getFeeAccount(
    inputMint: string,
    outputMint: string,
    swapMode: 'ExactIn' | 'ExactOut'
  ): Promise<string> {
    // Priority: USDC > USDT > SOL
    const preferredMints = [
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      'So11111111111111111111111111111111111111112', // SOL
    ];
    
    if (swapMode === 'ExactIn') {
      // Can use input or output mint
      for (const mint of preferredMints) {
        if (inputMint === mint || outputMint === mint) {
          return this.getReferralTokenAccount(mint);
        }
      }
      // Fallback to output mint
      return this.getReferralTokenAccount(outputMint);
    } else {
      // ExactOut: Can only use input mint
      return this.getReferralTokenAccount(inputMint);
    }
  }
  
  private async getReferralTokenAccount(mint: string): Promise<string> {
    // Get or create referral token account for this mint
    // Implementation depends on how you store referral accounts
  }
}
```

### 3. Update Route Service Fee Calculation

```typescript
// lib/backend/services/route-service.ts

// Update TIWI_PROTOCOL_FEE_RATE
const TIWI_PROTOCOL_FEE_RATE = 0.0025; // 0.25% - CORRECT!

// Note: Jupiter takes 20% of integrator fees
// So if we set referralFee: 31 bps, we get 24.8 bps net ≈ 0.25%
```

---

## Risk Assessment

### High Risk
- ❌ **Revenue Loss**: Currently collecting 0.15% instead of 0.25% = **40% revenue loss**
- ❌ **Suboptimal Prices**: Using legacy API means users get worse prices
- ❌ **No Fee Collection**: Without fee accounts, fees cannot be collected

### Medium Risk
- ⚠️ **API Key Required**: Ultra API requires API key (but it's free)
- ⚠️ **Fee Account Setup**: Need to create and manage fee accounts
- ⚠️ **Migration Complexity**: Need to test thoroughly before switching

### Low Risk
- ✅ **Backward Compatibility**: Can keep Metis API as fallback
- ✅ **Gradual Migration**: Can migrate feature by feature

---

## Recommendations Summary

### Must Do (Critical)
1. ✅ **Migrate to Ultra Swap API** - Get best prices and features
2. ✅ **Fix fee amount to 0.25%** - Currently losing 40% revenue
3. ✅ **Set up fee accounts** - Cannot collect fees without them
4. ✅ **Get API key** - Required for Ultra API

### Should Do (High Priority)
5. ✅ **Implement transaction execution** - Better UX, automatic handling
6. ✅ **Use RTSE** - Better slippage management
7. ✅ **Add fee account management** - Handle multiple tokens

### Nice to Have (Medium Priority)
8. ✅ **Add transaction status polling** - Better user feedback
9. ✅ **Implement retry logic** - Better reliability
10. ✅ **Add advanced error handling** - Better debugging

---

## Conclusion

Our current implementation is **functional but suboptimal**. We're:
- Using legacy API instead of recommended Ultra API
- Collecting wrong fee amount (losing revenue)
- Missing advanced features that benefit users
- Not properly set up for fee collection

**Priority**: Migrate to Ultra Swap API as soon as possible to:
1. Get best prices for users
2. Collect correct fees (0.25%)
3. Leverage Jupiter's most advanced features
4. Provide better user experience

The migration is **straightforward** and the benefits are **significant**. I recommend starting with Phase 1 (API migration and fee fix) immediately.


