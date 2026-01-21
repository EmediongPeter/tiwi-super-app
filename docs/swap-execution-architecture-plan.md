# Swap Execution Architecture Plan

## Executive Summary

This document outlines a comprehensive, industry-standard approach to implementing swap transaction execution across multiple chains and routers. The architecture separates concerns between client-side wallet interactions and backend transaction orchestration, ensuring security, reliability, and maintainability.

---

## Core Principles

### 1. **Security First**
- **Never store private keys** - All signing happens client-side
- **User approval required** - Every transaction requires explicit wallet confirmation
- **Quote validation** - Verify quotes haven't expired before execution
- **Slippage protection** - Enforce slippage limits to protect users

### 2. **Separation of Concerns**
- **Client-side**: Wallet connection, transaction signing, user interaction
- **Backend**: Transaction building, router API calls, status tracking, data storage
- **Clear boundaries**: Backend prepares transactions, client signs and submits

### 3. **Reliability**
- **Transaction status tracking** - Monitor from submission to confirmation
- **Retry logic** - Handle transient failures gracefully
- **Error recovery** - Clear error messages and recovery paths
- **Idempotency** - Prevent duplicate transactions

### 4. **Industry Standards**
- **EIP-1193** for EVM wallets (MetaMask, WalletConnect, etc.)
- **Solana Wallet Standard** for Solana wallets (Phantom, Solflare, etc.)
- **Transaction receipts** - Store complete transaction data
- **Event-driven** - Real-time status updates

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │  Swap UI     │───▶│ Swap Executor│───▶│ Wallet Adapter│    │
│  │  Component   │    │  (Frontend)  │    │  (wagmi/     │     │
│  └──────────────┘    └──────────────┘    │   Solana)     │     │
│         │                    │           └──────────────┘     │
│         │                    │                  │             │
│         │                    ▼                  ▼             │
│         │            ┌──────────────────────────────────┐     │
│         │            │   Transaction Signing            │     │
│         │            │   (User Approval Required)        │     │
│         │            └──────────────────────────────────┘     │
│         │                    │                                │
│         └───────────────────┼──────────────────────────────┘  │
│                             │                                  │
│                             ▼                                  │
│                    ┌─────────────────┐                        │
│                    │  Submit to Chain│                        │
│                    │  (RPC/Provider)  │                        │
│                    └─────────────────┘                        │
│                             │                                  │
└─────────────────────────────┼──────────────────────────────────┘
                               │
                               │ HTTP/WebSocket
                               │
┌───────────────────────────────┼──────────────────────────────────┐
│                    BACKEND    │                                  │
├───────────────────────────────┼──────────────────────────────────┤
│                               ▼                                  │
│                    ┌─────────────────────┐                      │
│                    │  Swap Execution     │                      │
│                    │  Service (Backend)   │                      │
│                    └─────────────────────┘                      │
│                             │                                    │
│         ┌───────────────────┼───────────────────┐                │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │
│  │  Router     │   │ Transaction │   │  Status     │            │
│  │  Adapters   │   │  Builder    │   │  Tracker    │            │
│  │             │   │             │   │             │            │
│  │ - LiFi      │   │ - EVM       │   │ - Polling   │            │
│  │ - Jupiter   │   │ - Solana    │   │ - WebSocket │            │
│  │ - Uniswap   │   │             │   │ - Events    │            │
│  │ - Pancake   │   │             │   │             │            │
│  └─────────────┘   └─────────────┘   └─────────────┘            │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             │                                    │
│                             ▼                                    │
│                    ┌─────────────────────┐                      │
│                    │  Transaction        │                      │
│                    │  Storage Service     │                      │
│                    │  (Database)         │                      │
│                    └─────────────────────┘                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. **Frontend: Swap Executor**

**Location**: `lib/frontend/services/swap-executor.ts`

**Responsibilities**:
- Orchestrate swap execution flow
- Handle wallet interactions
- Manage transaction state
- Provide user feedback
- Coordinate with backend

