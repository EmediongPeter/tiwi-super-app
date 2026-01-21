# Phase 3: Portfolio Page Integration - Detailed Plan

## 🎯 Objective
Replace all mock data in the portfolio page (`app/portfolio/page.tsx`) with real data from Moralis APIs, ensuring a seamless user experience with proper loading states, error handling, and data formatting.

---

## 📊 Current State Analysis

### Mock Data to Replace

#### 1. **Total Balance** (Line 35)
```typescript
const balance = "4,631.21"; // Hardcoded
```
**Location:** Left panel, top section (Line 194-195)
**Display:** `$${balance}`

#### 2. **Daily Change** (Line 197-199)
```typescript
<p className="mt-1 text-sm text-[#3FEA9B]">
  +$61.69 (+2.15%) <span className="text-[#9DA4AE]">today</span>
</p>
```
**Format:** `+$X.XX (+X.XX%) today`
**Color:** Green (`#3FEA9B`) for positive, should be red for negative

#### 3. **Assets Array** (Lines 36-77)
```typescript
const assets = [
  {
    name: "Bitcoin",
    symbol: "BTC",
    amount: "0.01912343",
    value: "$10,234.23",
    icon: bitcoin,
    trend: "bearish", // or "bullish"
  },
  // ... more assets
];
```
**Location:** Left panel, "Assets" tab
**Fields Needed:**
- `name` - Token name
- `symbol` - Token symbol
- `amount` - Human-readable balance
- `value` - USD value (formatted)
- `icon` - Token logo/icon
- `trend` - "bullish" or "bearish" (based on 24h change)

#### 4. **NFTs Array** (Lines 78-85)
```typescript
const nfts = [
  { id: 1, name: "Cartoon-bird", floor: "6.10 ETH", image: "/nft1.svg" },
  // ... more NFTs
];
```
**Location:** Left panel, "NFTs" tab
**Fields Needed:**
- `id` - Unique NFT ID
- `name` - NFT name
- `floor` - Floor price (native token or USD)
- `image` - NFT image URL

**Note:** NFTs will be implemented in Phase 4, but we'll prepare the structure.

#### 5. **Transactions Array** (Lines 86-149)
```typescript
const transactions = [
  { type: "sent", date: "Jan 4, 2024", amount: "0.017 ETH", usd: "$725.00" },
  // ... more transactions
];
```
**Location:** Right panel, "Activities" tab
**Fields Needed:**
- `type` - "sent", "received", "swap", etc.
- `date` - Formatted date string
- `amount` - Token amount with symbol
- `usd` - USD value

**Note:** This is already using `useWalletTransactions` hook, but may need formatting adjustments.

---

## 🏗️ Implementation Structure

### Step 1: Create Portfolio Balance Hook
**File:** `hooks/usePortfolioBalance.ts` (NEW)

**Purpose:** Fetch total balance and daily change for portfolio page

**API Endpoint:** `/api/v1/wallet/balances?address={address}`

**Returns:**
```typescript
{
  totalUSD: string;           // "4631.21"
  dailyChange?: number;        // 2.15 (percentage)
  dailyChangeUSD?: string;    // "61.69"
  isLoading: boolean;
  error: Error | null;
}
```

**Implementation:**
- Use existing `useWalletBalances` hook
- Extract `totalUSD`, `dailyChange`, `dailyChangeUSD` from response
- Format values for display

---

### Step 2: Map Wallet Tokens to Portfolio Assets
**File:** `app/portfolio/page.tsx` (UPDATE)

**Function:** `mapWalletTokensToAssets(walletTokens: WalletToken[])`

**Transformation:**
```typescript
WalletToken → Portfolio Asset
{
  address → (not needed in UI)
  symbol → symbol
  name → name
  balanceFormatted → amount
  usdValue → value (format as "$X,XXX.XX")
  logoURI → icon (with fallback)
  priceChange24h → trend ("bullish" if > 0, "bearish" if < 0)
}
```

**Considerations:**
- Filter out zero balances (or show them with "0.00" if user wants to see all)
- Sort by USD value (highest first)
- Handle missing logos (use fallback icon or first letter)
- Format USD values with commas and 2 decimals

---

### Step 3: Format Daily Change Display
**File:** `app/portfolio/page.tsx` (UPDATE)

**Function:** `formatDailyChange(dailyChange?: number, dailyChangeUSD?: string)`

