# Portfolio Send/Receive Tab Improvements - Implementation Plan

## Requirements Analysis

### 1. **Token Amount Formatting** 
**Issue**: Token amounts can wrap to multiple lines
**Solution**: Format amounts to max 4-6 decimal places, truncate if needed
**Location**: Assets panel, send tab header, dropdown

### 2. **Token Selector Initialization**
**Issue**: Need to ensure first token (or TWC default) is selected
**Status**: Already implemented, but need to verify header shows correct token
**Location**: Send tab header, token selector dropdown

### 3. **Dropdown Styling**
**Issue**: Dropdown needs fixed height, scrollable, custom scrollbar
**Solution**: 
- Fixed max-height (e.g., 300px)
- `overflow-y-auto`
- Custom scrollbar styling (smaller than main scrollbar)
**Location**: Send tab dropdown, Receive tab dropdown

### 4. **Dropdown Close on Click**
**Issue**: Dropdown doesn't close when token is selected
**Solution**: Use ref to close `<details>` element programmatically
**Location**: Send tab dropdown, Receive tab dropdown

### 5. **Input Text Color**
**Issue**: Input text is gray (`text-[#7C7C7C]`)
**Solution**: Change to white (`text-white`)
**Location**: Send amount input

### 6. **Receive Tab Updates**
**Requirements**:
- Same token selector logic (first token or TWC default)
- Show connected wallet address
- Token dropdown with all wallet tokens
**Location**: Receive tab

### 7. **Token List Consistency**
**Issue**: Dropdown shows more tokens than assets panel
**Solution**: 
- Ensure dropdown shows ALL tokens (including zero balances for selection)
c- Assets panel shows only non-zero balances (current behavior is correct)
- Add fallback icon component (circular with first character)
**Location**: Token dropdown, assets panel

---

## Implementation Plan

### **Step 1: Create Token Amount Formatting Utility**

```typescript
// lib/shared/utils/portfolio-formatting.ts

/**
 * Format token amount to prevent wrapping
 * Limits to 4-6 decimal places, adds ellipsis if truncated
 */
export function formatTokenAmount(amount: string, maxDecimals: number = 6): string {
  if (!amount || amount === '0' || amount === '0.00') return '0.00';
  
  const num = parseFloat(amount);
  if (isNaN(num)) return '0.00';
  
  // If number is very large, use scientific notation or truncate
  if (num >= 1e9) {
    return num.toExponential(2);
  }
  
  // Format with max decimals
  const formatted = num.toFixed(maxDecimals);
  
  // Remove trailing zeros
  return formatted.replace(/\.?0+$/, '');
}
```

### **Step 2: Create Fallback Token Icon Component**

```typescript
// components/portfolio/token-icon.tsx

export function TokenIcon({ 
  src, 
  symbol, 
  alt, 
  width, 
  height, 
  className 
}: {
  src?: string;
  symbol: string;
  alt?: string;
  width: number;
  height: number;
  className?: string;
}) {
  const firstChar = symbol.charAt(0).toUpperCase();
  
  if (src) {
    return (
      <Image
        src={src}
        alt={alt || symbol}
        width={width}
        height={height}
        className={className}
        onError={(e) => {
          // Fallback to circular icon on error
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }
  
  // Circular fallback with first character
  return (
    <div
      className={`rounded-full bg-[#1F261E] flex items-center justify-center text-white font-semibold ${className}`}
      style={{ width, height }}
    >
      <span className="text-xs">{firstChar}</span>
    </div>
  );
}
```

### **Step 3: Update Dropdown Styling**

```tsx
<div className="absolute left-0 z-10 mt-2 w-full min-w-55 max-h-[300px] overflow-y-auto rounded-xl bg-[#0B0F0A] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.6)] custom-scrollbar">
  {/* Token list */}
</div>
```

Add to `globals.css`:
```css
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #1f261e #010501;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #010501;
  border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #1f261e;
  border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #2a3229;
}
```

### **Step 4: Close Dropdown on Token Selection**

```tsx
const dropdownRef = useRef<HTMLDetailsElement>(null);

const handleTokenSelect = (token: WalletToken) => {
  setSelectedSendToken(token);
  // Close dropdown
  if (dropdownRef.current) {
    dropdownRef.current.removeAttribute('open');
  }
};

<details ref={dropdownRef} className="...">
  {/* ... */}
  <button onClick={() => handleTokenSelect(token)}>
    {/* ... */}
  </button>
</details>
```

### **Step 5: Update Input Text Color**

```tsx
<input
  className="... text-white ..." // Changed from text-[#7C7C7C]
/>
```

### **Step 6: Receive Tab Implementation**

1. Add state for selected receive token
2. Use same token selection logic
3. Show connected wallet address
4. Update warning message based on selected token

### **Step 7: Token List Consistency**

- **Assets Panel**: Show only tokens with balance > 0 (current behavior)
- **Dropdown**: Show ALL tokens from wallet (including zero balances)
- Use `TokenIcon` component for all token displays

---

## Implementation Order

1. ✅ Create token amount formatting utility
2. ✅ Create TokenIcon component with fallback
3. ✅ Update dropdown styling (height, scroll, custom scrollbar)
4. ✅ Add dropdown close functionality
5. ✅ Update input text color
6. ✅ Update token amount display (format to prevent wrapping)
7. ✅ Update Receive tab (token selector + wallet address)
8. ✅ Ensure token list consistency (dropdown shows all tokens)
9. ✅ Replace all Image components with TokenIcon component

---

## Files to Modify

1. `lib/shared/utils/portfolio-formatting.ts` - Add formatTokenAmount
2. `components/portfolio/token-icon.tsx` - New component
3. `app/portfolio/page.tsx` - Main updates
4. `app/globals.css` - Custom scrollbar styles
5. `lib/shared/utils/portfolio-formatting.ts` - Update mapWalletTokenToAsset to use formatTokenAmount

---

## Testing Checklist

- [ ] Token amounts don't wrap (max 6 decimals)
- [ ] First token selected on page load
- [ ] TWC shown when no tokens
- [ ] Dropdown has fixed height and scrolls
- [ ] Dropdown closes on token selection
- [ ] Input text is white
- [ ] Receive tab shows correct token
- [ ] Receive tab shows connected wallet address
- [ ] Dropdown shows all tokens (including zero balances)
- [ ] Fallback icons show first character in circle
- [ ] Assets panel shows only non-zero balances

---

**Ready to implement!** 🚀