**Key Methods**:
```typescript
interface SwapExecutor {
  // Main execution method
  executeSwap(params: SwapExecutionParams): Promise<SwapExecutionResult>;
  
  // Status monitoring
  monitorTransaction(txHash: string, chainId: number): Promise<TransactionStatus>;
  
  // Error handling
  handleExecutionError(error: Error, context: ExecutionContext): void;
}
```

**Flow**:
1. Validate swap parameters (amount, slippage, quote expiration)
2. Request transaction from backend (`/api/v1/swap/execute`)
3. Receive transaction data (unsigned transaction)
4. Sign transaction with wallet (user approval)
5. Submit transaction to blockchain
6. Monitor transaction status
7. Update UI with progress

---

### 2. **Backend: Swap Execution Service**

**Location**: `lib/backend/services/swap-execution-service.ts`

**Responsibilities**:
- Build transactions for different routers
- Call router execution APIs (e.g., Jupiter execute endpoint)
- Validate quotes before execution
- Track transaction status
- Store transaction data

**Key Methods**:
```typescript
interface SwapExecutionService {
  // Build transaction for execution
  buildTransaction(route: RouterRoute, params: ExecutionParams): Promise<TransactionData>;
  
  // Execute via router API (if needed)
  executeViaRouter(route: RouterRoute, params: ExecutionParams): Promise<ExecutionResult>;
  
  // Validate quote before execution
  validateQuote(route: RouterRoute): boolean;
  
  // Store transaction
  storeTransaction(tx: TransactionRecord): Promise<void>;
}
```

**Router-Specific Handling**:

#### EVM Routers (LiFi, Uniswap, PancakeSwap)
- **Transaction Building**: Use router SDKs to build transaction calldata
- **Execution**: Client signs and submits directly to chain
- **Backend Role**: Prepare transaction data, validate quote

#### Jupiter (Solana)
- **Transaction Building**: Jupiter provides base64 transaction
- **Execution**: Backend calls `/ultra/v1/execute` (if taker provided)
- **Client Role**: Sign transaction, submit to Solana network

---

### 3. **Transaction Builder**

**Location**: `lib/backend/services/transaction-builder.ts`

**Responsibilities**:
- Build EVM transactions (calldata, gas estimation)
- Build Solana transactions (instructions, accounts)
- Handle router-specific transaction formats
- Estimate gas/fees

**EVM Transaction Structure**:
```typescript
interface EVMTransaction {
  to: string;           // Router contract address
  data: string;         // Calldata (swap function call)
  value: string;        // Native token amount (if needed)
  gasLimit: string;     // Estimated gas limit
  gasPrice?: string;     // Gas price (legacy)
  maxFeePerGas?: string; // EIP-1559 max fee
  maxPriorityFeePerGas?: string; // EIP-1559 priority fee
  chainId: number;      // Chain ID
  nonce?: number;       // Transaction nonce
}
```

**Solana Transaction Structure**:
```typescript
interface SolanaTransaction {
  instructions: Instruction[]; // Transaction instructions
  recentBlockhash: string;     // Recent blockhash
  feePayer: string;            // Fee payer public key
  signatures: Signature[];     // Signatures (after signing)
}
```

---

### 4. **Transaction Status Tracker**

**Location**: `lib/backend/services/transaction-tracker.ts`

**Responsibilities**:
- Poll blockchain for transaction status
- Handle transaction confirmations
- Detect failures and reversions
- Update transaction records
- Emit status events

**Status States**:
```typescript
type TransactionStatus = 
  | 'pending'        // Submitted, waiting for confirmation
  | 'confirming'     // In mempool, waiting for block
  | 'confirmed'      // Included in block
  | 'failed'         // Transaction failed/reverted
  | 'expired'        // Transaction expired (Solana)
  | 'cancelled';     // User cancelled
```

**Tracking Strategy**:
- **EVM**: Poll `eth_getTransactionReceipt` until confirmed
- **Solana**: Poll `getSignatureStatus` until finalized
- **WebSocket**: Use provider WebSocket for real-time updates (if available)
- **Fallback**: Polling with exponential backoff

---

### 5. **Transaction Storage**

