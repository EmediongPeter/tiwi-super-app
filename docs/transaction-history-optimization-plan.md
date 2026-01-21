# Transaction History Optimization - Implementation Plan

## Overview
Migrate transaction history fetching to Moralis `/wallets/{address}/history` endpoint for better categorization, more complete data, and improved performance. This will replace the current implementation that uses separate endpoints for different transaction types.

## Current State Analysis

### Current Implementation
- **EVM Transactions:** Uses `/{address}` endpoint (basic transactions only)
- **Solana Transactions:** Uses `/account/mainnet/{address}/transactions`
- **Limitations:**
  - Limited transaction categorization
  - No swap transaction details
  - No DeFi activity detection
  - Basic token transfer parsing
  - Multiple API calls per chain

### Target Implementation
- **Single Endpoint:** `/wallets/{address}/history`
- **Benefits:**
  - ✅ All transaction types in one call
  - ✅ Automatic categorization (Send, Receive, Swap, DeFi, etc.)
  - ✅ Enriched data (DEX names, protocol info, token details)
  - ✅ Better performance (fewer API calls)
  - ✅ More accurate transaction types

## Moralis `/wallets/{address}/history` Endpoint

### Endpoint Details
**URL:** `GET /wallets/{address}/history`
**Documentation:** https://docs.moralis.com/web3-data-api/evm/wallet-history

### Query Parameters
- `chains`: Array of chain names (e.g., `chains[0]=eth&chains[1]=polygon`)
- `cursor`: Pagination cursor
- `limit`: Number of results (default: 100, max: 100)

### Response Structure
```typescript
{
  cursor: string | null;
  page: number;
  page_size: number;
  result: Array<{
    chain: string;                    // "eth", "polygon", etc.
    block_number: string;
    block_timestamp: string;          // ISO 8601
    hash: string;                     // Transaction hash
    transaction_category: string;    // "token", "native", "erc20", "erc721", "erc1155", "internal"
    log_index: number;
    from_address: string;
    to_address: string;
    value: string;                    // In wei
    gas: string;
    gas_price: string;
    receipt_status: string;          // "1" = success, "0" = failed
    
    // Token transfer data (if token transaction)
    token_address?: string;
    token_symbol?: string;
    token_name?: string;
    token_decimals?: string;
    token_logo?: string;
    value_formatted?: string;         // Human-readable amount
    
    // ERC20 transfer data
    possible_spam?: boolean;
    verified_contract?: boolean;
    
    // Additional data
    method_label?: string;            // Function name
    method_hash?: string;
  }>;
}
```

### Transaction Categories
The API automatically categorizes transactions:
- **"native"** - Native token transfers (ETH, BNB, etc.)
- **"token"** / **"erc20"** - ERC20 token transfers
- **"erc721"** - NFT transfers
- **"erc1155"** - Multi-token transfers
- **"internal"** - Internal transactions

### Enhanced Categorization (Our Logic)
We'll enhance the categorization to identify:
1. **Swap Transactions:**
   - Detect DEX interactions (Uniswap, PancakeSwap, etc.)
   - Extract swap pairs and amounts
   - Identify DEX protocol from `to_address` or `method_label`

2. **DeFi Activities:**
   - Staking transactions
   - Unstaking transactions
   - LP position changes
   - Lending/borrowing

3. **Token Transfers:**
   - Sent (outgoing)
   - Received (incoming)
   - Self-transfers

4. **Contract Interactions:**
   - Approvals
   - Contract calls
   - Protocol interactions

## Implementation Plan

### Phase 1: Add Wallet History Endpoint

#### Step 1: Add `getWalletHistory` to Moralis REST Client
**File:** `lib/backend/providers/moralis-rest-client.ts`

**Function:**
```typescript
/**
 * Get wallet history (all transaction types)
 * Endpoint: GET /wallets/{address}/history
 */
export async function getWalletHistory(
  address: string,
  chainIds: number[],
  options?: {
    limit?: number;
    cursor?: string;
  }
): Promise<any>
```

**Features:**
- Accepts array of chain IDs
- Converts to chain names for API
- Handles pagination with cursor
- Caches responses (2 minutes TTL)

### Phase 2: Enhanced Transaction Parsing

#### Step 2: Create Transaction Parser Service
**File:** `lib/backend/services/transaction-parser.ts` (NEW)

**Purpose:** Parse Moralis history response and categorize transactions

**Functions:**
1. `parseWalletHistory()` - Main parser
2. `categorizeTransaction()` - Enhanced categorization
3. `detectSwapTransaction()` - Identify swaps
4. `detectDeFiActivity()` - Identify DeFi
5. `extractTokenTransfer()` - Parse token transfers
6. `getDEXName()` - Identify DEX from address/method

**Transaction Type Detection:**
- **Swap:** DEX router addresses, swap method signatures
- **Stake:** Staking contract addresses, stake methods
- **Unstake:** Unstaking methods
- **Approve:** ERC20 approve method
- **Sent:** Outgoing transfer (from = wallet)
- **Received:** Incoming transfer (to = wallet)
- **Transfer:** Generic transfer

### Phase 3: Update Transaction History Service

#### Step 3: Migrate to Wallet History Endpoint
**File:** `lib/backend/services/transaction-history-service.ts`

