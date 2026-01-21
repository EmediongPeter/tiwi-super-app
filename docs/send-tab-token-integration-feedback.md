# Send Tab Token Integration - Feedback & Recommendations

## 1. Default Token (TWC) Implementation ✅

### Your Request:
- Show TWC as default when no assets
- Use prefetched TWC data (like status bar)
- Logo: `/assets/logos/twc-token.svg` or API URL

### Implementation Approach:

**Option A: Use `useTWCPrice` Hook (Recommended)**
```typescript
import { useTWCPrice } from '@/hooks/useTWCPrice';

// In component
const { data: twcData, isLoading: isLoadingTWC } = useTWCPrice();

// Create default TWC token
const defaultToken: WalletToken = useMemo(() => {
  if (twcData?.token) {
    // Use prefetched TWC token data
    return {
      address: twcData.token.address,
      symbol: twcData.token.symbol,
      name: twcData.token.name,
      decimals: twcData.token.decimals || 9,
      balance: '0',
      balanceFormatted: '0.00',
      chainId: twcData.token.chainId,
      logoURI: twcData.token.logo || '/assets/logos/twc-token.svg',
      usdValue: '0',
      priceUSD: twcData.token.price || '0',
      priceChange24h: twcData.priceChange24h?.toString(),
    };
  }
  
  // Fallback if TWC not loaded yet
  return {
    address: '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596',
    symbol: 'TWC',
    name: 'TIWI CAT',
    decimals: 9,
    balance: '0',
    balanceFormatted: '0.00',
    chainId: 56,
    logoURI: '/assets/logos/twc-token.svg',
    usdValue: '0',
    priceUSD: '0',
    priceChange24h: undefined,
  };
}, [twcData]);
```

**Pros:**
- ✅ Uses already prefetched data (no extra API call)
- ✅ Has real price data from API
- ✅ Consistent with status bar implementation
- ✅ Falls back gracefully if not loaded

**Cons:**
- ⚠️ Need to handle loading state for TWC

---

## 2. Token Selection: Assets Panel Click vs Dropdown

### Your Question:
Which is better - clicking token from assets panel OR dropdown?

### Analysis:

#### **Option A: Click from Assets Panel** (Your Preference) ✅

**How it works:**
- User clicks on a token in the left assets panel
- Send tab automatically updates to show that token
- No dropdown needed in send form

**Pros:**
- ✅ **Less redundant** - tokens already visible in assets panel
- ✅ **Better UX flow** - natural interaction: "I see my tokens, I click one to send"
- ✅ **Cleaner UI** - no duplicate token list in send form
- ✅ **More space** - send form can focus on amount/recipient
- ✅ **Consistent** - same pattern as clicking NFT to view details
- ✅ **Mobile-friendly** - easier to tap on asset list than small dropdown

**Cons:**
- ⚠️ **Requires context switching** - user must look at left panel, then right panel
- ⚠️ **Less discoverable** - user might not realize they can click assets
- ⚠️ **Desktop only** - on mobile, assets panel might be hidden/collapsed

**Implementation:**
```typescript
// Add click handler to asset list items
const handleAssetClick = (asset: PortfolioAsset) => {
  // Find corresponding WalletToken
  const token = walletTokens?.find(
    t => t.symbol === asset.symbol && 
         parseFloat(t.usdValue || '0') > 0
  );
  if (token) {
    setSelectedSendToken(token);
    // Switch to send tab if not already there
    if (activeTab !== 'send') {
      setActiveTab('send');
    }
  }
};

// In assets list:
<li
  key={i}
  onClick={() => handleAssetClick(asset)}
  className="grid ... cursor-pointer hover:bg-[#141A16] transition-colors"
>
  {/* Asset content */}
</li>
```

---

#### **Option B: Dropdown in Send Form**

**How it works:**
- Token selector dropdown in send form
- Shows all user's tokens
- User selects from dropdown

**Pros:**
- ✅ **Self-contained** - everything in send form
- ✅ **More discoverable** - obvious dropdown button
- ✅ **Works on mobile** - dropdown is always accessible
- ✅ **Familiar pattern** - common in DEXes

