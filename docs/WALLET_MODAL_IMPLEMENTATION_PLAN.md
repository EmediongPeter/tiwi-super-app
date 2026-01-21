# Connect Wallet Modal & Toast - Implementation Plan

## 📐 Design Analysis Summary

### Connect Wallet Modal (Figma Node: 46-13600)

**Structure:**
- **Container:** Dark modal with rounded corners (24px border-radius)
- **Header:** 
  - Title: "Connect Wallet" (24px, bold, white)
  - Close button: Circular X icon (32px) in top-right
- **Primary Options Section:**
  - Two card options with 40px gap between them:
    1. **Create New Wallet Card:**
       - Background: `#121712`
       - Icon: Wallet icon (24px) in circular `#0b0f0a` background
       - Title: "Create New Wallet" (18px, semibold, white)
       - Description: "Set up a brand new wallet in minutes." (16px, medium, `#b5b5b5`)
    2. **Import Wallet Card:**
       - Same styling as Create New Wallet
       - Icon: Cloud download icon
       - Title: "Import Wallet"
       - Description: "Use your existing seed phrase or private key."
- **Divider Section:**
  - Horizontal line with "Connect External Wallets" text centered (16px, medium, `#b5b5b5`)
- **External Wallets Section:**
  - Three wallet icons in a row with 16px gap:
    1. MetaMask (32px icon)
    2. WalletConnect (32px icon)
    3. Coinbase Wallet (32px icon)
  - Each in a `#121712` card with `#0b0f0a` circular icon background

**Colors:**
- Modal background: `#0b0f0a`
- Card background: `#121712`
- Border: `#1f261e`
- Title text: `#ffffff`
- Body text: `#b5b5b5`
- Icon background: `#0b0f0a`

**Spacing:**
- Modal padding: 24px horizontal, 16px top, 40px bottom
- Card padding: 16px
- Gap between primary cards: 40px
- Gap between external wallets: 16px
- Gap between sections: 24px

### Wallet Connected Toast (Figma Node: 46-13586)

**Structure:**
- **Container:** Horizontal card with rounded corners (16px)
- **Background:** Gradient from `#b1f128` (top) to `#010501` (bottom) at ~181.5deg
- **Border:** `#1f261e` (1px solid)
- **Content:**
  - Left side: Text "Wallet Connected!" (16px, semibold, white) + truncated address "0x061...T432" (16px, `#b5b5b5`)
  - Right side: Checkmark icon in green circle (24px)
- **Padding:** 24px all around

**Colors:**
- Background gradient: `linear-gradient(181.52486429325808deg, rgba(177, 241, 40, 1) 158.79%, rgba(1, 5, 1, 1) 40.441%)`
- Border: `#1f261e`
- Title text: `#ffffff`
- Address text: `#b5b5b5`
- Checkmark circle: `#b1f128`

---

## 🧱 Component Breakdown

### 1. `ConnectWalletModal` Component
**Location:** `components/wallet/connect-wallet-modal.tsx`

**Props:**
```typescript
interface ConnectWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWalletConnect?: (walletType: WalletType) => void;
}
```

**Responsibilities:**
- Render modal overlay and container
- Handle open/close state
- Compose wallet option components
- Trigger wallet connection callbacks (mocked)

**Structure:**
- Uses shadcn/ui `Dialog` component for modal functionality
- Contains header with title and close button
- Contains `WalletOptionCard` components for primary options
- Contains divider with text
- Contains `ExternalWalletIcon` components

### 2. `WalletOptionCard` Component
**Location:** `components/wallet/wallet-option-card.tsx`

**Props:**
```typescript
interface WalletOptionCardProps {
  icon: string; // Icon path
  title: string;
  description: string;
  onClick?: () => void;
}
```

**Responsibilities:**
- Render individual wallet option card
- Handle click interaction
- Display icon, title, and description

### 3. `ExternalWalletIcon` Component
**Location:** `components/wallet/external-wallet-icon.tsx`

**Props:**
```typescript
interface ExternalWalletIconProps {
  icon: string; // Icon path
  name: string; // For accessibility
  onClick?: () => void;
}
```

**Responsibilities:**
- Render external wallet icon button
- Handle click interaction
- Provide accessibility labels