**Changes:**
1. Replace `fetchTransactionsFromMoralis()` with `getWalletHistory()`
2. Use `TransactionParser` for parsing
3. Maintain backward compatibility with existing API
4. Support filtering by transaction type
5. Support filtering by chain

### Phase 4: Enhanced Transaction Types

#### Step 4: Extend Transaction Types
**File:** `lib/backend/types/wallet.ts`

**Add New Types:**
```typescript
export type TransactionType = 
  | 'Swap' 
  | 'Sent' 
  | 'Received' 
  | 'Stake' 
  | 'Unstake' 
  | 'Approve' 
  | 'Transfer'
  | 'DeFi'           // NEW - Generic DeFi activity
  | 'NFTTransfer'   // NEW - NFT transfers
  | 'ContractCall'; // NEW - Contract interactions
```

**Enhance Transaction Interface:**
```typescript
export interface Transaction {
  // ... existing fields
  metadata?: {
    protocol?: string;        // DEX/Protocol name
    swapRoute?: string;        // Swap route
    dexName?: string;          // DEX name (Uniswap, PancakeSwap, etc.)
    pair?: string;             // Trading pair (e.g., "ETH/USDC")
    fromToken?: string;         // Token symbol sent
    toToken?: string;           // Token symbol received
    fromAmount?: string;        // Amount sent
    toAmount?: string;          // Amount received
    [key: string]: any;
  };
}
```

### Phase 5: Frontend Enhancements

#### Step 5: Update Transaction UI Components
**Files:**
- `components/wallet/transaction-history.tsx`
- `components/wallet/transaction-item.tsx` (if exists)

**Enhancements:**
1. Display DEX name for swaps
2. Show trading pairs
3. Display protocol names for DeFi
4. Better transaction type icons
5. Enhanced transaction cards

## Implementation Steps

### Step 1: Add Wallet History Endpoint
1. Add `getWalletHistory()` to `moralis-rest-client.ts`
2. Handle chain array parameter
3. Implement pagination support
4. Add caching

### Step 2: Create Transaction Parser
1. Create `transaction-parser.ts`
2. Implement `parseWalletHistory()`
3. Implement categorization logic
4. Add DEX detection
5. Add DeFi detection

### Step 3: Update Transaction Service
1. Replace `fetchTransactionsFromMoralis()` implementation
2. Integrate `TransactionParser`
3. Maintain existing API contract
4. Add enhanced filtering

### Step 4: Update Types
1. Extend `TransactionType` enum
2. Enhance `Transaction` interface
3. Update type guards

### Step 5: Update Frontend
1. Enhance transaction display
2. Add protocol/DEX badges
3. Improve transaction cards
4. Add filtering UI (if needed)

## DEX Detection Strategy

### Known DEX Router Addresses
```typescript
const DEX_ROUTERS: Record<number, Record<string, string>> = {
  1: { // Ethereum
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D': 'Uniswap V2',
    '0xE592427A0AEce92De3Edee1F18E0157C05861564': 'Uniswap V3',
    '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F': 'SushiSwap',
    // ... more
  },
  56: { // BSC
    '0x10ED43C718714eb63d5aA57B78B54704E256024E': 'PancakeSwap V2',
    '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4': 'PancakeSwap V3',
    // ... more
  },
  // ... other chains
};
```

### Method Signature Detection
```typescript
const SWAP_METHOD_SIGNATURES = [
  '0x7ff36ab5', // swapExactETHForTokens
  '0x18cbafe5', // swapExactTokensForETH
  '0x38ed1739', // swapExactTokensForTokens
  // ... more
];
```

## DeFi Detection Strategy

### Staking Contracts
- Identify known staking contract addresses
- Detect stake/unstake method signatures
- Extract staking amounts

### LP Positions
- Detect LP token transfers
- Identify add/remove liquidity transactions
- Calculate LP position values

## Benefits

### Performance
- **Before:** Multiple API calls per chain (native + ERC20 + internal)
- **After:** Single API call per wallet (all chains, all types)
- **Reduction:** ~70% fewer API calls

### Data Quality
- **Before:** Basic transaction data
- **After:** Enriched data with categorization, DEX names, protocol info

### User Experience
- **Before:** Generic transaction types
- **After:** Specific types (Swap, Stake, DeFi, etc.) with protocol names

## Testing Checklist

- [ ] Fetch wallet history for EVM chains
- [ ] Parse and categorize transactions correctly
- [ ] Detect swap transactions
- [ ] Detect DeFi activities
- [ ] Filter by transaction type
- [ ] Filter by chain
- [ ] Pagination works correctly
- [ ] Caching works correctly
- [ ] Error handling works
- [ ] Backward compatibility maintained

## Estimated Time

- **Backend:** 4-6 hours
  - Endpoint: 1 hour
  - Parser: 2-3 hours
  - Service update: 1 hour
  - Testing: 1 hour

- **Frontend:** 2-3 hours
  - UI enhancements: 2-3 hours

**Total:** 6-9 hours

---

## Approval Required

Please review this plan and approve before implementation. Key decisions:

1. **DEX Detection:** Use known addresses + method signatures (recommended)
2. **DeFi Detection:** Start with basic detection, enhance later
3. **Backward Compatibility:** Maintain existing API contract
4. **Pagination:** Implement cursor-based pagination

Ready to proceed upon approval! 🚀


