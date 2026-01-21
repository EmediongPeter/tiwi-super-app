# Jupiter Integration Implementation

## Overview
This document describes the implementation of Jupiter swap routing for Solana in the main project, based on the implementation from the `tiwi-test` folder.

## What Was Implemented

### 1. Jupiter Adapter (`lib/backend/routers/adapters/jupiter-adapter.ts`)
- **Purpose**: Implements the `SwapRouter` interface for Jupiter Swap API
- **Features**:
  - Uses Jupiter Lite API (`https://lite-api.jup.ag`) for quotes
  - Only supports same-chain Solana swaps (chain ID: 7565164)
  - Does NOT support cross-chain swaps
  - Priority: 3 (higher than PancakeSwap/Uniswap, lower than LiFi)
  - Slippage range: 0.1% - 50% (10-5000 basis points)

### 2. Router Registration (`lib/backend/routers/init.ts`)
- Jupiter adapter is automatically registered when routers are initialized
- Registered with priority 3, making it the preferred router for Solana same-chain swaps

### 3. Integration Points
The following components already had Jupiter support and work seamlessly:

#### Chain Transformer (`lib/backend/routers/transformers/chain-transformer.ts`)
- Already had `toJupiter()` method
- Returns canonical chain ID (7565164) for Solana

#### Token Transformer (`lib/backend/routers/transformers/token-transformer.ts`)
- Already validates Solana token addresses (base58, 32-44 characters)
- Passes through Solana mint addresses as-is

#### Slippage Transformer (`lib/backend/routers/transformers/slippage-transformer.ts`)
- Already converts slippage percentage to basis points for Jupiter
- Jupiter uses basis points (1% = 100 bps)

## How It Works

### Request Flow
1. Frontend sends route request with Solana chain ID (7565164)
2. Route Service checks eligible routers
3. Jupiter adapter is selected for same-chain Solana swaps
4. Chain/Token/Slippage transformers convert to Jupiter format
5. Jupiter adapter calls Jupiter Lite API for quote
6. Quote is normalized to `RouterRoute` format
7. Route is returned to frontend

### API Endpoints Used
- **Quote**: `GET https://lite-api.jup.ag/swap/v1/quote`
  - Parameters: `inputMint`, `outputMint`, `amount`, `slippageBps`, `platformFeeBps`, `onlyDirectRoutes`, `restrictIntermediateTokens`
  - Returns: Quote with `outAmount`, `priceImpactPct`, `routePlan`

### Key Differences from tiwi-test
1. **Backend-only routing**: All routing logic is in the backend (as requested)
2. **No frontend Jupiter calls**: Frontend uses the unified route API
3. **Integrated with router registry**: Jupiter is part of the router selection system
4. **Normalized response format**: Returns `RouterRoute` format consistent with other routers

## Configuration

### Environment Variables
- `JUPITER_API_KEY` (optional): For advanced Jupiter features (not required for basic swaps)
- `NEXT_PUBLIC_JUPITER_API_KEY` (optional): Alternative env var name

### Default Settings
- Platform fee: 15 bps (0.15%) - Tiwi protocol fee
- Only direct routes: `true` (for faster quotes)
- Restrict intermediate tokens: `true` (required for free tier)

## Testing

### Manual Testing
To test Jupiter integration:

1. **Same-chain Solana swap**:
   ```bash
   POST /api/v1/route
   {
     "fromToken": {
       "chainId": 7565164,
       "address": "So11111111111111111111111111111111111111112", // SOL
       "decimals": 9
     },
     "toToken": {
       "chainId": 7565164,
       "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
       "decimals": 6
     },
     "fromAmount": "1.0",
     "slippage": 0.5
   }
   ```

2. **Expected behavior**:
   - Jupiter adapter should be selected
   - Quote should be returned with `router: "jupiter"`
   - Route should have valid `outAmount` and `priceImpact`

### Router Selection
For Solana same-chain swaps:
- **Jupiter** (priority 3) - Selected first
- **LiFi** (priority 0) - Fallback if Jupiter fails (though LiFi doesn't support same-chain Solana)

## Files Modified/Created

### Created
- `lib/backend/routers/adapters/jupiter-adapter.ts` - Jupiter router implementation

### Modified
- `lib/backend/routers/init.ts` - Added Jupiter adapter registration

### Already Supported (No Changes Needed)
- `lib/backend/routers/transformers/chain-transformer.ts` - Already had Jupiter support
- `lib/backend/routers/transformers/token-transformer.ts` - Already had Solana token validation
- `lib/backend/routers/transformers/slippage-transformer.ts` - Already had basis points conversion
- `lib/backend/services/route-service.ts` - Already handles router selection and transformation

## Notes

1. **No Transaction Execution**: This implementation only handles routing/quotes. Transaction execution is handled on the frontend (as per the tiwi-test implementation).

2. **Free Tier**: Uses `restrictIntermediateTokens: true` which is required for Jupiter's free tier. If you have a Jupiter API key, you can set `restrictIntermediateTokens: false` for better routes.

3. **Error Handling**: Jupiter adapter throws errors that are caught by the route service and normalized to user-friendly messages.

4. **Timeout**: 10-second timeout for Jupiter API calls (same as other routers).

## Future Enhancements

1. **Transaction Building**: Could add backend endpoint for building Jupiter swap transactions
2. **Route Caching**: Could cache Jupiter quotes for better performance
3. **Advanced Features**: With API key, could use Jupiter Ultra API for better routes
4. **Price Impact Warnings**: Could add warnings for high price impact swaps

