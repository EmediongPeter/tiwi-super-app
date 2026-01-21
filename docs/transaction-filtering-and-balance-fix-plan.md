# Transaction Filtering & Balance Fix Plan

## Overview
This document outlines the plan to:
1. Filter transaction history to show only Tiwi Protocol transactions
2. Ensure wallet balances only return tokens with non-zero balances

---

## Issue 1: Transaction History - Tiwi Protocol Only

### Current State
- Transaction history service fetches ALL transactions from Moralis
- No filtering for Tiwi Protocol-specific transactions
- Transactions include swaps, transfers, DeFi activities from all protocols

### Requirements
- Show only transactions related to Tiwi Protocol
- Filter by:
  - Contract addresses (Tiwi's smart contracts)
  - Protocol metadata (if transactions are tagged with "Tiwi")
  - DEX name metadata (if Tiwi is identified as a DEX)

### Solution Approach

#### Option A: Filter by Contract Addresses (Recommended)
- Create a configuration file with Tiwi Protocol contract addresses
- Filter transactions where `to_address` or `from_address` matches Tiwi contracts
- Also check ERC20 transfer addresses in transaction metadata

#### Option B: Filter by Metadata
- Filter transactions where `metadata.protocol === "Tiwi"` or `metadata.dexName === "Tiwi"`
- This requires transactions to be tagged with Tiwi metadata

#### Option C: Hybrid Approach (Best)
- Combine both approaches:
  1. Check if transaction interacts with Tiwi contract addresses
  2. Check if transaction metadata indicates Tiwi protocol
  3. Allow configuration to enable/disable filtering

### Implementation Steps

1. **Create Tiwi Protocol Configuration**
   - File: `lib/backend/config/tiwi-protocol-config.ts`
   - Store contract addresses per chain
   - Store protocol identifiers (names, DEX names)

2. **Add Filter Function**
   - File: `lib/backend/services/transaction-history-service.ts`
   - Add `filterTiwiProtocolTransactions()` method
   - Filter transactions based on config

3. **Update Transaction Parser**
   - Add helper to check if transaction is Tiwi-related
   - Check contract addresses and metadata

4. **Make it Configurable**
   - Add environment variable or config flag
   - Allow toggling between "all transactions" and "Tiwi only"

### Configuration Structure

```typescript
// lib/backend/config/tiwi-protocol-config.ts
export const TIWI_PROTOCOL_CONFIG = {
  // Contract addresses per chain
  contracts: {
    1: [ // Ethereum
      '0x...', // Tiwi Router
      '0x...', // Tiwi Staking
    ],
    56: [ // BSC
      '0x...',
    ],
    // ... other chains
  },
  // Protocol identifiers in metadata
  protocolNames: ['Tiwi', 'TIWI', 'tiwi-protocol'],
  dexNames: ['Tiwi DEX', 'TIWI DEX'],
  // Enable/disable filtering
  enabled: true,
};
```

---

## Issue 2: Wallet Balance - Only Non-Zero Balances

### Current State
- `getEVMWalletTokens()` already filters zero balances (line 303-305)
- However, user reports seeing tokens with zero balances
- Need to verify filtering is working correctly

### Root Cause Analysis

1. **Check `getEVMWalletTokens()`**
   - Already has: `if (balanceBigInt === BigInt(0)) { continue; }`
   - Should be working, but let's verify

2. **Check `getEVMTokenBalances()` (legacy)**
   - Also has zero balance filter (line 225-227)
   - But this is deprecated

3. **Check `getSolanaTokenBalances()`**
   - Need to verify Solana tokens are also filtered

4. **Check Balance Formatting**
   - Sometimes "0.00" is displayed but actual balance isn't zero
   - Need to check balance calculation

### Solution

1. **Double-Check Zero Balance Filter**
   - Ensure filter is applied correctly
   - Check for edge cases (very small balances that round to 0)

2. **Add Additional Safety Check**
   - Filter after USD value calculation
   - Remove tokens with zero USD value (if balance is truly zero)

3. **Verify All Code Paths**
   - Check all functions that return tokens
   - Ensure consistent filtering

4. **Add Logging**
   - Log when tokens are filtered out
   - Help debug if issues persist

### Implementation Steps

1. **Review `getEVMWalletTokens()`**
   - Verify zero balance filter is correct
   - Add additional check for formatted balance

2. **Review `getSolanaTokenBalances()`**
   - Add zero balance filter if missing

3. **Add Post-Processing Filter**
   - In `WalletBalanceService.getWalletBalances()`
   - Filter out tokens with zero balance after enrichment

4. **Add Unit Tests**
   - Test zero balance filtering
   - Test edge cases

---

## Implementation Priority

### Phase 1: Balance Fix (High Priority)
1. Verify and fix zero balance filtering
2. Test with real wallet data
3. Deploy fix

### Phase 2: Transaction Filtering (Medium Priority)
1. Create Tiwi protocol configuration
2. Implement filtering logic
3. Make it configurable
4. Test with real transaction data
5. Deploy feature

---

## Questions for User

1. **Tiwi Protocol Contract Addresses**
   - What are the Tiwi Protocol contract addresses?
   - On which chains are they deployed?
   - Are there different contracts for swaps, staking, etc.?

2. **Transaction Filtering Scope**
   - Should we filter ALL transactions or only specific types (swaps, stakes)?
   - Should we include transactions that go through Tiwi's interface but use other DEXes?

3. **Configuration**
   - Should filtering be enabled by default?
   - Should users be able to toggle between "all transactions" and "Tiwi only"?

---

## Files to Modify

1. `lib/backend/config/tiwi-protocol-config.ts` (NEW)
2. `lib/backend/services/transaction-history-service.ts`
3. `lib/backend/services/transaction-parser.ts`
4. `lib/backend/providers/moralis.ts` (balance filtering)
5. `lib/backend/services/wallet-balance-service.ts` (balance filtering)

---

## Testing Checklist

### Balance Filtering
- [ ] Test with wallet containing zero balance tokens
- [ ] Test with wallet containing only non-zero balances
- [ ] Test with mixed balances
- [ ] Verify USD values are correct after filtering

### Transaction Filtering
- [ ] Test with transactions from Tiwi contracts
- [ ] Test with transactions from other protocols
- [ ] Test with mixed transaction history
- [ ] Verify filtering works across all chains
- [ ] Test configuration toggle