**Logic:**
```typescript
if (dailyChange === undefined || dailyChangeUSD === undefined) {
  return null; // Don't show change
}

const isPositive = dailyChange >= 0;
const sign = isPositive ? '+' : '';
const color = isPositive ? '#3FEA9B' : '#FF4444'; // Green or red

return {
  text: `${sign}$${dailyChangeUSD} (${sign}${dailyChange.toFixed(2)}%)`,
  color,
};
```

**Display:**
```tsx
{dailyChangeData && (
  <p className="mt-1 text-sm" style={{ color: dailyChangeData.color }}>
    {dailyChangeData.text} <span className="text-[#9DA4AE]">today</span>
  </p>
)}
```

---

### Step 4: Integrate Real Balance Data
**File:** `app/portfolio/page.tsx` (UPDATE)

**Changes:**
1. Import `usePortfolioBalance` hook
2. Get wallet address from wallet connection
3. Replace `const balance = "4,631.21"` with real data
4. Add loading state (skeleton loader)
5. Add error handling

**Code:**
```typescript
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { usePortfolioBalance } from '@/hooks/usePortfolioBalance';

function WalletPageDesktop() {
  const { connectedAddress } = useWalletConnection();
  const { totalUSD, dailyChange, dailyChangeUSD, isLoading, error } = 
    usePortfolioBalance(connectedAddress);

  // Format balance with commas
  const formattedBalance = totalUSD 
    ? parseFloat(totalUSD).toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })
    : '0.00';

  // ... rest of component
}
```

---

### Step 5: Integrate Real Assets Data
**File:** `app/portfolio/page.tsx` (UPDATE)

**Changes:**
1. Import `useWalletBalances` hook
2. Map `WalletToken[]` to portfolio asset format
3. Replace `const assets = [...]` with mapped data
4. Add loading state
5. Handle empty state (no tokens)

**Code:**
```typescript
import { useWalletBalances } from '@/hooks/useWalletBalances';

function WalletPageDesktop() {
  const { connectedAddress } = useWalletConnection();
  const { balances, isLoading: balancesLoading } = useWalletBalances(connectedAddress);

  // Map wallet tokens to portfolio assets
  const assets = useMemo(() => {
    if (!balances || balances.length === 0) return [];
    
    return balances
      .filter(token => {
        // Filter zero balances (optional - can show all)
        const usdValue = parseFloat(token.usdValue || '0');
        return usdValue > 0;
      })
      .map(token => ({
        name: token.name,
        symbol: token.symbol,
        amount: token.balanceFormatted,
        value: formatCurrency(token.usdValue || '0'),
        icon: token.logoURI || getTokenFallbackIcon(token.symbol),
        trend: getTrendFromPriceChange(token.priceChange24h),
      }))
      .sort((a, b) => {
        // Sort by USD value (highest first)
        const aValue = parseFloat(a.value.replace(/[^0-9.]/g, ''));
        const bValue = parseFloat(b.value.replace(/[^0-9.]/g, ''));
        return bValue - aValue;
      });
  }, [balances]);
}
```

**Helper Functions:**
```typescript
function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function getTrendFromPriceChange(priceChange24h?: string): 'bullish' | 'bearish' {
  if (!priceChange24h) return 'bearish';
  const change = parseFloat(priceChange24h);
  return change >= 0 ? 'bullish' : 'bearish';
}

function getTokenFallbackIcon(symbol: string): string {
  // Return fallback icon path or generate from symbol
  return `/assets/icons/tokens/${symbol.toLowerCase()}.svg`;
}
```

---

### Step 6: Integrate Real Transactions (Already Working)
**File:** `app/portfolio/page.tsx` (UPDATE - if needed)

**Status:** Already using `useWalletTransactions` hook in wallet balance panel

**Action:** 
- Check if portfolio page needs separate transaction fetching
- If yes, integrate `useWalletTransactions` hook
- Format transactions to match portfolio display format

**Transaction Format Mapping:**
```typescript
Transaction → Portfolio Transaction
{
  type → type (map TransactionType to "sent"/"received"/"swap")
  date → date (format timestamp to "Jan 4, 2024")
  amount → amount (format as "0.017 ETH")
  usd → usd (format as "$725.00")
}
```

---

### Step 7: Add Loading States
**File:** `app/portfolio/page.tsx` (UPDATE)

