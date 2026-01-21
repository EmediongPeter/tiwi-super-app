# Receive Tab Implementation Plan

## Overview
Implement **Option B (Simple Dropdown)** as active solution, with **Option A (Token Selector Modal)** prepared but disabled for quick activation if approved.

---

## **Option B: Simple Dropdown (ACTIVE NOW)**

### Implementation:
1. **Fix Dropdown to Show Real Wallet Tokens**
   - Replace mock Ethereum data with `walletTokens` from `useWalletBalances`
   - Use `selectedReceiveToken` state (already exists)
   - Display all wallet tokens (including zero balances) for consistency
   - Use `TokenIcon` component for token logos
   - Format token amounts with `formatTokenAmount`

2. **Show Connected Wallet Address**
   - Replace hardcoded address `0x06193i092j9g9iu2ngmu0939i-4ti938hT432` with `connectedAddress` from `useWalletConnection`
   - Display address next to QR code
   - Update warning message to show selected token symbol dynamically

3. **Dropdown Functionality**
   - Close dropdown on token selection (already implemented)
   - Close dropdown on click outside (already implemented)
   - Update `selectedReceiveToken` when token is selected
   - Default to first token or TWC (same logic as send tab)

4. **QR Code & Address Display**
   - Show QR code for selected token's chain
   - Update warning message: "Only send {tokenSymbol} to this address"
   - Copy/Share buttons work with connected address

---

## **Option A: Token Selector Modal (PREPARED BUT DISABLED)**

### Implementation:
1. **Reuse Existing `TokenSelectorModal`**
   - ✅ Already implemented and working
   - ✅ Supports all chains and tokens
   - ✅ Has search and filtering
   - ✅ Consistent with swap page UX

2. **Modifications Needed:**
   - **Optional**: Hide price display (but not necessary - price is useful)
   - Convert selected `Token` to `WalletToken` format if needed
   - Handle token selection and update receive tab state

3. **Integration:**
   - Add feature flag: `const USE_TOKEN_MODAL_FOR_RECEIVE = false;`
   - Conditional rendering:
     ```tsx
     {USE_TOKEN_MODAL_FOR_RECEIVE ? (
       <TokenSelectorModal ... />
     ) : (
       <SimpleDropdown ... />
     )}
     ```
   - When boss approves: Change flag to `true`

4. **Benefits of Reusing:**
   - ✅ No need to build new component
   - ✅ Consistent UX across app
   - ✅ Already tested and working
   - ✅ Supports all chains (multi-chain support)

---

## **Implementation Steps**

### Step 1: Fix Option B (Active)
1. Update receive tab dropdown to use `walletTokens`
2. Replace hardcoded address with `connectedAddress`
3. Add token selection handler
4. Update warning message dynamically
5. Test dropdown functionality

### Step 2: Prepare Option A (Disabled)
1. Import `TokenSelectorModal` component
2. Add feature flag constant
3. Create conditional rendering logic
4. Add token conversion logic (if needed)
5. Comment/disable Option A code
6. Add TODO comment for activation

### Step 3: Testing
1. Test Option B with real wallet tokens
2. Test address display and copy/share
3. Verify Option A code compiles (even if disabled)
4. Document how to activate Option A

---

## **Code Structure**

```tsx
// Feature flag (at top of component)
const USE_TOKEN_MODAL_FOR_RECEIVE = false; // Set to true when approved

// In receive tab:
{USE_TOKEN_MODAL_FOR_RECEIVE ? (
  // Option A: Token Selector Modal
  <>
    <button onClick={() => setReceiveModalOpen(true)}>Select Token</button>
    <TokenSelectorModal
      open={receiveModalOpen}
      onOpenChange={setReceiveModalOpen}
      onTokenSelect={handleReceiveTokenSelect}
      selectedToken={selectedReceiveToken ? convertToToken(selectedReceiveToken) : null}
    />
  </>
) : (
  // Option B: Simple Dropdown
  <details ref={receiveDropdownRef}>
    {/* Dropdown with wallet tokens */}
  </details>
)}
```

---

## **Files to Modify**

1. `app/portfolio/page.tsx`
   - Fix receive tab dropdown (Option B)
   - Add Option A code (disabled)
   - Add feature flag

2. `docs/receive-tab-implementation-plan.md` (this file)
   - Document implementation

---

## **Activation Instructions (When Approved)**

1. Open `app/portfolio/page.tsx`
2. Find: `const USE_TOKEN_MODAL_FOR_RECEIVE = false;`
3. Change to: `const USE_TOKEN_MODAL_FOR_RECEIVE = true;`
4. Test and verify
5. Remove Option B code if desired (or keep as fallback)

---

## **Decision Points**

- ✅ Reuse `TokenSelectorModal` - Yes, it's perfect for this
- ✅ Feature flag approach - Yes, easy to toggle
- ✅ Keep Option B code - Yes, as fallback or for simpler UX preference
- ✅ Price display in modal - Keep it (useful info)

---

## **Next Steps**

1. Implement Option B fixes
2. Prepare Option A code (disabled)
3. Test both paths
4. Document activation process

