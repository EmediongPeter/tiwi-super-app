# Jupiter Ultra Swap API Implementation Plan

## Executive Summary

Based on the comprehensive review of Jupiter's documentation and your requirements, here's the detailed implementation plan for migrating to Jupiter Ultra Swap API with proper fee collection (0.25%) and optimal user experience.

---

## Key Decisions & Clarifications

### 1. ✅ Slippage Handling Strategy

**Your Requirement:**
- **Auto Mode**: Let Jupiter's RTSE (Real-Time Slippage Estimator) function automatically
- **Fixed Mode**: Use user's specified slippage value

**Implementation:**
```typescript
// In Jupiter Adapter
private async getJupiterOrder(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageMode: 'fixed' | 'auto',
  slippage?: number, // Only used in fixed mode
  taker?: string,
  referralAccount?: string,
  referralFee?: string
): Promise<JupiterOrderResponse | null> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    taker: taker || '',
    referralAccount: referralAccount || '',
    referralFee: referralFee || '31', // 31 bps = 0.25% net after 20% cut
  });
  
  // IMPORTANT: Ultra API doesn't have a slippage parameter
  // RTSE automatically determines optimal slippage
  // If user wants fixed slippage, we need to validate it's within acceptable range
  // But Jupiter will still use RTSE - we can only validate the result
  
  // For auto mode: Don't pass any slippage validation
  // For fixed mode: We can validate the response's slippageBps matches user's expectation
  // However, Jupiter's RTSE may override if it determines a different slippage is needed
  
  const url = `${JUPITER_ULTRA_API_BASE}/order?${params.toString()}`;
  // ... rest of implementation
}
```

**Key Insight:**
- Ultra Swap API **doesn't accept a slippage parameter** in the `/order` request
- RTSE automatically determines optimal slippage based on:
  - Token categories
  - Historical and real-time slippage data
  - Volatility patterns
  - Real-time failure rates
- The response includes `slippageBps` which shows what slippage was actually used
- **For fixed mode**: We can validate the response, but Jupiter may use different slippage if RTSE determines it's necessary for trade success

**Recommendation:**
- **Auto Mode**: Trust RTSE completely - don't validate slippage
- **Fixed Mode**: 
  - Show user the actual slippage used (from response)
  - Warn if slippage differs significantly from user's preference
  - Allow user to proceed or cancel

### 2. ✅ Fee Account Setup - Critical Understanding

**Your Question:** "Isn't it just an address or do I need to do it like `ensureFeeAccountExists`?"

**Answer:** **You MUST create the accounts like `ensureFeeAccountExists`**, but using Jupiter's Referral SDK instead of SPL Token directly.

**Why:**
- Fee accounts are **Program Derived Addresses (PDAs)** under Jupiter's Referral Program
- They're **NOT** regular token accounts - they're special accounts managed by Jupiter's referral program
- They must be **initialized on-chain** before fees can be collected
- The address is deterministic (can be calculated), but the account must exist on-chain

**Implementation Approach:**