### 4. `WalletConnectedToast` Component
**Location:** `components/wallet/wallet-connected-toast.tsx`

**Props:**
```typescript
interface WalletConnectedToastProps {
  address: string; // Wallet address to display
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number; // Auto-dismiss duration in ms
}
```

**Responsibilities:**
- Render toast notification
- Format and truncate wallet address
- Handle auto-dismiss (if duration provided)
- Display success checkmark icon

**Address Formatting:**
- Format: `0x{first3}...{last4}`
- Example: `0x061...T432`

### 5. `useWalletToast` Hook (Optional)
**Location:** `hooks/useWalletToast.ts`

**Responsibilities:**
- Manage toast state
- Handle toast show/hide logic
- Provide address formatting utility

---

## 🔄 State Management Approach

### Modal State
- **Local State:** Managed in parent component (`SwapPage` or `Navbar`)
- **State Variable:** `isConnectModalOpen: boolean`
- **Handler:** `setIsConnectModalOpen`

### Toast State
- **Local State:** Managed in parent component
- **State Variable:** `isToastOpen: boolean`
- **Handler:** `setIsToastOpen`
- **Address State:** `connectedAddress: string | null`

### Mock Wallet Connection Flow
1. User clicks wallet option
2. Modal closes (`onOpenChange(false)`)
3. Mock connection (setTimeout to simulate async)
4. Toast appears with mock address
5. Toast auto-dismisses after 5 seconds (or manual dismiss)

---

## 📱 Responsiveness Strategy

### Modal
- **Mobile (< 640px):**
  - Full width with small margins (16px)
  - Reduced padding (16px horizontal, 12px vertical)
  - Smaller text sizes (title: 20px, descriptions: 14px)
  - Stack external wallet icons if needed (or horizontal scroll)
  
- **Tablet (640px - 1024px):**
  - Max width: 500px
  - Centered on screen
  - Standard padding and text sizes
  
- **Desktop (> 1024px):**
  - Max width: 550px
  - Centered on screen
  - Full padding and text sizes

### Toast
- **All Screen Sizes:**
  - Fixed position: bottom-right (or top-right per design)
  - Max width: 400px on mobile, 450px on desktop
  - Responsive padding
  - Text truncation for long addresses

---

## 🎨 Icon Handling Strategy

### Icons Required
1. **wallet-04.svg** - Create New Wallet icon
2. **cloud-download.svg** - Import Wallet icon
3. **metamask.svg** - MetaMask wallet icon
4. **walletconnect.svg** - WalletConnect wallet icon
5. **coinbase-wallet.svg** - Coinbase Wallet icon
6. **checkmark-circle-01.svg** - Success checkmark
7. **cancel-circle.svg** - Close button icon

### Icon Storage
- **Location:** `public/assets/icons/wallet/` (for wallet-specific icons)
- **Location:** `public/assets/icons/` (for general icons like checkmark, cancel)

### Icon Implementation
- Use Next.js `Image` component for optimized loading
- Provide proper `alt` text for accessibility
- Use appropriate sizes from Figma (24px, 32px)

---

## 🛠️ shadcn/ui Components to Add

### Required Components
1. **Dialog** - For modal functionality
   - Command: `npx shadcn@latest add dialog`
   - Provides: Modal overlay, content, trigger, close functionality

2. **Toast** (Optional) - For toast notifications
   - Command: `npx shadcn@latest add toast`
   - Alternative: Custom toast implementation for more control

### Decision
- **Use Dialog:** Yes, for modal
- **Use Toast:** Consider custom implementation for exact Figma match, or use shadcn Toast and customize heavily

---

## 🔮 Future-Proofing for Real Wallet Integration

### Abstraction Points
1. **Wallet Type Enum:**
   ```typescript
   type WalletType = 
     | "metamask"
     | "walletconnect"
     | "coinbase"
     | "create"
     | "import";
   ```

2. **Wallet Connection Handler:**
   ```typescript
   interface WalletConnectionHandler {
     connect: (type: WalletType) => Promise<string>; // Returns address
     disconnect: () => Promise<void>;
     isConnected: () => boolean;
     getAddress: () => string | null;
   }
   ```

3. **Props for Real Integration:**
   - `onWalletConnect?: (type: WalletType) => Promise<string>` - Async handler
   - `isConnecting?: boolean` - Loading state
   - `connectionError?: string | null` - Error state

