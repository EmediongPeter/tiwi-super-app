# Swap Executor Service

A modular, scalable swap execution system for executing swaps across multiple routers (LiFi, Jupiter, PancakeSwap, Uniswap).

## Architecture

The swap executor follows a clean, modular architecture:

```
SwapExecutor (Main Service)
  ├── LiFiExecutor (Cross-chain & same-chain)
  ├── JupiterExecutor (Solana same-chain)
  ├── PancakeSwapExecutor (EVM same-chain)
  └── UniswapExecutor (EVM same-chain)
```

## Features

- ✅ **Modular Design**: Each router has its own executor
- ✅ **Type-Safe**: Full TypeScript support
- ✅ **Status Updates**: Real-time execution status callbacks
- ✅ **Error Handling**: Comprehensive error handling with user-friendly messages
- ✅ **Token Approvals**: Automatic ERC20 token approvals for EVM chains
- ✅ **Chain Switching**: Automatic chain switching for EVM chains
- ✅ **Quote Validation**: Validates quote expiration before execution

## Usage

### Basic Usage (Service)

```typescript
import { swapExecutor } from '@/lib/frontend/services/swap-executor';
import type { SwapExecutionParams } from '@/lib/frontend/services/swap-executor';

const params: SwapExecutionParams = {
  route: routerRoute, // From route API
  fromToken: fromToken,
  toToken: toToken,
  fromAmount: '100.5',
  userAddress: '0x...',
  onStatusUpdate: (status) => {
    console.log('Status:', status.stage, status.message);
  },
};

try {
  const result = await swapExecutor.execute(params);
  console.log('Swap successful!', result.txHash);
} catch (error) {
  console.error('Swap failed:', error);
}
```

### React Hook Usage

```typescript
import { useSwapExecution } from '@/hooks/useSwapExecution';

function SwapButton() {
  const { execute, isExecuting, status, error } = useSwapExecution();

  const handleSwap = async () => {
    try {
      const result = await execute({
        route: routerRoute,
        fromToken: fromToken,
        toToken: toToken,
        fromAmount: '100.5',
        userAddress: userAddress,
      });
      
      console.log('Swap successful!', result.txHash);
    } catch (err) {
      console.error('Swap failed:', err);
    }
  };

  return (
    <button onClick={handleSwap} disabled={isExecuting}>
      {isExecuting ? status?.message || 'Executing...' : 'Swap'}
    </button>
  );
}
```

## Router Support

### LiFi
- **Use Case**: Cross-chain swaps, same-chain swaps
- **Execution**: Uses LiFi SDK's `executeRoute()` function
- **Features**: Multi-step routes, automatic bridge handling

### Jupiter
- **Use Case**: Solana same-chain swaps
- **Execution**: Uses pre-built transactions from Jupiter Ultra API
- **Features**: MEV protection, sub-second execution

### PancakeSwap
- **Use Case**: BSC and other EVM chains
- **Execution**: Direct contract interaction
- **Features**: V2 router support

### Uniswap
- **Use Case**: Ethereum and other EVM chains
- **Execution**: Direct contract interaction
- **Features**: V2 router support (SushiSwap on other chains)

## Status Updates

The executor provides real-time status updates:

```typescript
type SwapStage =
  | 'preparing'      // Preparing swap
  | 'approving'      // Approving token (EVM only)
  | 'signing'        // Waiting for user signature
  | 'submitting'     // Submitting transaction
  | 'confirming'     // Waiting for confirmation
  | 'completed'      // Swap completed
  | 'failed';        // Swap failed
```

## Error Handling

All errors are wrapped in `SwapExecutionError` with error codes:

```typescript
enum SwapErrorCode {
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  APPROVAL_REJECTED = 'APPROVAL_REJECTED',
  TRANSACTION_REJECTED = 'TRANSACTION_REJECTED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  QUOTE_EXPIRED = 'QUOTE_EXPIRED',
  INVALID_ROUTE = 'INVALID_ROUTE',
  UNSUPPORTED_ROUTER = 'UNSUPPORTED_ROUTER',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
```

## Adding a New Router

To add a new router executor:

1. Create a new executor class implementing `SwapRouterExecutor`:

```typescript
import type { SwapRouterExecutor, SwapExecutionParams, SwapExecutionResult } from '../types';

export class MyRouterExecutor implements SwapRouterExecutor {
  canHandle(route: RouterRoute): boolean {
    return route.router === 'myrouter';
  }

  async execute(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    // Implementation
  }
}
```

2. Register it in `SwapExecutor`:

```typescript
import { MyRouterExecutor } from './executors/myrouter-executor';

const swapExecutor = new SwapExecutor();
swapExecutor.registerExecutor(new MyRouterExecutor());
```

## Best Practices

1. **Always validate quote expiration** before execution
2. **Handle user rejections** gracefully (approval/transaction rejections)
3. **Provide clear status updates** to users
4. **Use the React hook** for component integration
5. **Handle errors** with user-friendly messages

## File Structure

```
lib/frontend/services/swap-executor/
├── index.ts                    # Main SwapExecutor service
├── types.ts                    # Type definitions
├── executors/
│   ├── lifi-executor.ts        # LiFi executor
│   ├── jupiter-executor.ts     # Jupiter executor
│   ├── pancakeswap-executor.ts # PancakeSwap executor
│   ├── uniswap-executor.ts     # Uniswap executor
│   └── evm-dex-executor.ts     # Base class for EVM DEXes
├── services/
│   └── approval-handler.ts     # Token approval service
└── utils/
    ├── amount-converter.ts     # Amount conversion utilities
    ├── chain-helpers.ts        # Chain type utilities
    ├── error-handler.ts        # Error handling utilities
    └── wallet-helpers.ts       # Wallet client utilities
```

## Dependencies

- `viem`: EVM transaction building and signing
- `wagmi`: EVM wallet connection
- `@solana/web3.js`: Solana transaction handling
- `@lifi/sdk`: LiFi route execution

