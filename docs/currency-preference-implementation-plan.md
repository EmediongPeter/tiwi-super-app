# Currency Preference Implementation Plan

## Overview
Implement a global currency preference system that allows users to view all USD values in their preferred currency (default: USD, can change to NGN, EUR, GBP, CNY, JPY). The preference should persist across sessions and update all currency displays throughout the app.

## Current State Analysis

### ✅ Already Implemented
1. **Currency Store** (`lib/frontend/store/currency-store.ts`)
   - Zustand store with localStorage persistence
   - Supports: USD, EUR, NGN, GBP, CNY, JPY
   - Default: USD

2. **Currency Conversion Utilities** (`lib/shared/utils/currency-conversion.ts`)
   - `convertUSDToCurrency()` - Async conversion function
   - `formatCurrency()` - Formatting with currency symbols
   - `convertAndFormatUSD()` - Convenience function (converts + formats)
   - Exchange rate fetching with caching (1 hour TTL)
   - Static fallback rates if API fails

3. **Already Using Currency Conversion**
   - ✅ `app/swap/page.tsx` - Token USD values
   - ✅ `components/swap/swap-details-card.tsx` - Gas fee, TIWI fee

### ❌ Not Yet Using Currency Conversion
1. **Portfolio Page** (`app/portfolio/page.tsx`)
   - Total balance display
   - Daily change (USD)
   - Token values in asset list

2. **Wallet Balance Panel** (`components/wallet/wallet-balance-panel.tsx`)
   - Total balance
   - Daily change display

3. **Status Bar** (`components/layout/status-bar.tsx`)
   - TWC token price

4. **Token Rows** (`components/swap/token-row.tsx`)
   - Token USD values

5. **Market Table** (`components/market/market-table.tsx`)
   - Token prices

6. **Portfolio Formatting** (`lib/shared/utils/portfolio-formatting.ts`)
   - `formatCurrency()` function (currently hardcoded to USD)

7. **Other Components**
   - Any other places displaying USD values

## Implementation Plan

### Phase 1: Create Currency Selector UI Component
**Goal:** Allow users to change their currency preference

**Files to Create:**
- `components/settings/currency-selector.tsx` - Currency dropdown/selector component

**Features:**
- Dropdown/select UI showing all supported currencies
- Display currency symbol and name (e.g., "₦ Nigerian Naira")
- Show current selection
- Update `useCurrencyStore` on change
- Visual feedback on selection

**Integration:**
- Add to Settings page (`app/settings/page.tsx`)
- Add new settings view: `"currency-preference"` or add to existing view
- Add to settings sidebar navigation

---

### Phase 2: Update Portfolio Page
**Goal:** Display portfolio values in user's preferred currency

**Files to Modify:**
- `app/portfolio/page.tsx`
- `lib/shared/utils/portfolio-formatting.ts`

**Changes:**
1. **Portfolio Formatting Utils:**
   - Update `formatCurrency()` to accept currency parameter
   - Use `useCurrencyStore` to get current currency
   - Call `convertAndFormatUSD()` for conversion
   - Handle async conversion properly

2. **Portfolio Page:**
   - Get currency from `useCurrencyStore`
   - Convert total balance using `convertAndFormatUSD()`
   - Convert daily change USD using `convertAndFormatUSD()`
   - Convert token values in asset list
   - Add loading states for currency conversion
   - Handle errors gracefully (fallback to USD)

**Implementation Details:**
- Use `useEffect` to watch currency changes
- Store converted values in state (async conversion)
- Show loading skeleton while converting
- Update both desktop and mobile views

---

### Phase 3: Update Wallet Balance Panel
**Goal:** Display wallet balance in user's preferred currency

**Files to Modify:**
- `components/wallet/wallet-balance-panel.tsx`

**Changes:**
1. Get currency from `useCurrencyStore`
2. Convert `totalUSD` using `convertAndFormatUSD()`
3. Convert daily change USD value
4. Update display to show converted values
5. Add loading state for conversion

---

### Phase 4: Update Status Bar
**Goal:** Display TWC price in user's preferred currency

**Files to Modify:**
- `components/layout/status-bar.tsx`
- `hooks/useTWCPrice.ts` (if needed)

**Changes:**
1. Get currency from `useCurrencyStore`
2. Convert TWC price using `convertAndFormatUSD()`
3. Update display format
4. Maintain flexible width (no truncation)

---

### Phase 5: Update Token Rows & Market Table
**Goal:** Display token USD values in user's preferred currency

**Files to Modify:**
- `components/swap/token-row.tsx`
- `components/market/market-table.tsx`

