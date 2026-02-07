# ⚡ NitroBridge Vault: End-to-End Demo Guide

**Goal:** Demonstrate a next-gen DeFi margin protocol that solves liquidity fragmentation and slow cross-chain transfers using **Arc Credit Terminal**, **Circle CCTP**, and **Yellow Network**.

---

## 📖 The Story (What we are solving)

"Today, if you want to trade on multiple chains, your liquidity is fragmented. Bridging takes 15-20 minutes, during which trading opportunities are lost. 

**NitroBridge Vault** solves this with:
1.  **Instant Credit Lines**: Deposit once on Arc, borrow instantly.
2.  **Zero-Gas Top-ups**: Use Yellow Network state channels for sub-second margin refills.
3.  **Native Bridging**: Move liquidity via Circle CCTP without wrapped token risks.
4.  **MEV Protection**: Commit-reveal swaps to prevent front-running."

---

## 🎬 Demo Flow

### Phase 1: Setup & Credit Line (Arc Testnet)
**Narrative**: *"Let's start by establishing a credit line on the Arc Layer 2."*

1.  **Dashboard**: Show empty state. "Clean slate."
2.  **Deposit**:
    *   Navigate to **Deposit** tab.
    *   Explain: *"We are depositing USDC into the Credit Terminal smart contract."*
    *   Action: Deposit **15 USDC**.
    *   **Wallet**: Auto-switches to Arc Testnet. Sign Approve + Deposit.
    *   **Result**: Show "Deposited: $15.00" and "Limit: $22.50" (150% collateral ratio) on Dashboard.

### Phase 2: Instant Liquidity (Borrowing)
**Narrative**: *"Now that we have collateral, we can instantly draw liquidity without waiting for bridges."*

1.  **Borrow**:
    *   Navigate to **Borrow / Repay** tab.
    *   Action: Borrow **10 USDC**.
    *   **Wallet**: Confirm transaction.
    *   **Result**: Dashboard updates instantly. "Borrowed: $10.00".
    *   *Talk track*: "This capital is now available for trading immediately."

### Phase 3: High-Speed Channels (Yellow Network)
**Narrative**: *"But what if we need to top up margin instantly, faster than block times?"*

1.  **Yellow Channel**:
    *   Navigate to **Yellow Channel** tab.
    *   Action: Click **Connect to Yellow ClearNode**.
    *   **Wallet**: Sign EIP-712 message (Gasless authentication).
    *   **Result**: Status changes to "Connected".
    *   Action: Click **Create Session**.
    *   **Result**: Logs show "Session Created".
    *   *Talk track*: "We just opened a state channel. We can now stream payments in milliseconds, off-chain, settling only the final balance."

### Phase 4: Native Bridging (Circle CCTP)
**Narrative**: *"For large liquidity moves between Ethereum and L2s, we use the native standard."*

1.  **CCTP Bridge**:
    *   Navigate to **CCTP Bridge** tab.
    *   Action: Enter **10 USDC** to bridge from Sepolia -> Arc.
    *   **Wallet**: Auto-switches to **Sepolia**. Sign Burn transaction.
    *   **Wait**: "Waiting for Circle Attestation..." (Show the progress bar).
    *   *Talk track*: "Circle validates the burn event on Ethereum..."
    *   **Wallet**: Auto-switches to **Arc Testnet**. Sign Mint transaction.
    *   **Result**: "Bridge Successful". Liquidity moved natively.

### Phase 5: Anti-MEV Swap (Sepolia)
**Narrative**: *"Finally, when executing trades, we protect users from sandwich attacks."*

1.  **MEV Shield**:
    *   Navigate to **MEV Shield** tab.
    *   Action: Enter Swap Amount. Click **Commit Hidden Order**.
    *   **Wallet**: Sign Commit tx on Sepolia.
    *   *Talk track*: "We posted a hash. The market knows we're trading, but not *what* or *how much*."
    *   Action: Wait for block confirmation -> Click **Reveal & Execute**.
    *   **Result**: Swap executes at the fair price.

---

## 🛠️ Setup Checklist for Demo
- [ ] **MetaMask Installed**: Only one wallet extension active to avoid conflicts.
- [ ] **Networks Added**: Sepolia and Arc Testnet configured.
- [ ] **Tokens Loaded**:
    -   Sepolia ETH (0.1+)
    -   Sepolia USDC (50+)
    -   Arc ETH (0.01+)
    -   Arc USDC (if needed, but Deposit handles initial flow)
- [ ] **Clean State**: Disconnect wallet before starting demo for fresh login effect.