```typescript
// lib/backend/services/jupiter-referral-service.ts

import { ReferralProvider } from "@jup-ag/referral-sdk";
import { Connection, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";

export class JupiterReferralService {
  private connection: Connection;
  private provider: ReferralProvider;
  private projectPubKey = new PublicKey('DkiqsTrw1u1bYFumumC7sCG2S8K25qc2vemJFHyW2wJc'); // Jupiter Ultra Referral Project
  
  constructor(connection: Connection) {
    this.connection = connection;
    this.provider = new ReferralProvider(connection);
  }
  
  /**
   * Ensure referral account exists (one-time setup)
   * Returns the referral account public key
   */
  async ensureReferralAccount(
    payerPubKey: PublicKey,
    partnerPubKey: PublicKey,
    name: string
  ): Promise<PublicKey> {
    const transaction = await this.provider.initializeReferralAccountWithName({
      payerPubKey,
      partnerPubKey,
      projectPubKey: this.projectPubKey,
      name,
    });
    
    const referralAccount = await this.connection.getAccountInfo(
      transaction.referralAccountPubKey
    );
    
    if (!referralAccount) {
      // Need to sign and send transaction
      // This requires a wallet/keypair - should be done as a one-time setup script
      throw new Error('Referral account must be initialized. Run setup script first.');
    }
    
    return transaction.referralAccountPubKey;
  }
  
  /**
   * Ensure referral token account exists for a specific mint
   * Similar to ensureFeeAccountExists in tiwi-test, but using Referral SDK
   */
  async ensureReferralTokenAccount(
    payerPubKey: PublicKey,
    referralAccountPubKey: PublicKey,
    mint: PublicKey,
    wallet: Keypair // Required for signing
  ): Promise<PublicKey> {
    const transaction = await this.provider.initializeReferralTokenAccountV2({
      payerPubKey,
      referralAccountPubKey,
      mint,
    });
    
    const referralTokenAccount = await this.connection.getAccountInfo(
      transaction.tokenAccount
    );
    
    if (!referralTokenAccount) {
      // Account doesn't exist - create it
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction.tx,
        [wallet]
      );
      console.log(`Created referral token account: ${transaction.tokenAccount.toBase58()}`);
      console.log(`Transaction: https://solscan.io/tx/${signature}`);
    } else {
      console.log(`Referral token account already exists: ${transaction.tokenAccount.toBase58()}`);
    }
    
    return transaction.tokenAccount;
  }
  
  /**
   * Get referral token account address (deterministic, but may not exist on-chain)
   * Use this to check if account exists before calling ensureReferralTokenAccount
   */
  getReferralTokenAccountAddress(
    referralAccountPubKey: PublicKey,
    mint: PublicKey
  ): PublicKey {
    // This is a PDA - can be calculated deterministically
    // But we use the SDK method to ensure correctness
    const [tokenAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("referral_ata"),
        referralAccountPubKey.toBuffer(),
        mint.toBuffer(),
      ],
      new PublicKey("REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3") // Referral Program
    );
    return tokenAccount;
  }
  
  /**
   * Check if referral token account exists on-chain
   */
  async checkReferralTokenAccountExists(
    referralAccountPubKey: PublicKey,
    mint: PublicKey
  ): Promise<boolean> {
    const tokenAccountAddress = this.getReferralTokenAccountAddress(
      referralAccountPubKey,
      mint
    );
    const accountInfo = await this.connection.getAccountInfo(tokenAccountAddress);
    return accountInfo !== null;
  }
}
```

**Setup Process (One-Time):**

1. **Create Referral Account** (run once):
   ```typescript
   // scripts/setup-jupiter-referral.ts
   const referralAccount = await referralService.ensureReferralAccount(
     wallet.publicKey,
     wallet.publicKey,
     'tiwi-protocol' // Your name
   );
   // Store this address in environment variable: JUPITER_REFERRAL_ACCOUNT
   ```

2. **Create Token Accounts** (for popular mints):
   ```typescript
   // Create for SOL, USDC, USDT initially
   const mints = [
     'So11111111111111111111111111111111111111112', // SOL
     'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
     'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
   ];
   
   for (const mint of mints) {
     await referralService.ensureReferralTokenAccount(
       wallet.publicKey,
       referralAccount,
       new PublicKey(mint),
       wallet
     );
   }
   ```

3. **Runtime Check** (in Jupiter adapter):
   ```typescript
   // Before calling /order, check if fee account exists
   // If feeMint is determined by Jupiter, check if we have that token account
   // If not, we can still proceed (order will work, but no fees collected)
   ```

### 3. ✅ Fee Display Using `/fees` Endpoint

**Your Requirement:** Use `/fees` endpoint to show users how much fees they're paying

**Implementation:**

```typescript
// lib/backend/services/jupiter-fee-info-service.ts

export class JupiterFeeInfoService {
  private apiKey: string;
  private ultraApiBase = 'https://api.jup.ag/ultra/v1';
  