**Changes:**
1. Get currency from `useCurrencyStore`
2. Convert token USD values using `convertAndFormatUSD()`
3. Update display format
4. Handle loading states

---

### Phase 6: Update Other Components
**Goal:** Ensure all USD displays use currency conversion

**Files to Check/Modify:**
- `components/wallet/transaction-history.tsx` - Transaction USD values
- Any other components displaying USD values

**Process:**
1. Search codebase for hardcoded `$` or `USD` strings
2. Replace with currency conversion
3. Test all affected components

---

## Technical Considerations

### 1. Async Conversion Handling
**Challenge:** `convertAndFormatUSD()` is async, but React components need synchronous rendering.

**Solution:**
- Use `useEffect` to watch currency and USD value changes
- Store converted values in component state
- Show loading skeleton during conversion
- Use `useMemo` for expensive conversions (if needed)

**Example Pattern:**
```typescript
const currency = useCurrencyStore((state) => state.currency);
const [formattedValue, setFormattedValue] = useState<string>("$0.00");

useEffect(() => {
  const convert = async () => {
    const formatted = await convertAndFormatUSD(usdValue, currency);
    setFormattedValue(formatted);
  };
  convert();
}, [usdValue, currency]);
```

### 2. Exchange Rate Caching
**Current State:** Already implemented in `currency-conversion.ts`
- 1 hour TTL
- Static fallback rates
- Client-side cache

**Considerations:**
- Cache is per-component (not shared across components)
- Consider moving to TanStack Query for shared cache
- Or use a global cache object (already exists but could be improved)

### 3. Performance Optimization
**Concerns:**
- Multiple async conversions per page
- Exchange rate API calls (already cached)
- Re-renders on currency change

**Optimizations:**
1. **Prefetch Exchange Rates:**
   - Fetch rates on app load
   - Store in global cache or TanStack Query
   - All components use same cached rates

2. **Batch Conversions:**
   - Convert multiple values in parallel
   - Use `Promise.all()` where possible

3. **Memoization:**
   - Use `useMemo` for expensive calculations
   - Only re-convert when currency or USD value changes

### 4. Error Handling
**Scenarios:**
- Exchange rate API fails → Use static fallback rates
- Invalid currency → Fallback to USD
- Network error → Show USD with warning (optional)

**Implementation:**
- Already handled in `currency-conversion.ts`
- Components should handle conversion errors gracefully
- Show USD if conversion fails

### 5. Currency Symbol Display
**Current:** Symbols are defined in `CURRENCIES` object
- USD: `$`
- NGN: `₦`
- EUR: `€`
- etc.

**Considerations:**
- Ensure symbols display correctly in all browsers
- Use Unicode symbols (already implemented)
- Test with different fonts

---

## Implementation Steps

### Step 1: Create Currency Selector Component
1. Create `components/settings/currency-selector.tsx`
2. Add to Settings page
3. Test currency switching

### Step 2: Update Portfolio Formatting
1. Modify `portfolio-formatting.ts` to use currency conversion
2. Update `formatCurrency()` function
3. Test with different currencies

### Step 3: Update Portfolio Page
1. Integrate currency conversion
2. Update balance display
3. Update asset list values
4. Test desktop and mobile views

### Step 4: Update Wallet Balance Panel
1. Integrate currency conversion
2. Update total balance
3. Update daily change
4. Test

### Step 5: Update Status Bar
1. Integrate currency conversion
2. Update TWC price display
3. Test

### Step 6: Update Token Rows & Market Table
1. Integrate currency conversion
2. Update token USD values
3. Test

### Step 7: Final Testing & Polish
1. Test all components with different currencies
2. Test currency switching
3. Test error scenarios
4. Verify persistence (localStorage)
5. Performance testing

---

## Testing Checklist

### Functional Testing
- [ ] Currency selector displays all currencies
- [ ] Currency selection persists across page reloads
- [ ] All USD values convert correctly
- [ ] Currency symbols display correctly
- [ ] Exchange rates update correctly
- [ ] Fallback to USD works on API failure
- [ ] Loading states show during conversion

### Component Testing
- [ ] Portfolio page: Balance, daily change, token values
- [ ] Wallet panel: Total balance, daily change
- [ ] Status bar: TWC price
- [ ] Token rows: USD values
- [ ] Market table: Token prices
- [ ] Swap page: Already working ✅
- [ ] Swap details: Already working ✅

