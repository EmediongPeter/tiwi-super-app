# TradingView Chart Swap Page Integration Plan

**Status:** 📋 **PLAN - READY FOR IMPLEMENTATION**

**Goal:** Replace placeholder TradingChart component with real TradingView chart, maintaining exact design fidelity and responsive behavior.

---

## Analysis

### Current Implementation

1. **TradingChart Component** (`components/swap/trading-chart.tsx`)
   - Placeholder with static image
   - Header shows: pair name and price data (OHLC format)
   - Chart area: `h-[320px] lg:h-[460px] xl:h-[450px] 2xl:h-[500px]`
   - Styling: `bg-[#010501]`, `border-[#1f261e]`, `rounded-xl lg:rounded-2xl`
   - Header: `p-3 sm:p-3.5 md:p-4`, `border-b border-[#1f261e]`
   - Chart area: `bg-[#0b0f0a]`

2. **Swap Page Structure**
   - Desktop: Chart left, Swap card right (flex layout)
   - Mobile: Chart top, Swap card bottom
   - Uses `fromToken` and `toToken` from Zustand store
   - Default tokens: TWC (from) and USDT (to) on BSC

3. **Design Requirements (1720px base)**
   - Chart container: Full width on left side
   - Header: Pair name + OHLC price data
   - Chart: TradingView widget with dark theme
   - Responsive: Scales down for smaller screens

---

## Implementation Plan

### Step 1: Update TradingChart Component

**File:** `components/swap/trading-chart.tsx`

**Changes:**
1. Replace placeholder with `TradingViewChart` component
2. Accept `fromToken` and `toToken` props from swap page
3. Display pair info in header (e.g., "TWC/BNB" or "TWC/USDT")
4. Show OHLC price data in header (if available from chart data)
5. Maintain exact styling and responsive heights
6. Handle loading states with skeleton

**Props Interface:**
```typescript
interface TradingChartProps {
  fromToken?: Token | null;
  toToken?: Token | null;
  className?: string;
}
```

**Header Content:**
- Pair name: `{fromToken.symbol}/{toToken.symbol}`
- Price data: Format as "O{open} H{high} L{low} C{close} {change} ({changePercent}%)"
- Use token prices from store or fetch from chart data

**Chart Integration:**
- Use `TradingViewChart` component
- Pass: `baseToken`, `quoteToken`, `chainId`
- Height: Match current responsive heights
- Theme: Dark (`theme="dark"`)
- Default interval: `"1"` (1 minute)

### Step 2: Update Swap Page

**File:** `app/swap/page.tsx`

**Changes:**
1. Pass `fromToken` and `toToken` to `TradingChart` component
2. No other changes needed (component handles everything)

**Usage:**
```tsx
<TradingChart 
  fromToken={fromToken}
  toToken={toToken}
/>
```

### Step 3: Price Data Display

**Options:**
1. **Option A (Recommended)**: Use token prices from store
   - `fromToken.price` and `toToken.price`
   - Calculate pair price: `fromToken.price / toToken.price` (if both in USD)
   - Show 24h change from `fromToken.priceChange24h`

2. **Option B**: Fetch from chart data
   - Get latest bar from TradingView chart
   - Extract OHLC values
   - More accurate but requires chart to load first

**Decision:** Use Option A initially (token prices from store), can enhance with Option B later.

### Step 4: Styling Preservation

**Critical Styling Elements:**
- Container: `bg-[#010501] border border-[#1f261e] rounded-xl lg:rounded-2xl`
- Header: `p-3 sm:p-3.5 md:p-4 border-b border-[#1f261e]`
- Chart area: `bg-[#0b0f0a]`
- Heights: `h-[320px] lg:h-[460px] xl:h-[450px] 2xl:h-[500px]`
- Text colors: `text-white`, `text-[#b5b5b5]`
- Responsive breakpoints: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`

**TradingView Theme Overrides:**
- Background: `#010501` (match container)
- Candle colors: Green `#3fea9b`, Red `#ff5c5c` (already set)
- Grid lines: Match `#1f261e`
- Text: Match existing colors

### Step 5: Loading States

**Implementation:**
1. Show skeleton while TradingView widget initializes
2. Show skeleton while chart data loads
3. Hide skeleton when chart is ready
4. Handle errors gracefully (show error message or fallback)

**Loading Flow:**
```
Initial → Skeleton → TradingView Loading → Chart Ready
```

---

## Detailed Component Structure

### TradingChart Component

