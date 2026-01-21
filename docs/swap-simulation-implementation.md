# Swap Simulation Implementation

## Overview

This document describes the implementation of on-chain swap simulation for EVM DEX executors (PancakeSwap and Uniswap). The simulation step validates that transactions will succeed before sending them, preventing wallet warnings like "This transaction is likely to fail."

## Problem

The original implementation was missing the on-chain simulation step that exists in the `tiwi-test` project. Without simulation, wallet providers cannot validate transactions beforehand, leading to warnings and potential user confusion.

## Solution

Added comprehensive on-chain simulation to the `EVMDEXExecutor` base class, following the exact pattern from `tiwi-test`'s `SwapInterface.tsx` and `pancakeswap-router.ts`.

## Implementation Details

### 1. Added Constants

**WETH Addresses** (`evm-dex-executor.ts`):
- Maps chain IDs to wrapped native token addresses (WETH, WBNB, WMATIC, etc.)
- Used for detecting native token swaps

**ERC20 ABI** (`evm-dex-executor.ts`):
- `balanceOf` and `allowance` functions
- Used for pre-simulation balance and allowance checks

### 2. Added `simulateSwap` Method

The `simulateSwap` method performs the following steps:

1. **Pre-flight Checks**:
   - For non-native tokens: Checks balance and allowance
   - For native tokens: Checks ETH/BNB balance
   - Provides specific error messages if checks fail

2. **Function Selection**:
   - Determines the correct swap function based on:
     - Native token input/output detection
     - Fee-on-transfer token support
   - Functions supported:
     - `swapExactETHForTokens` / `swapExactETHForTokensSupportingFeeOnTransferTokens`
     - `swapExactTokensForETH` / `swapExactTokensForETHSupportingFeeOnTransferTokens`
     - `swapExactTokensForTokens` / `swapExactTokensForTokensSupportingFeeOnTransferTokens`

3. **On-Chain Simulation**:
   - Uses `publicClient.simulateContract()` to simulate the transaction
   - Validates that the transaction will succeed on-chain
   - Returns success/failure with error messages

4. **Error Handling**:
   - Handles `TRANSFER_FROM_FAILED` errors (usually RPC indexing delays)
   - Automatically retries with fee-on-transfer functions if needed
   - Provides user-friendly error messages

### 3. Integration into Execute Flow

The simulation is called in the `execute` method **after** token approval but **before** sending the transaction:

```typescript
// 1. Token approval (if needed)
await ensureTokenApproval(...);

// 2. Get fresh quote
const amountOutMin = await this.getAmountOutMin(...);

// 3. Build swap data
const swapData = this.buildSwapData(...);

// 4. SIMULATE SWAP (NEW)
const simulationResult = await this.simulateSwap(...);

// 5. Handle simulation retries (RPC indexing delays)
if (!simulationResult.success && simulationResult.error?.includes('TRANSFER_FROM_FAILED')) {
  // Retry with delays
}

// 6. Estimate gas
await publicClient.estimateGas(...);

// 7. Send transaction
const txHash = await walletClient.sendTransaction(...);
```

### 4. Retry Logic

The implementation includes retry logic for common issues:

1. **RPC Indexing Delays**: If simulation fails with `TRANSFER_FROM_FAILED`, retries up to 3 times with 1-second delays (allows RPC to index the approval transaction)

2. **Fee-on-Transfer Detection**: If simulation fails and it's not a fee-on-transfer token, automatically retries with fee-on-transfer supporting functions

3. **Error Categorization**: 
   - Balance errors: Thrown immediately (user needs to fix)
   - Allowance errors: Warning shown, but proceeds (might be RPC delay)
   - Other errors: Warning shown, but proceeds (transaction might still work)

### 5. Updated ABIs

Both `PancakeSwapExecutor` and `UniswapExecutor` now include fee-on-transfer supporting functions in their ABIs:
- `swapExactTokensForTokensSupportingFeeOnTransferTokens`
- `swapExactETHForTokensSupportingFeeOnTransferTokens`
- `swapExactTokensForETHSupportingFeeOnTransferTokens`

## Process Flow (Complete)

The complete swap execution process now follows this order (matching `tiwi-test`):

1. **Token Approval** ✅
   - Check current allowance
   - Approve if needed (max approval for efficiency)

2. **Get Fresh Quote** ✅
   - Call router's `getAmountsOut` to verify on-chain
   - Calculate `amountOutMin` with slippage

3. **Build Swap Data** ✅
   - Encode function call with correct parameters
   - Determine native token vs ERC20 token handling

4. **Simulate Swap** ✅ (NEW)
   - Pre-flight checks (balance, allowance)
   - On-chain simulation using `simulateContract`
   - Retry logic for RPC delays
   - Fee-on-transfer detection

5. **Verify Approval** ✅
   - Re-check approval (in case of RPC delays)
   - Retry approval if needed

6. **Estimate Gas** ✅
   - Optional gas estimation
   - Non-blocking (continues even if fails)

7. **Send Transaction** ✅
   - Sign and submit transaction
   - Wait for confirmation
   - Return receipt

## Benefits

1. **Prevents Wallet Warnings**: Transactions are validated before sending, so wallets don't show "likely to fail" warnings

2. **Better Error Messages**: Users get specific error messages (insufficient balance, allowance issues, etc.) before attempting the transaction

3. **RPC Delay Handling**: Automatically handles RPC indexing delays with retries

4. **Fee-on-Transfer Support**: Automatically detects and handles fee-on-transfer tokens

5. **Improved UX**: Users know upfront if a transaction will succeed or fail

## Testing

To test the implementation:

1. **Normal Swap**: Should simulate successfully and proceed
2. **Insufficient Balance**: Should show clear error message
3. **Insufficient Allowance**: Should show warning but proceed (after approval)
4. **RPC Delay**: Should retry automatically
5. **Fee-on-Transfer Token**: Should detect and use appropriate function

## Files Modified

1. `lib/frontend/services/swap-executor/executors/evm-dex-executor.ts`
   - Added WETH addresses and ERC20 ABI constants
   - Added `simulateSwap` method
   - Integrated simulation into `execute` flow

2. `lib/frontend/services/swap-executor/executors/pancakeswap-executor.ts`
   - Added fee-on-transfer functions to ABI

3. `lib/frontend/services/swap-executor/executors/uniswap-executor.ts`
   - Added fee-on-transfer functions to ABI

## References

- `tiwi-test/app/components/SwapInterface.tsx` (lines 2471-2584): Simulation implementation
- `tiwi-test/app/utils/pancakeswap-router.ts` (lines 618-745): `simulateSwap` function