4. **State Management:**
   - Future: Move to Context API or Zustand store
   - Current: Local state in parent components

---

## 📋 Implementation Steps

### Step 1: Install shadcn/ui Dialog Component
```bash
pnpx shadcn@latest add dialog
```

### Step 2: Download Icons from Figma
- Download all required icons
- Save to appropriate directories
- Verify file paths

### Step 3: Create Component Files
1. `components/wallet/connect-wallet-modal.tsx`
2. `components/wallet/wallet-option-card.tsx`
3. `components/wallet/external-wallet-icon.tsx`
4. `components/wallet/wallet-connected-toast.tsx`

### Step 4: Implement ConnectWalletModal
- Set up Dialog component
- Implement header with close button
- Add primary wallet option cards
- Add divider section
- Add external wallet icons
- Match Figma spacing and colors exactly

### Step 5: Implement WalletConnectedToast
- Create toast component with gradient background
- Implement address truncation logic
- Add checkmark icon
- Handle open/close state
- Add auto-dismiss functionality (if design specifies)

### Step 6: Integrate with Existing Components
- Update `Navbar` to open modal on "Connect" click
- Update `SwapCard` to open modal on "Connect" click
- Add toast state management
- Wire up mock connection flow

### Step 7: Add Responsive Styles
- Test on mobile, tablet, desktop
- Adjust spacing and sizing as needed
- Ensure no overflow or clipping

### Step 8: Accessibility
- Add proper ARIA labels
- Ensure keyboard navigation
- Test with screen readers
- Ensure focus management

---

## ⚠️ Assumptions & Clarifications Needed

### Assumptions
1. **Toast Position:** Assumed bottom-right (common pattern), but need to confirm from design
2. **Toast Auto-Dismiss:** Assumed 5 seconds, but need to confirm if design specifies duration
3. **Modal Backdrop:** Assumed dark overlay with click-to-close
4. **Wallet Address Format:** Using `0x{first3}...{last4}` format from design example

### Clarifications Needed
1. **Toast Position:** Where should the toast appear? (top-right, bottom-right, top-center, etc.)
2. **Toast Duration:** Should it auto-dismiss? If yes, after how long?
3. **Toast Dismissal:** Can users manually dismiss? If yes, how? (X button, click outside, etc.)
4. **Modal Backdrop:** Should clicking outside close the modal?
5. **Wallet Connection Mock:** Should there be a loading state during mock connection?
6. **Error Handling:** Should we show error states if connection fails? (Not in current scope, but good to know)

---

## ✅ Completion Criteria Checklist

- [ ] Connect Wallet modal matches Figma exactly (colors, spacing, typography)
- [ ] Wallet Connected toast matches Figma exactly (gradient, layout, icon)
- [ ] Modal opens/closes correctly from Navbar and SwapCard
- [ ] Toast appears after mock wallet connection
- [ ] All wallet options are clickable (mock behavior)
- [ ] Responsive on mobile, tablet, desktop
- [ ] Icons display correctly
- [ ] Address truncation works correctly
- [ ] Accessibility features implemented
- [ ] Code is clean, modular, and follows project conventions
- [ ] No TypeScript errors
- [ ] No console errors

---

## 📝 File Structure

```
components/
├── wallet/
│   ├── connect-wallet-modal.tsx
│   ├── wallet-option-card.tsx
│   ├── external-wallet-icon.tsx
│   └── wallet-connected-toast.tsx
└── ui/
    ├── dialog.tsx (from shadcn)
    └── ... (existing)

public/
└── assets/
    └── icons/
        ├── wallet/
        │   ├── wallet-04.svg
        │   ├── cloud-download.svg
        │   ├── metamask.svg
        │   ├── walletconnect.svg
        │   └── coinbase-wallet.svg
        ├── checkmark-circle-01.svg
        └── cancel-circle.svg

hooks/
└── useWalletToast.ts (optional)
```

---

## 🎯 Next Steps

1. **Review this plan** and approve or request changes
2. **Clarify assumptions** listed above
3. **Download icons** from Figma (or provide alternative method)
4. **Proceed with implementation** once approved

---

**Ready for Review & Approval** ✅