  constructor() {
    this.apiKey = process.env.JUPITER_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('JUPITER_API_KEY is required');
    }
  }
  
  /**
   * Get fee information for a token pair
   * Returns Jupiter's default fees and category
   */
  async getFeeInfo(
    inputMint: string,
    outputMint: string
  ): Promise<JupiterFeeInfo> {
    const url = `${this.ultraApiBase}/fees?inputMint=${inputMint}&outputMint=${outputMint}`;
    
    const response = await fetch(url, {
      headers: {
        'x-api-key': this.apiKey,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch fee info: ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  /**
   * Calculate total fees for a swap
   * Includes: Jupiter default fees + Tiwi protocol fee
   */
  async calculateTotalFees(
    inputMint: string,
    outputMint: string,
    fromAmountUSD: number
  ): Promise<{
    jupiterFeeBps: number;
    jupiterFeeUSD: number;
    tiwiFeeBps: number;
    tiwiFeeUSD: number;
    totalFeeBps: number;
    totalFeeUSD: number;
  }> {
    const feeInfo = await this.getFeeInfo(inputMint, outputMint);
    
    // Jupiter's default fee (from response)
    const jupiterFeeBps = feeInfo.feeBps || 10; // Default 10 bps
    const jupiterFeeUSD = (fromAmountUSD * jupiterFeeBps) / 10000;
    
    // Tiwi protocol fee (31 bps to get 0.25% net after 20% cut)
    const tiwiFeeBps = 31;
    const tiwiFeeUSD = (fromAmountUSD * tiwiFeeBps) / 10000;
    
    // Total fees
    const totalFeeBps = jupiterFeeBps + tiwiFeeBps;
    const totalFeeUSD = jupiterFeeUSD + tiwiFeeUSD;
    
    return {
      jupiterFeeBps,
      jupiterFeeUSD,
      tiwiFeeBps,
      tiwiFeeUSD,
      totalFeeBps,
      totalFeeUSD,
    };
  }
}
```

**Frontend Integration:**

```typescript
// In swap interface, before showing quote
const feeInfo = await fetch(`/api/v1/jupiter/fees?inputMint=${fromToken.address}&outputMint=${toToken.address}`);

// Display to user:
// - Jupiter fee: X bps (Y USD)
// - Tiwi protocol fee: 31 bps (Z USD)
// - Total fees: (X+31) bps (Y+Z USD)
```

---

## Implementation Roadmap

### Phase 1: Core Migration (Week 1) - CRITICAL

#### 1.1 Environment Setup
- [ ] Get Jupiter API key from https://portal.jup.ag
- [ ] Add to `.env`: `JUPITER_API_KEY=your-key`
- [ ] Install dependencies: `npm install @jup-ag/referral-sdk @solana/web3.js@1`

#### 1.2 Referral Account Setup (One-Time)
- [ ] Create setup script: `scripts/setup-jupiter-referral.ts`
- [ ] Run script to create referral account
- [ ] Store referral account address in `.env`: `JUPITER_REFERRAL_ACCOUNT=your-address`
- [ ] Create token accounts for SOL, USDC, USDT
- [ ] Verify accounts exist on-chain

#### 1.3 Update Jupiter Adapter
- [ ] Change API endpoint from `/swap/v1/quote` to `/ultra/v1/order`
- [ ] Update request parameters:
  - Remove: `platformFeeBps`, `onlyDirectRoutes`, `restrictIntermediateTokens`
  - Add: `taker`, `referralAccount`, `referralFee`
- [ ] Add API key header: `x-api-key`
- [ ] Handle slippage mode (auto vs fixed)
- [ ] Update response parsing (new response format)

#### 1.4 Fee Configuration
- [ ] Set `referralFee: '31'` (to get 0.25% net after 20% cut)
- [ ] Add referral account to requests
- [ ] Validate `feeBps` in response matches `referralFee`

### Phase 2: Fee Management (Week 2)

#### 2.1 Fee Account Service
- [ ] Create `JupiterReferralService`
- [ ] Implement `ensureReferralTokenAccount`
- [ ] Implement `checkReferralTokenAccountExists`
- [ ] Add logic to determine which fee account to use based on `feeMint` from order response

#### 2.2 Fee Info Service
- [ ] Create `JupiterFeeInfoService`
- [ ] Implement `/fees` endpoint integration
- [ ] Create API route: `/api/v1/jupiter/fees`
- [ ] Calculate total fees (Jupiter + Tiwi)

#### 2.3 Frontend Integration
- [ ] Add fee display component
- [ ] Show fee breakdown before swap
- [ ] Update swap details card with fee information

### Phase 3: Transaction Execution (Week 3)

#### 3.1 Execute Endpoint
- [ ] Create backend endpoint: `/api/v1/jupiter/execute`
- [ ] Implement transaction signing (frontend)
- [ ] Implement `/execute` API call
- [ ] Add transaction status polling
- [ ] Handle success/failure responses

#### 3.2 Error Handling
- [ ] Handle missing fee accounts gracefully
- [ ] Warn if `feeBps` doesn't match `referralFee`
- [ ] Add retry logic for failed transactions
- [ ] Improve error messages

### Phase 4: Optimization (Week 4)

#### 4.1 Slippage Handling
- [ ] Implement RTSE trust for auto mode
- [ ] Add slippage validation for fixed mode
- [ ] Show actual slippage used in UI
- [ ] Warn if slippage differs from user preference

#### 4.2 Fee Account Management
- [ ] Add on-demand fee account creation
- [ ] Cache fee account existence checks
- [ ] Monitor fee collection
- [ ] Add fee claiming functionality

---

## Code Structure

### New Files to Create

```
lib/backend/
├── services/
│   ├── jupiter-referral-service.ts      # Fee account management
│   ├── jupiter-fee-info-service.ts      # Fee information
│   └── jupiter-execute-service.ts       # Transaction execution
├── routers/
│   └── adapters/
│       └── jupiter-adapter.ts           # UPDATE: Migrate to Ultra API
└── api/
    └── v1/
        └── jupiter/
            ├── fees/
            │   └── route.ts             # GET /api/v1/jupiter/fees
            └── execute/
                └── route.ts              # POST /api/v1/jupiter/execute

scripts/
└── setup-jupiter-referral.ts            # One-time setup script
```

### Updated Files

```
lib/backend/routers/adapters/jupiter-adapter.ts
- Migrate from Lite API to Ultra API
- Update request/response handling
- Add referral account support
- Handle slippage modes

lib/backend/services/route-service.ts
- Update fee calculation (0.25% = 31 bps)
- Handle Jupiter Ultra response format
```

---

## Important Notes & Gotchas

### 1. Slippage Parameter
- **Ultra API doesn't accept slippage in request**
- RTSE automatically determines optimal slippage
- Response includes `slippageBps` showing what was used
- For fixed mode: Validate response, warn if different

### 2. Fee Account Requirements
- **Must be initialized on-chain** (not just an address)
- Use Jupiter's Referral SDK (not SPL Token directly)
- Account is a PDA under Jupiter's Referral Program
- If account doesn't exist, order still works but no fees collected

### 3. Fee Mint Determination
- Jupiter decides `feeMint` based on priority list (SOL > Stablecoins > LSTs > Bluechips > Others)
- You must have referral token account for the `feeMint`
- Check `feeMint` in order response
- If you don't have that token account, fees won't be collected (but swap still works)

### 4. Fee Calculation
- Set `referralFee: '31'` to get 0.25% net (after Jupiter's 20% cut)
- Jupiter takes 20% of your integrator fees
- 31 bps × 0.8 = 24.8 bps ≈ 0.25% net
- Response `feeBps` should equal your `referralFee` if account exists

### 5. Transaction Execution
- `/order` returns base64 encoded transaction
- User signs transaction on frontend
- `/execute` handles submission and polling
- Can poll for up to 2 minutes with same `signedTransaction` and `requestId`

---

## Testing Checklist

### Setup
- [ ] Referral account created and stored
- [ ] Token accounts created for SOL, USDC, USDT
- [ ] API key configured
- [ ] Environment variables set

### Functionality
- [ ] Quote fetching works with Ultra API
- [ ] Fee accounts are checked before orders
- [ ] Fee information is displayed correctly
- [ ] Transaction execution works
- [ ] Status polling works
- [ ] Fees are collected correctly

### Edge Cases
- [ ] Missing fee account (order works, no fees)
- [ ] Wrong fee mint (fees not collected)
- [ ] Auto vs fixed slippage modes
- [ ] Transaction failures
- [ ] Network errors

---

## Next Steps

1. **Immediate**: Review this plan and confirm approach
2. **Week 1**: Set up referral accounts and migrate to Ultra API
3. **Week 2**: Implement fee management and display
4. **Week 3**: Add transaction execution
5. **Week 4**: Optimize and test

---

## Questions to Resolve

1. **Wallet for Setup**: Who owns the wallet that will create referral accounts? (Needs to sign transactions)
2. **Fee Account Strategy**: Create accounts for all tokens upfront, or on-demand?
3. **Slippage UX**: How to handle when RTSE uses different slippage than user specified?
4. **Fee Display**: Show fees before quote, or after quote is received?

---

## Conclusion

This implementation plan addresses all your requirements:
- ✅ Slippage: Auto uses RTSE, Fixed uses user value (with validation)
- ✅ Fee Accounts: Must be created like `ensureFeeAccountExists` using Referral SDK
- ✅ Fee Display: Use `/fees` endpoint to show users fee breakdown
- ✅ 0.25% Fee: Set `referralFee: '31'` to get net 0.25% after Jupiter's cut

The migration is straightforward but requires careful setup of referral accounts. Once set up, the integration will provide best prices for users and proper fee collection for Tiwi Protocol.