**Components Needed:**
- Balance skeleton loader
- Asset list skeleton loader
- Transaction list skeleton loader

**Implementation:**
```typescript
// Balance loading
{isLoading ? (
  <BalanceSkeleton />
) : (
  <h1 className="mt-1 text-3xl font-bold text-[#E6ECE9]">
    ${formattedBalance}
  </h1>
)}

// Assets loading
{balancesLoading ? (
  <AssetListSkeleton count={5} />
) : assets.length === 0 ? (
  <EmptyState message="No assets found" />
) : (
  <AssetList assets={assets} />
)}
```

---

### Step 8: Add Error Handling
**File:** `app/portfolio/page.tsx` (UPDATE)

**Error States:**
- Wallet not connected → Show "Connect wallet" message
- API error → Show error message with retry button
- No data → Show empty state

**Implementation:**
```typescript
if (!connectedAddress) {
  return <ConnectWalletPrompt />;
}

if (error) {
  return <ErrorState error={error} onRetry={() => refetch()} />;
}

if (!isLoading && assets.length === 0) {
  return <EmptyState message="No assets found in your wallet" />;
}
```

---

## 📁 Files to Create/Modify

### New Files
1. `hooks/usePortfolioBalance.ts` - Hook for portfolio balance and daily change
2. `components/portfolio/balance-skeleton.tsx` - Skeleton loader for balance
3. `components/portfolio/asset-list-skeleton.tsx` - Skeleton loader for asset list
4. `components/portfolio/empty-state.tsx` - Empty state component
5. `components/portfolio/error-state.tsx` - Error state component

### Modified Files
1. `app/portfolio/page.tsx` - Replace all mock data with real API calls
2. `lib/shared/utils/formatting.ts` - Add currency and date formatting utilities (if not exists)

---

## 🔄 Data Flow

```
Portfolio Page Component
  ↓
useWalletConnection() → Get wallet address
  ↓
usePortfolioBalance(address) → Get total balance + daily change
useWalletBalances(address) → Get token list
useWalletTransactions(address) → Get transaction list (if needed)
  ↓
Transform Data:
  - WalletToken[] → PortfolioAsset[]
  - Transaction[] → PortfolioTransaction[]
  - Format currencies, dates, percentages
  ↓
Display in UI:
  - Balance with daily change
  - Asset list with icons and trends
  - Transaction list (if integrated)
```

---

## ✅ Success Criteria

### Functional Requirements
- [ ] Total balance displays real USD value from API
- [ ] Daily change calculates and displays correctly (green/red)
- [ ] Asset list shows real tokens from wallet
- [ ] Assets sorted by USD value (highest first)
- [ ] Token icons display correctly (with fallback)
- [ ] Trend indicators work (bullish/bearish based on 24h change)
- [ ] Loading states show during API calls
- [ ] Error states handle failures gracefully
- [ ] Empty states show when no data

### Technical Requirements
- [ ] No mock data in portfolio page
- [ ] Proper TypeScript types throughout
- [ ] Performance optimized (useMemo, useCallback where needed)
- [ ] Responsive design maintained
- [ ] Accessibility (ARIA labels, keyboard navigation)

### User Experience
- [ ] Smooth loading transitions
- [ ] Clear error messages
- [ ] Intuitive empty states
- [ ] Fast response times (< 1 second for cached data)

---

## 🚨 Edge Cases to Handle

1. **Wallet Not Connected**
   - Show connect wallet prompt
   - Disable portfolio features

2. **Zero Balance**
   - Show "0.00" instead of hiding
   - Show empty asset list with helpful message

3. **No Tokens**
   - Show empty state: "No tokens found in your wallet"
   - Provide action: "Start by swapping tokens"

4. **API Errors**
   - Show user-friendly error message
   - Provide retry button
   - Log error for debugging

5. **Missing Token Data**
   - Handle missing logos (fallback to first letter)
   - Handle missing prices (show "N/A" or "0.00")
   - Handle missing 24h change (default to "bearish")

6. **Very Large Numbers**
   - Format with commas: "1,234,567.89"
   - Handle scientific notation if needed

7. **Very Small Numbers**
   - Show at least 2 decimals: "0.00"
   - For crypto amounts, show more decimals if needed

---

## 📝 Implementation Checklist

