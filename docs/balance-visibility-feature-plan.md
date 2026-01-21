# Balance Visibility Feature - Implementation Plan

## Overview
Implement a global "hide/show balance" feature that allows users to toggle visibility of all financial amounts across the wallet panel and portfolio page.

---

## Requirements

### 1. Eye Icon Size
- **Current**: `size={10}` on portfolio page
- **Target**: Increase to `size={16}` or `size={18}` for better visibility

### 2. Global State Management
- Create a shared state store (Zustand) for balance visibility
- State should be persistent (localStorage) so preference is remembered
- State should be accessible from both:
  - `components/wallet/wallet-balance-panel.tsx`
  - `app/portfolio/page.tsx`

### 3. Elements to Hide When Balance is Hidden

#### Portfolio Page:
- ✅ **Total Balance**: Hide `$13.18` → Show `****`
- ✅ **Daily Change**: Hide `+$0.18 (+1.39%)` → Show `****`
- ✅ **Asset Amounts**: Hide token amounts (e.g., `1.5`, `0.000337`, `2.53B`)
- ✅ **Asset USD Values**: Hide `$1.50`, `$1.03`, `$0.98`
- ✅ **NFT Values**: Hide floor prices, USD values
- ✅ **Send Tab**: Hide token balance, amount, USD value
- ✅ **Receive Tab**: Hide address (optional - user decision)
- ✅ **Activities Tab**: Hide transaction amounts and USD values

#### Wallet Panel:
- ✅ **Total Balance**: Hide `$13.18` → Show `****` (already implemented locally)
- ✅ **Daily Change**: Hide `+$0.00 (0.00%)` → Show `****`
- ✅ **Transaction Amounts**: Hide amounts in transaction history
- ✅ **Reward Claim Card**: Hide claimable rewards amount

---

## Implementation Plan

### Step 1: Create Balance Visibility Store

**File**: `lib/frontend/store/balance-visibility-store.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BalanceVisibilityState {
  isBalanceVisible: boolean;
  toggleBalanceVisibility: () => void;
  setBalanceVisibility: (visible: boolean) => void;
}

export const useBalanceVisibilityStore = create<BalanceVisibilityState>()(
  persist(
    (set) => ({
      isBalanceVisible: true, // Default: visible
      toggleBalanceVisibility: () => set((state) => ({ 
        isBalanceVisible: !state.isBalanceVisible 
      })),
      setBalanceVisibility: (visible: boolean) => set({ 
        isBalanceVisible: visible 
      }),
    }),
    {
      name: 'tiwi-balance-visibility', // localStorage key
    }
  )
);
```

### Step 2: Update Portfolio Page

**File**: `app/portfolio/page.tsx`

1. **Import store**:
   ```typescript
   import { useBalanceVisibilityStore } from "@/lib/frontend/store/balance-visibility-store";
   ```

2. **Increase eye icon size**:
   ```typescript
   // Change from:
   <IoEyeOutline color="B5B5B5" size={10} />
   // To:
   <button onClick={toggleBalanceVisibility} className="cursor-pointer hover:opacity-80">
     <IoEyeOutline color="B5B5B5" size={16} />
   </button>
   ```

3. **Add toggle handler**:
   ```typescript
   const { isBalanceVisible, toggleBalanceVisibility } = useBalanceVisibilityStore();
   ```

4. **Hide balance display**:
   ```typescript
   <h1 className="mt-1 text-3xl font-bold text-[#E6ECE9]">
     {isBalanceVisible ? `$${displayBalance}` : "****"}
   </h1>
   ```

5. **Hide daily change**:
   ```typescript
   {dailyChangeText ? (
     <p className="mt-1 text-sm" style={{ color: dailyChangeColor }}>
       {isBalanceVisible ? dailyChangeText : "****"} <span className="text-[#9DA4AE]">today</span>
     </p>
   ) : null}
   ```

6. **Hide asset amounts and values**:
   ```typescript
   {/* Amount */}
   <p className="text-sm font-semibold text-[#FFFFFF]">
     {isBalanceVisible ? formatTokenAmount(asset.amount, 6) : "****"}
   </p>
   {/* USD Value */}
   <p className="text-xs text-[#8A929A]">
     {isBalanceVisible ? asset.value : "****"}
   </p>
   ```