### Edge Cases
- [ ] Very large values (e.g., 1,000,000 NGN)
- [ ] Very small values (e.g., 0.0001 USD)
- [ ] Zero values
- [ ] Negative values (if applicable)
- [ ] Network errors
- [ ] Invalid currency (shouldn't happen, but test)

### Performance
- [ ] No unnecessary re-renders
- [ ] Exchange rates cached properly
- [ ] Conversions don't block UI
- [ ] Smooth currency switching

---

## Future Enhancements (Optional)

1. **Real-time Exchange Rates:**
   - WebSocket updates
   - More frequent rate updates

2. **More Currencies:**
   - Add more fiat currencies
   - Add crypto currencies (BTC, ETH as base)

3. **Currency Formatting:**
   - Locale-specific formatting
   - Custom decimal places per currency

4. **Exchange Rate History:**
   - Show rate changes over time
   - Historical charts

---

## Files Summary

### New Files
- `components/settings/currency-selector.tsx`

### Modified Files
- `app/portfolio/page.tsx`
- `lib/shared/utils/portfolio-formatting.ts`
- `components/wallet/wallet-balance-panel.tsx`
- `components/layout/status-bar.tsx`
- `components/swap/token-row.tsx`
- `components/market/market-table.tsx`
- `app/settings/page.tsx` (add currency selector)
- `components/settings/settings-sidebar.tsx` (add navigation item)

### Already Using (No Changes Needed)
- `app/swap/page.tsx` ✅
- `components/swap/swap-details-card.tsx` ✅

---

## Estimated Implementation Time

- **Phase 1:** Currency Selector UI - 1-2 hours
- **Phase 2:** Portfolio Page - 2-3 hours
- **Phase 3:** Wallet Balance Panel - 1 hour
- **Phase 4:** Status Bar - 1 hour
- **Phase 5:** Token Rows & Market Table - 1-2 hours
- **Phase 6:** Other Components - 1 hour
- **Testing & Polish:** 2-3 hours

**Total:** ~10-13 hours

---

## Approval Required

Please review this plan and approve before implementation. Key decisions:

1. **Currency Selector Location:** Settings page or navbar dropdown?
2. **Exchange Rate Updates:** Current 1-hour cache acceptable?
3. **Error Handling:** Show warnings on API failure or silent fallback?
4. **Performance:** Prefetch exchange rates on app load?

Ready to proceed upon approval! 🚀

----------------------------------------------------------------------------
Reviewing the existing currency infrastructure and drafting a plan.


[6 tools called]


Drafting the currency preference implementation plan:


[3 tools called]


Drafting the implementation plan:


[1 tool called]


## Currency preference implementation plan

### Current state
- Currency store exists (Zustand with localStorage)
- Currency conversion utilities exist (async conversion + formatting)
- Already working: Swap page and swap details card

### What needs to be done
1. Create currency selector UI (Settings page)
2. Update Portfolio page (balance, daily change, token values)
3. Update Wallet Balance Panel (total balance, daily change)
4. Update Status Bar (TWC price)
5. Update Token Rows & Market Table (token USD values)
6. Update other components displaying USD values

### Technical approach
- Use existing `useCurrencyStore` for global state
- Use existing `convertAndFormatUSD()` for conversion
- Handle async conversion with `useEffect` + state
- Exchange rates cached (1 hour TTL) with static fallback
- Persist preference in localStorage

### Implementation pattern
```typescript
// Get currency from store
const currency = useCurrencyStore((state) => state.currency);

// Convert USD value (async)
const [formattedValue, setFormattedValue] = useState("$0.00");

useEffect(() => {
  const convert = async () => {
    const formatted = await convertAndFormatUSD(usdValue, currency);
    setFormattedValue(formatted);
  };
  convert();
}, [usdValue, currency]);
```

### Decisions needed
1. Currency selector location: Settings page or navbar dropdown?
2. Exchange rate updates: Keep 1-hour cache or update more frequently?
3. Error handling: Show warnings on API failure or silent fallback to USD?
4. Performance: Prefetch exchange rates on app load?

### Estimated time
~10-13 hours total

Full plan saved to: `docs/currency-preference-implementation-plan.md`

Please review and approve. Questions:
1. Where should the currency selector be placed? (Settings page recommended)
2. Any specific currencies to prioritize? (NGN is already supported)
3. Any performance concerns? (Current caching should be sufficient)

Ready to proceed once approved.




======================================================
Reviewing the current implementation status against the Moralis integration plan:


[7 tools called]


Checking transaction history and other features:


[4 tools called]


## Moralis integration status

### Phase 1: Fix current issues — completed

#### 1.1 Token balance endpoint fixed
- Status: Done
- Changes:
  - Updated to use `/wallets/{address}/tokens` endpoint
  - Added chain name mapping (hex → name)
  - Fixed 404 error for Polygon (chain 137)
  - Reduced API calls by 50% (1 call instead of 2)
- Files:
  - `lib/backend/providers/moralis-rest-client.ts` - Has `getWalletTokensWithPrices()`
  - `lib/backend/providers/moralis.ts` - Uses new endpoint in `getEVMWalletTokens()`

#### 1.2 Chain parameter format
- Status: Done
- Changes:
  - Added `CHAIN_NAME_MAP` for `/wallets/` endpoints
  - Chain names (eth, polygon, bsc) used correctly

---

### Phase 2: Core wallet features — completed

#### 2.1 Total wallet balance
- Status: Done
- Implementation:
  - `getWalletNetWorth()` in `moralis-rest-client.ts`
  - Used in `wallet-balance-service.ts`
  - Returns `total_networth_usd` across chains
- Files:
  - `lib/backend/providers/moralis-rest-client.ts` (line 394)
  - `lib/backend/services/wallet-balance-service.ts` (uses it)

#### 2.2 Daily percentage change
- Status: Done
- Implementation:
  - `calculateDailyChange()` in `wallet-balance-service.ts`
  - Weighted average from token `priceChange24h`
  - Returns `dailyChange` and `dailyChangeUSD`
- Files:
  - `lib/backend/services/wallet-balance-service.ts` (lines 167-199)
  - `lib/backend/types/wallet.ts` - Types added (lines 65-66)

#### 2.3 Token data enrichment
- Status: Done
- Data extracted from `/wallets/{address}/tokens`:
  - `usdValue` - USD value of balance
  - `priceUSD` - Price per token
  - `priceChange24h` - 24h price change
  - `portfolioPercentage` - Portfolio allocation
  - `verified` - Contract verification status
- Files:
  - `lib/backend/types/wallet.ts` (lines 19-23)
  - `lib/backend/providers/moralis.ts` (extracts these fields)

---

### Phase 3: Enhanced features — not started

#### 3.1 Sparkline charts
- Status: Not implemented
- What's needed:
  - `getTokenPriceHistory()` endpoint
  - Sparkline SVG generator service
  - Frontend component to display sparklines
- Estimated time: 4-6 hours

#### 3.2 Transaction history optimization
- Status: Partially done
- Current state:
  - Uses `getEVMWalletTransactions()` and `getSolanaTransactions()`
  - Not using `/wallets/{address}/history` endpoint yet
  - Basic transaction fetching works
- What's needed:
  - Migrate to `/wallets/{address}/history` for complete history
  - Parse transaction types (swap, transfer, DeFi)
  - Categorize activities
- Estimated time: 3-4 hours

---

### Phase 4: NFT features — not started

#### 4.1 NFT list with metadata
- Status: Not implemented
- What's needed:
  - `getWalletNFTs()` endpoint
  - NFT service class
  - Frontend NFT gallery component
- Estimated time: 6-8 hours

#### 4.2 NFT collection metadata
- Status: Not implemented
- What's needed:
  - `getNFTCollectionMetadata()` endpoint
  - Floor price, total supply, collection info
- Estimated time: 2-3 hours

#### 4.3 NFT activity tracking
- Status: Not implemented
- What's needed:
  - `getNFTTransfers()` endpoint
  - Activity timeline component
- Estimated time: 3-4 hours

---

### Phase 5: Advanced features — not started

#### 5.1 DeFi positions
- Status: Not implemented
- What's needed:
  - `/wallets/{address}/defi/positions` endpoint
  - DeFi service class
  - Frontend DeFi positions component
- Estimated time: 8-12 hours

#### 5.2 Swap transactions
- Status: Not implemented
- What's needed:
  - `/wallets/{address}/swaps` endpoint
  - Swap history component
- Estimated time: 3-4 hours

#### 5.3 AI assistant
- Status: Not started (future)
- What's needed:
  - Wallet analytics service
  - AI insights service
  - Frontend AI chat interface
- Estimated time: 16-24 hours (future)

---

## Summary

### Completed (Phase 1 & 2)
1. Fixed 404 error for Polygon
2. Optimized API calls (50% reduction)
3. Total wallet balance
4. Daily percentage change
5. Token data with prices and 24h change
6. Provider-level caching
7. API key rotation

### Next priorities (Phase 3)
1. Sparkline charts (4-6 hours)
   - Price history endpoint
   - SVG generator
   - Frontend component

2. Transaction history optimization (3-4 hours)
   - Migrate to `/wallets/{address}/history`
   - Better categorization

3. NFT features (11-15 hours total)
   - NFT list
   - Collection metadata
   - Activity tracking

### Future (Phase 4 & 5)
- DeFi positions
- Swap transactions
- AI assistant

---

## Recommendation

Next steps:
1. Sparkline charts (visual enhancement)
2. Transaction history optimization (better data)
3. NFT features (portfolio completeness)

Which should we prioritize?