### Phase 3.1: Balance & Daily Change
- [ ] Create `usePortfolioBalance` hook
- [ ] Update portfolio page to use hook
- [ ] Format balance with commas
- [ ] Format daily change with color
- [ ] Add loading skeleton
- [ ] Add error handling

### Phase 3.2: Assets List
- [ ] Map `WalletToken[]` to portfolio asset format
- [ ] Filter zero balances (optional)
- [ ] Sort by USD value
- [ ] Format currency values
- [ ] Handle token icons (with fallback)
- [ ] Calculate trends from 24h change
- [ ] Add loading skeleton
- [ ] Add empty state

### Phase 3.3: Transactions (If Needed)
- [ ] Check if portfolio needs separate transaction fetching
- [ ] Format transactions for portfolio display
- [ ] Add loading skeleton
- [ ] Add empty state

### Phase 3.4: Polish & Testing
- [ ] Test with real wallet data
- [ ] Test loading states
- [ ] Test error states
- [ ] Test empty states
- [ ] Test with different wallet addresses
- [ ] Test with wallets with many tokens
- [ ] Test with wallets with no tokens
- [ ] Performance testing
- [ ] Responsive design testing

---

## 🎨 UI/UX Considerations

### Loading States
- Use skeleton loaders that match actual content layout
- Show shimmer animation
- Don't show loading for more than 3 seconds (consider timeout)

### Error States
- Show friendly error message
- Provide retry action
- Don't block entire page (show error in specific section)

### Empty States
- Provide helpful message
- Suggest actions (e.g., "Start by swapping tokens")
- Use appropriate iconography

### Data Formatting
- Currency: `$1,234.56` (commas, 2 decimals)
- Percentages: `+2.15%` or `-2.15%` (sign, 2 decimals)
- Dates: `Jan 4, 2024` (short format)
- Token amounts: Show appropriate decimals based on token

---

## 🔗 Dependencies

### Existing Hooks (Already Available)
- ✅ `useWalletBalances` - Fetches wallet token balances
- ✅ `useWalletTransactions` - Fetches transaction history
- ✅ `useWalletConnection` - Gets connected wallet address

### New Hooks to Create
- ⏳ `usePortfolioBalance` - Wrapper around `useWalletBalances` for portfolio-specific data

### API Endpoints (Already Available)
- ✅ `/api/v1/wallet/balances` - Returns `WalletBalanceResponse` with `totalUSD`, `dailyChange`, `dailyChangeUSD`

---

## 📊 Expected Data Structure

### Input (from API)
```typescript
WalletBalanceResponse {
  address: string;
  balances: WalletToken[]; // Array of tokens
  totalUSD: string; // "4631.21"
  dailyChange?: number; // 2.15
  dailyChangeUSD?: string; // "61.69"
  chains: number[];
  timestamp: number;
}
```

### Output (for UI)
```typescript
PortfolioBalance {
  totalUSD: string; // "4,631.21" (formatted)
  dailyChange: {
    value: number; // 2.15
    usd: string; // "61.69"
    formatted: string; // "+$61.69 (+2.15%)"
    color: string; // "#3FEA9B" or "#FF4444"
  } | null;
}

PortfolioAsset {
  name: string;
  symbol: string;
  amount: string; // "0.01912343"
  value: string; // "$10,234.23"
  icon: string; // URL or fallback path
  trend: "bullish" | "bearish";
}
```

---

## ⏱️ Estimated Time

- **Phase 3.1 (Balance & Daily Change):** 1-2 hours
- **Phase 3.2 (Assets List):** 2-3 hours
- **Phase 3.3 (Transactions):** 1 hour (if needed)
- **Phase 3.4 (Polish & Testing):** 1-2 hours

**Total:** 5-8 hours

---

## 🚀 Next Steps After Phase 3

- **Phase 4:** NFT Features (fetching and display)
- **Phase 5:** Sparkline Charts (price history visualization)
- **Phase 6:** AI Copilot (future)

---

## 💡 Notes

1. **NFTs are deferred to Phase 4** - We'll keep the NFT tab structure but populate it later
2. **Transactions may already be working** - Check if portfolio page needs separate fetching
3. **Performance** - Use `useMemo` for expensive transformations
4. **Caching** - TanStack Query handles caching automatically (30s for balances)
5. **Error Recovery** - Implement retry logic for failed API calls