**Cons:**
- ❌ **Redundant** - tokens already shown in assets panel
- ❌ **Takes space** - dropdown takes up UI space
- ❌ **Less intuitive** - user sees tokens in panel but must use dropdown

---

### **My Recommendation: Hybrid Approach** 🎯

**Best of both worlds:**

1. **Desktop**: Click from assets panel (primary method)
   - Make assets clickable with visual feedback
   - Add subtle hover effect: "Click to send"
   - Remove dropdown from send form (or make it minimal)

2. **Mobile**: Keep dropdown in send form
   - On mobile, assets panel might be hidden/collapsed
   - Dropdown ensures token selection is always accessible
   - Can still support clicking from assets if panel is visible

3. **Visual Indicators:**
   - Show selected token with highlight in assets panel
   - Add "Selected for sending" badge on active token
   - Smooth transition when switching tokens

**Implementation:**
```typescript
// Desktop: Click from assets panel
const handleAssetClick = (asset: PortfolioAsset) => {
  const token = findTokenFromAsset(asset);
  if (token) {
    setSelectedSendToken(token);
    setActiveTab('send');
  }
};

// Mobile: Keep dropdown as fallback
// But also support clicking if assets panel is visible
```

---

## 3. Additional Considerations

### **Visual Feedback for Selected Token:**

```typescript
// In assets list, highlight selected token
<li
  key={i}
  onClick={() => handleAssetClick(asset)}
  className={cn(
    "grid ... cursor-pointer transition-all",
    selectedSendToken?.symbol === asset.symbol
      ? "bg-[#1F261E] border border-[#B1F128]/30"
      : "hover:bg-[#141A16]"
  )}
>
  {/* Show checkmark or badge if selected */}
  {selectedSendToken?.symbol === asset.symbol && (
    <div className="absolute top-2 right-2">
      <IoCheckmarkCircle className="text-[#B1F128]" size={16} />
    </div>
  )}
</li>
```

### **State Management:**

```typescript
// Track selected token
const [selectedSendToken, setSelectedSendToken] = useState<WalletToken | null>(null);

// Update when firstToken changes (initial load)
useEffect(() => {
  if (firstToken) {
    setSelectedSendToken(firstToken);
  } else if (!selectedSendToken) {
    // Only set default if no selection made yet
    setSelectedSendToken(defaultToken);
  }
}, [firstToken]);

// Reset amount when token changes
useEffect(() => {
  setSendAmount('');
}, [selectedSendToken]);
```

### **Mobile Considerations:**

- On mobile, if assets panel is collapsed/hidden, dropdown is essential
- Consider making assets panel swipeable or always visible on mobile
- Add "Select Token" button that opens assets panel if hidden

---

## 4. Final Recommendations

### **Default Token:**
✅ Use `useTWCPrice` hook to get prefetched TWC data
✅ Fallback to hardcoded TWC if not loaded
✅ Use `/assets/logos/twc-token.svg` as logo fallback

### **Token Selection:**
✅ **Desktop**: Primary method = Click from assets panel
✅ **Mobile**: Keep dropdown as fallback/alternative
✅ Add visual feedback (highlight selected token)
✅ Smooth transitions when switching

### **Implementation Priority:**
1. ✅ Get TWC default token working
2. ✅ Make assets clickable (desktop)
3. ✅ Add visual feedback for selected token
4. ✅ Keep dropdown for mobile/fallback
5. ✅ Test both desktop and mobile flows

---

## 5. Questions for You

1. **Mobile Assets Panel**: Is the assets panel always visible on mobile, or can it be hidden/collapsed?
   - If hidden: Keep dropdown
   - If always visible: Can use click method too

2. **Visual Feedback**: How prominent should the "selected token" highlight be?
   - Subtle border? ✅
   - Background color change? ✅
   - Badge/checkmark? ✅

3. **Dropdown Behavior**: Should we remove dropdown entirely on desktop, or keep it as alternative?
   - Remove: Cleaner UI ✅
   - Keep: More options (but redundant)

4. **Click Behavior**: When user clicks asset, should it:
   - Switch to send tab automatically? ✅ (Recommended)
   - Or just update token (stay on current tab)?

---

**Ready to implement once you confirm these details!** 🚀