**Location**: `lib/backend/services/transaction-storage.ts`

**Database Schema**:
```typescript
interface TransactionRecord {
  // Identifiers
  id: string;                    // UUID
  txHash: string;                // Transaction hash
  chainId: number;               // Chain ID
  
  // Swap Details
  routeId: string;               // Route identifier from router
  router: string;                // Router name (lifi, jupiter, etc.)
  fromToken: TokenInfo;          // Source token
  toToken: TokenInfo;            // Destination token
  fromAmount: string;            // Input amount
  toAmount: string;              // Expected output amount
  actualToAmount?: string;      // Actual output (after execution)
  
  // Execution Details
  userAddress: string;           // User's wallet address
  recipientAddress?: string;    // Recipient (if different)
  slippage: number;              // Slippage tolerance (%)
  gasUsed?: string;              // Gas used (EVM)
  gasPrice?: string;            // Gas price (EVM)
  fees: FeeBreakdown;           // Fee breakdown
  
  // Status
  status: TransactionStatus;     // Current status
  blockNumber?: number;         // Block number (EVM)
  blockHash?: string;           // Block hash
  confirmations: number;        // Number of confirmations
  
  // Timestamps
  createdAt: Date;              // When transaction was created
  submittedAt?: Date;           // When transaction was submitted
  confirmedAt?: Date;           // When transaction was confirmed
  failedAt?: Date;              // When transaction failed
  
  // Error Handling
  error?: string;               // Error message (if failed)
  errorCode?: string;           // Error code
  
  // Metadata
  quoteData: any;               // Original quote data
  transactionData: any;         // Transaction data (calldata, etc.)
  receipt?: any;                // Transaction receipt
}
```

---

## Execution Flow (Step-by-Step)

### Phase 1: Preparation

1. **User Initiates Swap**
   - User clicks "Swap" button
   - Frontend validates inputs (amount, slippage, wallet connected)

2. **Quote Validation**
   - Check if quote is still valid (not expired)
   - Verify quote hasn't changed significantly
   - If invalid, fetch new quote

3. **Pre-execution Checks**
   - Verify wallet balance (sufficient funds)
   - Check token approvals (EVM: ERC20 approval if needed)
   - Validate recipient address (if provided)

### Phase 2: Transaction Building

4. **Backend: Build Transaction**
   - Call `/api/v1/swap/execute` with route and parameters
   - Backend validates route and builds transaction
   - Router-specific transaction building:
     - **LiFi**: Use LiFi SDK to get transaction calldata
     - **Uniswap**: Use Uniswap SDK to build swap transaction
     - **PancakeSwap**: Use PancakeSwap SDK to build swap transaction
     - **Jupiter**: Call Jupiter `/ultra/v1/execute` to get transaction

5. **Transaction Data Returned**
   - Backend returns unsigned transaction
   - Includes all necessary data (calldata, gas estimates, etc.)

### Phase 3: Signing & Submission

6. **Client: Sign Transaction**
   - Frontend prompts user to sign transaction
   - Wallet shows transaction details for approval
   - User approves or rejects

7. **Client: Submit Transaction**
   - If approved, submit signed transaction to blockchain
   - Get transaction hash immediately
   - Store transaction hash for tracking

### Phase 4: Monitoring

8. **Backend: Store Transaction**
   - Create transaction record in database
   - Status: `pending`
   - Store transaction hash, route data, user address

9. **Backend: Start Monitoring**
   - Begin polling transaction status
   - Update status as transaction progresses
   - Handle confirmations

10. **Frontend: Real-time Updates**
    - Poll backend for transaction status
    - Update UI with progress
    - Show success/error notifications

### Phase 5: Completion

11. **Transaction Confirmed**
    - Backend detects confirmation
    - Update status to `confirmed`
    - Store transaction receipt
    - Calculate actual output amount

12. **Success Handling**
    - Frontend shows success notification
    - Update user balances
    - Add to transaction history
    - Clear swap form (optional)

---

## Router-Specific Implementation

### 1. LiFi (EVM Cross-Chain)

