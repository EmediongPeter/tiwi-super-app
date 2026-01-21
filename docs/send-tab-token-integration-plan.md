# Send Tab Token Integration - Analysis & Plan

## Current State Analysis

### What's Currently Happening:
1. **Send Tab Header** (lines 597-639):
   - Shows skeleton when `assets.length === 0` or `tokensLoading === true`
   - Shows first asset data when available
   - Hardcoded values for price change (0.10%)

2. **Token Selector in Form** (lines 668-732):
   - Hardcoded to Ethereum
   - Hardcoded balance: "0.0342ETH"
   - Hardcoded amount: "11.496"
   - Hardcoded USD: "$0"
   - Max button exists but doesn't do anything

3. **Mobile View** (lines 1602-1640):
   - Same hardcoded Ethereum values
   - Same issues as desktop

---

## Questions & Concerns

### 1. **Default Token When No Assets** 🤔

**Question**: What should we show when user has no assets or wallet isn't connected?

**Options:**
- **Option A**: Show a popular default token (ETH, BNB, or TWC) with "0.00" balance
  - ✅ Familiar to users
  - ✅ Shows what they can send
  - ❌ Might be confusing (shows token they don't have)
  
- **Option B**: Show empty state with "Select a token" message
  - ✅ Clear that they need to select
  - ❌ Less helpful, requires extra click
  
- **Option C**: Show first token from a default list (ETH, BNB, TWC) but make it clear it's a placeholder
  - ✅ Shows example
  - ✅ Can still be functional (they can send if they get that token)
  - ⚠️ Need to handle the "0.00" balance gracefully

**My Recommendation**: **Option C** - Show TWC as default with "0.00" balance, but make the token selector functional so they can choose from their assets or search for tokens.

---

### 2. **Token Selection Behavior** 🤔

**Question**: Should users be able to change the token, or should it always be the first token from their wallet?

**Current Behavior**: Hardcoded Ethereum, no way to change

**Options:**
- **Option A**: Always show first token, no selection (simpler)
  - ✅ Simple, no confusion
  - ❌ Less flexible
  
- **Option B**: Show first token by default, but allow selection via dropdown
  - ✅ Flexible
  - ✅ Better UX
  - ⚠️ Need to populate dropdown with user's assets
  
- **Option C**: Show first token, but clicking opens full token selector modal (like swap page)
  - ✅ Most flexible
  - ✅ Consistent with swap page
  - ⚠️ More complex

**My Recommendation**: **Option B** - Show first token by default, dropdown shows all user's assets. If they want to search/add more tokens, we can add that later.

---

### 3. **Data Source & Mapping** 🔍

**Current Data Available:**
- `walletTokens`: Raw `WalletToken[]` from API (has `balance`, `balanceFormatted`, `usdValue`, `priceUSD`, `priceChange24h`)
- `assets`: Formatted `PortfolioAsset[]` (has `amount`, `value`, `icon`, `trend`)

**Question**: Which data source should we use?

**Analysis:**
- `walletTokens` has more detailed data (decimals, chainId, address) - **Better for send functionality**
- `assets` is formatted for display - **Better for UI display**

**My Recommendation**: Use `walletTokens` for the send form (need address, chainId, decimals for actual sending), but use `assets` for the header display (already formatted nicely).

---

### 4. **Balance Display Logic** 💰

**Current Issues:**
- Hardcoded "0.0342ETH" and "11.496"
- No connection to actual wallet balance

**Questions:**
1. Should we show the full balance or allow partial sends?
2. Should "Max" button set the input to full balance?
3. Should we show native token balance separately (for gas)?

**My Recommendation:**
- Show full token balance in the selector
- "Max" button sets input to full balance (minus estimated gas if needed)
- Show balance in format: `{balanceFormatted} {symbol}` (e.g., "0.0342 ETH")
- Show USD value: `{usdValue}` formatted (e.g., "$11.50")

---

### 5. **Price Change Display** 📈

**Current**: Hardcoded "0.10%" with green arrow

**Question**: Should we show actual 24h price change from `priceChange24h`?

**My Recommendation**: 
- If `priceChange24h` exists, show it with proper color (green/red)
- If not available, hide the price change section (don't show "0.00%")
- Format: `+2.15%` or `-1.23%` with appropriate arrow/color

---

### 6. **Loading States** ⏳

**Current**: Shows skeleton when `tokensLoading === true`

**Question**: What should show during loading?

**My Recommendation**:
- **Initial load**: Show skeleton (current behavior is good)
- **After data loads**: If no assets, show default token (TWC) with "0.00" balance
- **If assets exist**: Show first token immediately

---

### 7. **Mobile vs Desktop Consistency** 📱

**Question**: Should mobile and desktop have the same behavior?

**My Recommendation**: Yes, keep them consistent. Same logic, different layout.

---

## Proposed Implementation Plan

### **Phase 1: Create Helper Functions**

```typescript
// In WalletPageDesktop component

// Get first token from wallet (for default selection)
const firstToken = useMemo(() => {
  if (!walletTokens || walletTokens.length === 0) return null;
  // Sort by USD value (highest first), then return first
  return [...walletTokens]
    .sort((a, b) => {
      const aValue = parseFloat(a.usdValue || '0');
      const bValue = parseFloat(b.usdValue || '0');
      return bValue - aValue;
    })[0];
}, [walletTokens]);

// Get default token (ETH) when no assets
const defaultToken: WalletToken = {
  address: '0x0000000000000000000000000000000000000000', // Native ETH
  symbol: 'ETH',
  name: 'Ethereum',
  decimals: 18,
  balance: '0',
  balanceFormatted: '0.00',
  chainId: 1, // Ethereum mainnet
  logoURI: '/assets/icons/tokens/ethereum.svg',
  usdValue: '0',
  priceUSD: '0',
  priceChange24h: undefined,
};

// Selected token for send form
const [selectedSendToken, setSelectedSendToken] = useState<WalletToken | null>(null);

// Update selected token when firstToken changes
useEffect(() => {
  if (firstToken) {
    setSelectedSendToken(firstToken);
  } else {
    setSelectedSendToken(defaultToken);
  }
}, [firstToken]);

// Token to display (selected or default)
const displayToken = selectedSendToken || defaultToken;
```

### **Phase 2: Update Send Tab Header**

```typescript
{/* Asset Header */}
<div className="mb-2 flex items-start justify-between">
  {tokensLoading ? (
    <div className="space-y-2">
      <Skeleton className="h-5 w-24 skeleton-shimmer" />
      <Skeleton className="h-6 w-32 skeleton-shimmer" />
      <Skeleton className="h-4 w-40 skeleton-shimmer" />
    </div>
  ) : displayToken ? (
    <div>
      <span className="flex items-center gap-2">
        <Image 
          src={displayToken.logoURI || getTokenFallbackIcon(displayToken.symbol)} 
          alt={displayToken.symbol} 
          width={20} 
          height={20} 
        />
        <p className="text-sm text-[#FFF]">{displayToken.symbol}</p>
      </span>
      <p className="text-xl text-[#FFF] font-medium">
        {displayToken.balanceFormatted}
      </p>
      <div className="text-xs flex gap-2 items-center">
        <p className="text-[#8A929A]">
          {formatCurrency(displayToken.usdValue)}
        </p>
        {displayToken.priceChange24h && parseFloat(displayToken.priceChange24h) !== 0 && (
          <span className={`${parseFloat(displayToken.priceChange24h) >= 0 ? 'text-[#34C759]' : 'text-[#FF4444]'} flex`}>
            <FaArrowUp
              size={16}
              className="bg-[#1B1B1B] p-1 rounded-full"
            />
            {Math.abs(parseFloat(displayToken.priceChange24h)).toFixed(2)}%
          </span>
        )}
        <p className="text-[#B5B5B5]">Today</p>
      </div>
    </div>
  ) : (
    // Fallback - should never happen, but just in case
    <div className="space-y-2">
      <Skeleton className="h-5 w-24 skeleton-shimmer" />
      <Skeleton className="h-6 w-32 skeleton-shimmer" />
    </div>
  )}
</div>
```

### **Phase 3: Update Token Selector in Form**

```typescript
{/* Token Selector */}
<details className="bg-[#121712] rounded-full group relative w-fit">
  <summary className="flex cursor-pointer list-none items-center gap-3 rounded-full bg-[#121712] px-2 py-3 text-left outline-none">
    <Image
      src={displayToken.logoURI || getTokenFallbackIcon(displayToken.symbol)}
      alt={displayToken.name}
      width={36}
      height={36}
      className="shrink-0"
    />
    <div className="leading-tight">
      <p className="text-sm font-semibold text-[#FFF]">
        {displayToken.symbol}
      </p>
      <p className="text-xs font-medium text-[#7C7C7C]">
        {displayToken.name}
      </p>
    </div>
    <IoChevronDown
      size={16}
      className="ml-2 text-[#B5B5B5] transition-transform group-open:rotate-180"
    />
  </summary>
  
  {/* Dropdown: Show all user's tokens */}
  <div className="absolute left-0 z-10 mt-2 w-full min-w-55 rounded-xl bg-[#0B0F0A] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
    {walletTokens && walletTokens.length > 0 ? (
      walletTokens.map((token) => (
        <button
          key={`${token.chainId}-${token.address}`}
          onClick={() => setSelectedSendToken(token)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#141A16]"
        >
          <Image
            src={token.logoURI || getTokenFallbackIcon(token.symbol)}
            alt={token.symbol}
            width={24}
            height={24}
          />
          <span className="text-sm text-[#E6ECE9]">
            {token.name}
          </span>
        </button>
      ))
    ) : (
      <div className="px-3 py-2 text-xs text-[#8A929A]">
        No tokens available
      </div>
    )}
  </div>
</details>

{/* Balance Display */}
<div>
  <span className="flex items-center gap-1">
    <BsWallet2 size={10} />
    <p className="text-xs text-[#B5B5B5]">
      {displayToken.balanceFormatted} {displayToken.symbol}
    </p>
    <button
      onClick={() => {
        // Set input field to max balance
        // Need to handle input ref
      }}
      className="text-[#B1F128] text-xs py-1 px-2 ml-1 rounded-full bg-[#1F261E] hover:bg-[#2A3528] transition-colors"
    >
      Max
    </button>
  </span>
  <p className="text-right text-[#7C7C7C] font-medium text-xl">
    {/* Amount input value - need state for this */}
  </p>
  <p className="text-right text-[#7C7C7C] font-medium text-xs">
    {formatCurrency(displayToken.usdValue)}
  </p>
</div>
```

### **Phase 4: Handle Max Button & Input State**

```typescript
// State for amount input
const [sendAmount, setSendAmount] = useState<string>('');

// Max button handler
const handleMaxClick = () => {
  if (displayToken) {
    setSendAmount(displayToken.balanceFormatted);
  }
};

// Calculate USD value of send amount
const sendAmountUSD = useMemo(() => {
  if (!sendAmount || !displayToken?.priceUSD) return '0.00';
  const amount = parseFloat(sendAmount);
  const price = parseFloat(displayToken.priceUSD);
  if (isNaN(amount) || isNaN(price)) return '0.00';
  return (amount * price).toFixed(2);
}, [sendAmount, displayToken]);
```

---

## Concerns & Edge Cases

### 1. **No Assets Scenario**
- ✅ Show default ETH with "0.00" balance
- ✅ Token selector shows "No tokens available"
- ✅ User can still see the UI structure

### 2. **Loading State**
- ✅ Show skeleton during initial load
- ✅ Once loaded, show data (even if "0.00")

### 3. **Token Selection**
- ⚠️ Need to handle when user selects different token
- ⚠️ Need to reset amount input when token changes
- ⚠️ Need to update balance display

### 4. **Amount Input**
- ⚠️ Need to validate amount doesn't exceed balance
- ⚠️ Need to handle decimals properly
- ⚠️ Need to calculate USD value in real-time

### 5. **Multi-Send**
- ⚠️ Should it use the same token selector?
- ⚠️ Or allow different tokens per recipient? (probably same token for now)

---

## Questions for You

1. **Default Token**: When no assets, show TWC with "0.00" or show empty state?

2. **Token Selection**: 
   - Allow selection from dropdown? ✅ (Recommended)
   - Or always use first token? ❌

3. **Max Button**: 
   - Set input to full balance? ✅ (Recommended)
   - Or full balance minus gas? (More complex)

4. **Amount Input**:
   - Should it be controlled (state) or uncontrolled (ref)?
   - Should we validate in real-time?

5. **USD Value Calculation**:
   - Show total balance USD? ✅
   - Or calculated USD for entered amount? (Both?)

6. **Price Change**:
   - Show if available? ✅
   - Hide if not available? ✅

7. **Mobile vs Desktop**:
   - Same behavior? ✅ (Recommended)

---

## Recommended Approach

1. **Use `walletTokens` for send form** (has all needed data)
2. **Show first token by default** (sorted by USD value)
3. **Allow token selection via dropdown** (shows all user's tokens)
4. **Show default ETH when no assets** (with "0.00" balance)
5. **Max button sets input to full balance**
6. **Real-time USD calculation** for entered amount
7. **Show price change only if available**

---

## Next Steps

1. **Review this plan** - Address concerns/questions
2. **Clarify edge cases** - Confirm behavior for each scenario
3. **Implement step by step** - Start with helper functions, then UI updates
4. **Test thoroughly** - With assets, without assets, loading states

---

## Implementation Order

1. ✅ Create helper functions (firstToken, defaultToken, displayToken)
2. ✅ Update Send Tab Header (use displayToken)
3. ✅ Update Token Selector (use displayToken, populate dropdown)
4. ✅ Add amount input state & handlers
5. ✅ Implement Max button
6. ✅ Add USD value calculation
7. ✅ Update Mobile view (same logic)
8. ✅ Test all scenarios

---

**Ready to proceed once you review and answer the questions!** 🚀

