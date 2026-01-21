# Wallet Connection UX Design & Implementation Plan

## Overview

This document outlines the design and implementation plan for the wallet connection UX system, inspired by Relay's UX and aligned with our engineering principles.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Wallet Connection System                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Connect Wallet Modal                            │  │
│  │  • Installed Wallets Section                     │  │
│  │  • Popular Wallets Section + "More" Button       │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                               │
│                          ▼                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Wallet Explorer Modal (from "More" button)     │  │
│  │  • Top 10 wallets (default)                     │  │
│  │  • Search with WalletConnect API                │  │
│  │  • Cached results                                │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                               │
│                          ▼                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Chain Selection Modal (multi-chain wallets)     │  │
│  │  • Solana / Ethereum options                     │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                               │
│                          ▼                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Wallet Connection Logic                         │  │
│  │  • Single-chain: connect immediately             │  │
│  │  • Multi-chain: show chain selection first       │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Component Structure

```
components/wallet/
├── connect-wallet-modal.tsx          # Main connect modal
├── wallet-explorer-modal.tsx         # Explorer modal (from "More")
├── chain-selection-modal.tsx         # Chain selection for multi-chain
├── wallet-list-section.tsx           # Reusable wallet list component
├── wallet-item.tsx                   # Individual wallet item
└── wallet-icon.tsx                   # Wallet icon component (already exists)

lib/wallet/
├── hooks/
│   ├── useWalletDetection.ts         # Wallet detection hook
│   ├── useWalletExplorer.ts          # WalletConnect API hook
│   └── useWalletConnection.ts        # Connection logic hook (update)
└── services/
    └── wallet-explorer-service.ts    # WalletConnect API service
```

## Modal Flow & State Transitions

### Flow 1: Single-Chain Wallet
```
User clicks wallet → Connect immediately → Success toast
```

### Flow 2: Multi-Chain Wallet
```
User clicks wallet → Chain Selection Modal → User selects chain → Connect → Success toast
```

### Flow 3: Wallet Explorer
```
User clicks "More" → Close Connect Modal → Open Explorer Modal → Search/Select → Chain Selection (if multi-chain) → Connect
```

## State Management

### Connect Wallet Modal State
```typescript
interface ConnectWalletModalState {
  isOpen: boolean;
  installedWallets: WalletProvider[];
  popularWallets: WalletProvider[];
  isDetecting: boolean;
}
```

### Wallet Explorer Modal State
```typescript
interface WalletExplorerModalState {
  isOpen: boolean;
  searchQuery: string;
  wallets: WalletConnectWallet[];
  isLoading: boolean;
  error: string | null;
  topWallets: WalletConnectWallet[]; // Cached top 10
}
```

### Chain Selection Modal State
```typescript
interface ChainSelectionModalState {
  isOpen: boolean;
  wallet: WalletProvider | null;
  selectedChain: 'ethereum' | 'solana' | null;
}
```

## Key Logic

### 1. Installed vs Popular Wallets

**Installed Wallets:**
- Detected via `detectWalletProviders()`
- Only shown in "Installed Wallets" section
- Never appear in "Popular Wallets"

**Popular Wallets:**
- Predefined list: [Phantom, MetaMask, Rabby, Base Wallet, Solflare, etc.]
- Filter out any that are already installed
- Deterministic ordering

### 2. Wallet Explorer

**Default View:**
- Show top 10 wallets from WalletConnect API
- Cache results (1 hour TTL)
- No preloading of all wallets

**Search:**
- Query WalletConnect API on input
- Debounce search (300ms)
- Show skeleton loaders during fetch
- Empty state when no results
- Error state on failure

### 3. Multi-Chain Handling

**Detection:**
- Check `wallet.supportedChains.length > 1`
- Filter to only show Solana and Ethereum (even if wallet supports more)

**Chain Selection:**
- Show modal with clear messaging
- Only Solana and Ethereum options
- User must explicitly select

## API Integration

### WalletConnect Explorer API

**Endpoint:** `https://explorer-api.walletconnect.com/v3/wallets`

**Usage:**
- Fetch top wallets on explorer modal open
- Search wallets on query input
- Cache results to avoid repeated calls

**Caching Strategy:**
- Cache top 10 wallets: 1 hour TTL
- Cache search results: 5 minutes TTL
- Invalidate on explicit refresh

## Edge Cases

1. **No wallets installed:** Show only Popular Wallets section
2. **All popular wallets installed:** Hide Popular Wallets section
3. **Search returns no results:** Show empty state with clear message
4. **API fails:** Show error state with retry option
5. **Wallet supports chains we don't support:** Only show Solana/Ethereum in chain selection
6. **User closes modal mid-connection:** Cancel connection, reset state

## Implementation Phases

### Phase 1: Core Modals
- [ ] Connect Wallet Modal (installed + popular sections)
- [ ] Chain Selection Modal
- [ ] Basic wallet connection logic

### Phase 2: Wallet Explorer
- [ ] Wallet Explorer Modal
- [ ] WalletConnect API integration
- [ ] Search functionality
- [ ] Caching

### Phase 3: Polish
- [ ] Loading states
- [ ] Error handling
- [ ] Empty states
- [ ] Animations/transitions

## Design Principles Applied

✅ **Simplicity:** Clear modal hierarchy, no unnecessary abstraction
✅ **Predictability:** User actions always have expected outcomes
✅ **Modularity:** Separate modals, hooks, and services
✅ **Reusability:** Wallet list components reusable across modals
✅ **Readability:** Clear component names and structure
✅ **Scalability:** Easy to add more chains/wallets later