**Execution Flow**:
```typescript
// Backend: Build transaction
const lifiRoute = await getQuote(routeParams);
const transaction = await buildLiFiTransaction(lifiRoute, userAddress);

// Client: Sign and submit
const signedTx = await wallet.signTransaction(transaction);
const txHash = await wallet.sendTransaction(signedTx);

// Backend: Monitor cross-chain status
// LiFi provides status updates via their API
const status = await getLiFiStatus(lifiRoute.txHash);
```

**Key Points**:
- LiFi handles cross-chain execution automatically
- Transaction includes bridge steps
- Status tracking via LiFi status API
- Multiple transactions for multi-step routes

### 2. Uniswap (EVM Same-Chain)

**Execution Flow**:
```typescript
// Backend: Build swap transaction
const swapParams = {
  tokenIn: fromToken.address,
  tokenOut: toToken.address,
  amountIn: fromAmount,
  amountOutMinimum: minAmountOut,
  recipient: userAddress,
  deadline: Math.floor(Date.now() / 1000) + 1800, // 30 min
};
const calldata = await uniswapRouter.encodeSwap(swapParams);

// Client: Sign and submit
const tx = {
  to: UNISWAP_ROUTER_ADDRESS,
  data: calldata,
  value: isNativeToken ? fromAmount : '0',
};
const txHash = await wallet.sendTransaction(tx);
```

**Key Points**:
- Direct contract interaction
- Handle ERC20 approvals separately
- Simple single-transaction swap
- Standard EVM transaction flow

### 3. PancakeSwap (EVM Same-Chain)

**Execution Flow**:
```typescript
// Backend: Build swap transaction
const swapParams = {
  path: [fromToken.address, toToken.address],
  amountIn: fromAmount,
  amountOutMin: minAmountOut,
  to: userAddress,
  deadline: Math.floor(Date.now() / 1000) + 1800,
};
const calldata = await pancakeRouter.encodeSwap(swapParams);

// Client: Sign and submit (same as Uniswap)
```

**Key Points**:
- Similar to Uniswap
- Different router contract addresses per chain
- Handle BNB native token on BSC

### 4. Jupiter (Solana Same-Chain)

**Execution Flow**:
```typescript
// Backend: Get transaction from Jupiter
const order = await getJupiterOrder(params);
// If taker provided, Jupiter returns transaction
const transaction = order.transaction; // Base64 encoded

// Client: Sign transaction
const tx = VersionedTransaction.deserialize(Buffer.from(transaction, 'base64'));
const signedTx = await wallet.signTransaction(tx);

// Client: Submit to Solana
const txHash = await connection.sendTransaction(signedTx, {
  skipPreflight: false,
  maxRetries: 3,
});

// Backend: Monitor via Solana RPC
const status = await connection.getSignatureStatus(txHash);
```

**Key Points**:
- Jupiter provides pre-built transaction
- Client signs and submits directly
- Solana transactions are versioned
- Handle transaction expiration (recent blockhash)

---

## API Endpoints

### 1. Execute Swap

**Endpoint**: `POST /api/v1/swap/execute`

**Request**:
```typescript
{
  routeId: string;           // Route identifier from quote
  userAddress: string;       // User's wallet address
  recipientAddress?: string; // Optional recipient
  slippage?: number;        // Override slippage (optional)
}
```

**Response**:
```typescript
{
  transactionId: string;     // Internal transaction ID
  transaction: {
    // EVM
    to?: string;
    data?: string;
    value?: string;
    gasLimit?: string;
    // Solana
    transaction?: string;    // Base64 encoded
    // Common
    chainId: number;
  };
  route: RouterRoute;        // Route details
  estimatedGas?: string;    // Gas estimate
  estimatedFees?: FeeBreakdown;
}
```

### 2. Get Transaction Status

**Endpoint**: `GET /api/v1/swap/status/:transactionId`

**Response**:
```typescript
{
  transactionId: string;
  txHash: string;
  status: TransactionStatus;
  confirmations: number;
  blockNumber?: number;
  receipt?: any;
  error?: string;
}
```