7. **Hide NFT values** (if applicable)

8. **Hide send tab amounts**:
   ```typescript
   {isBalanceVisible ? formatTokenAmount(displayToken.balanceFormatted, 6) : "****"}
   ```

9. **Hide transaction amounts in activities tab**:
   ```typescript
   {isBalanceVisible ? amountText : "****"}
   {isBalanceVisible && usdValue ? usdValue : ""}
   ```

### Step 3: Update Wallet Balance Panel

**File**: `components/wallet/wallet-balance-panel.tsx`

1. **Import store**:
   ```typescript
   import { useBalanceVisibilityStore } from "@/lib/frontend/store/balance-visibility-store";
   ```

2. **Replace local state with global state**:
   ```typescript
   // Remove: const [showBalance, setShowBalance] = useState(true);
   const { isBalanceVisible, toggleBalanceVisibility } = useBalanceVisibilityStore();
   ```

3. **Update balance display** (already has logic, just use `isBalanceVisible`):
   ```typescript
   {showBalance ? formatCurrency(totalUSD) : "****"}
   // Change to:
   {isBalanceVisible ? formatCurrency(totalUSD) : "****"}
   ```

4. **Hide daily change**:
   ```typescript
   {isBalanceVisible ? (
     <p className="font-semibold leading-[26px] text-[#3fea9b]">
       +$0.00 (0.00%)
     </p>
   ) : (
     <p className="font-semibold leading-[26px] text-[#3fea9b]">
       ****
     </p>
   )}
   ```

5. **Pass visibility state to TransactionHistory component** (if needed)

### Step 4: Update Transaction History Component

**File**: `components/wallet/transaction-history.tsx` (if exists)

- Hide transaction amounts when `isBalanceVisible === false`
- Show `****` instead of amounts

### Step 5: Update Reward Claim Card

**File**: `components/wallet/reward-claim-card.tsx` (if exists)

- Hide claimable rewards amount when `isBalanceVisible === false`

---

## Helper Function

Create a utility function to format hidden values:

**File**: `lib/shared/utils/balance-formatting.ts`

```typescript
/**
 * Format balance value based on visibility state
 * @param value - The value to display
 * @param isVisible - Whether balance is visible
 * @param placeholder - Placeholder text (default: "****")
 * @returns Formatted value or placeholder
 */
export function formatBalanceWithVisibility(
  value: string | number,
  isVisible: boolean,
  placeholder: string = "****"
): string {
  if (!isVisible) return placeholder;
  return typeof value === 'number' ? value.toString() : value;
}
```

---

## Testing Checklist

- [ ] Eye icon size increased on portfolio page
- [ ] Eye icon is clickable and toggles state
- [ ] State persists after page refresh
- [ ] Total balance hides/shows correctly
- [ ] Daily change hides/shows correctly
- [ ] Asset amounts hide/show correctly
- [ ] Asset USD values hide/show correctly
- [ ] NFT values hide/show correctly
- [ ] Send tab amounts hide/show correctly
- [ ] Activities tab amounts hide/show correctly
- [ ] Wallet panel balance hides/shows correctly
- [ ] Wallet panel daily change hides/shows correctly
- [ ] Transaction history amounts hide/show correctly
- [ ] State syncs between wallet panel and portfolio page

---

## Files to Modify

1. ✅ `lib/frontend/store/balance-visibility-store.ts` (NEW)
2. ✅ `app/portfolio/page.tsx`
3. ✅ `components/wallet/wallet-balance-panel.tsx`
4. ✅ `components/wallet/transaction-history.tsx` (if exists)
5. ✅ `components/wallet/reward-claim-card.tsx` (if exists)
6. ✅ `lib/shared/utils/balance-formatting.ts` (NEW - optional helper)

---

## Implementation Order

1. Create balance visibility store
2. Update portfolio page (eye icon size + toggle)
3. Update wallet balance panel (use global state)
4. Apply hiding logic to all relevant components
5. Test and verify

---

## Notes

- Default state: `isBalanceVisible: true` (visible by default)
- State persists in localStorage
- All amounts should show `****` when hidden
- Eye icon should be clickable button with hover effect
- Consider adding visual feedback (icon changes to "eye-off" when hidden)