```tsx
"use client";

import { useState, useEffect } from "react";
import { TradingViewChart } from "@/components/charts/tradingview-chart";
import Skeleton from "@/components/ui/skeleton";
import type { Token } from "@/lib/frontend/types/tokens";

interface TradingChartProps {
  fromToken?: Token | null;
  toToken?: Token | null;
  className?: string;
}

export default function TradingChart({
  fromToken,
  toToken,
  className = "",
}: TradingChartProps) {
  const [isChartReady, setIsChartReady] = useState(false);
  const [chartError, setChartError] = useState<Error | null>(null);

  // Determine if we have valid tokens for chart
  const hasValidTokens = fromToken && toToken && 
    fromToken.address && toToken.address && 
    fromToken.chainId && toToken.chainId;

  // Format pair name
  const pairName = hasValidTokens 
    ? `${fromToken.symbol}/${toToken.symbol}`
    : "Select Tokens";

  // Format price data (OHLC format)
  // TODO: Get from chart data or token prices
  const priceData = "O0.095 H0.098 L0.092 C0.096 +0.001 (+1.05%)";

  // Handle chart ready
  const handleChartReady = () => {
    setIsChartReady(true);
  };

  // Handle chart error
  const handleChartError = (error: Error) => {
    console.error("[TradingChart] Chart error:", error);
    setChartError(error);
    setIsChartReady(true); // Show error state instead of loading
  };

  return (
    <div className={`bg-[#010501] border border-[#1f261e] rounded-xl lg:rounded-2xl overflow-hidden backdrop-blur-sm ${className}`}>
      {/* Header */}
      <div className="p-3 sm:p-3.5 md:p-4 border-b border-[#1f261e]">
        <div className="flex items-center justify-between">
          <div>
            {!isChartReady ? (
              <>
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </>
            ) : (
              <>
                <h3 className="text-white font-semibold text-sm sm:text-base">
                  {pairName}
                </h3>
                <p className="text-[#b5b5b5] text-xs sm:text-sm mt-0.5 sm:mt-1">
                  {priceData}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="h-[320px] lg:h-[460px] xl:h-[450px] 2xl:h-[500px] bg-[#0b0f0a] relative overflow-hidden">
        {!isChartReady ? (
          <Skeleton className="w-full h-full rounded-none" />
        ) : chartError ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#b5b5b5] text-sm">
              Chart unavailable. Please try again.
            </p>
          </div>
        ) : hasValidTokens ? (
          <TradingViewChart
            baseToken={fromToken.address}
            quoteToken={toToken.address}
            chainId={fromToken.chainId}
            height="100%"
            theme="dark"
            interval="1"
            onError={handleChartError}
            className="w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#b5b5b5] text-sm">
              Please select tokens to view chart
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Swap Page Update

```tsx
// In app/swap/page.tsx, update TradingChart usage:

<TradingChart 
  fromToken={fromToken}
  toToken={toToken}
/>
```

---

## Testing Checklist

- [ ] Chart displays TWC/BNB pair correctly
- [ ] Chart displays TWC/USDT pair correctly
- [ ] Header shows correct pair name
- [ ] Price data displays in header (if available)
- [ ] Loading skeleton shows while chart loads
- [ ] Chart responsive on mobile (< 1024px)
- [ ] Chart responsive on tablet (1024px - 1280px)
- [ ] Chart responsive on desktop (1280px - 1720px)
- [ ] Chart responsive on large desktop (1720px+)
- [ ] Chart updates when tokens change
- [ ] Error handling works (invalid tokens, API failure)
- [ ] Styling matches design exactly
- [ ] Dark theme colors correct
- [ ] Border radius matches design
- [ ] Spacing matches design

---

## Edge Cases

1. **No tokens selected**: Show placeholder message
2. **Invalid token addresses**: Show error message
3. **Unsupported chain**: Show error message
4. **Chart fails to load**: Show error message with retry option
5. **Token change during chart load**: Cancel previous load, start new
6. **Native tokens**: Auto-convert to wrapped (handled by TradingViewChart)

---

## Performance Considerations

1. **Lazy load TradingView library**: Only load when component mounts
2. **Debounce token changes**: Wait 300ms before updating chart
3. **Cache chart data**: Use React Query or similar for chart data
4. **Optimize re-renders**: Use React.memo if needed

---

## Next Steps

1. ✅ Review and approve plan
2. ⏳ Implement TradingChart component updates
3. ⏳ Update swap page to pass tokens
4. ⏳ Test with TWC/BNB pair
5. ⏳ Test with TWC/USDT pair
6. ⏳ Verify responsive design
7. ⏳ Verify styling matches design
8. ⏳ Add price data display (enhancement)

---

**End of Plan**