### 3. Get Transaction History

**Endpoint**: `GET /api/v1/swap/history`

**Query Params**:
- `userAddress`: Filter by user
- `chainId`: Filter by chain
- `status`: Filter by status
- `limit`: Number of results
- `offset`: Pagination offset

**Response**:
```typescript
{
  transactions: TransactionRecord[];
  total: number;
  limit: number;
  offset: number;
}
```

---

## Error Handling

### Error Categories

1. **User Errors**
   - Insufficient balance
   - Slippage exceeded
   - Transaction rejected by user
   - Invalid parameters

2. **Network Errors**
   - RPC connection failures
   - Transaction timeout
   - Network congestion

3. **Router Errors**
   - Quote expired
   - Route no longer available
   - Router API failures

4. **Transaction Errors**
   - Transaction reverted
   - Out of gas
   - Nonce issues

### Error Recovery

```typescript
interface ErrorRecoveryStrategy {
  // Retry logic
  retryable: boolean;
  maxRetries: number;
  retryDelay: number;
  
  // User actions
  userActionRequired: boolean;
  userMessage: string;
  
  // Fallback
  fallbackRoute?: RouterRoute;
}
```

---

## Security Considerations

### 1. **Quote Validation**
- Verify quote hasn't expired
- Check quote signature (if router provides)
- Validate slippage limits
- Reject stale quotes

### 2. **Transaction Validation**
- Verify transaction parameters match quote
- Check recipient address (prevent phishing)
- Validate amounts (prevent front-running)
- Enforce slippage limits

### 3. **Rate Limiting**
- Limit swap requests per user
- Prevent spam/abuse
- Implement cooldown periods

### 4. **Audit Logging**
- Log all swap attempts
- Track failures and errors
- Monitor for suspicious activity

---

## Implementation Phases

### Phase 1: EVM Same-Chain (Uniswap, PancakeSwap)
**Priority**: High
**Complexity**: Medium
**Timeline**: 1-2 weeks

**Tasks**:
1. Create swap execution service
2. Implement Uniswap transaction builder
3. Implement PancakeSwap transaction builder
4. Create transaction tracker
5. Build API endpoints
6. Frontend integration

### Phase 2: EVM Cross-Chain (LiFi)
**Priority**: High
**Complexity**: High
**Timeline**: 2-3 weeks

**Tasks**:
1. Integrate LiFi SDK for execution
2. Handle multi-step transactions
3. Implement cross-chain status tracking
4. Handle bridge transactions
5. Test cross-chain flows

### Phase 3: Solana (Jupiter)
**Priority**: High
**Complexity**: Medium
**Timeline**: 1-2 weeks

**Tasks**:
1. Integrate Jupiter execute API
2. Implement Solana transaction signing
3. Handle Solana transaction expiration
4. Implement Solana status tracking
5. Test Solana swaps

### Phase 4: Other Chains & Routers
**Priority**: Medium
**Complexity**: Varies
**Timeline**: Ongoing

**Tasks**:
1. Add support for additional EVM chains
2. Integrate additional routers (Squid, etc.)
3. Add Cosmos chain support
4. Add other non-EVM chains

---

## Testing Strategy

### Unit Tests
- Transaction building logic
- Quote validation
- Error handling
- Status tracking

### Integration Tests
- End-to-end swap flows
- Router API integration
- Wallet integration
- Transaction submission

### E2E Tests
- Complete swap flows
- Cross-chain swaps
- Error scenarios
- User interactions

---

## Monitoring & Analytics

### Key Metrics
- Swap success rate
- Average execution time
- Gas/fee costs
- Error rates by router
- User satisfaction

### Alerts
- High failure rates
- Router API downtime
- Transaction delays
- Unusual patterns

---

## Conclusion

This architecture provides a robust, scalable foundation for swap execution across multiple chains and routers. By separating concerns between client and backend, we ensure security while maintaining flexibility for future expansion.

**Next Steps**:
1. Review and approve architecture
2. Set up database schema
3. Begin Phase 1 implementation (EVM same-chain)
4. Iterate based on feedback

