# NitroBridge Vault - End-to-End Testing Guide

## Project Overview
**NitroBridge Vault** is a cross-chain margin and credit protocol integrating multiple advanced DeFi primitives:
1.  **Arc Credit Terminal**: On-chain credit lines on **Arc Testnet**.
2.  **Yellow Network**: High-speed state channels for instant, gasless margin top-ups (via `@erc7824/nitrolite`).
3.  **Circle CCTP**: Native USDC bridging between Sepolia and Arc.
4.  **MEV Shield**: Anti-frontrunning commit-reveal mechanism on Sepolia.

## Prerequisites
- **Wallet**: MetaMask (recommended) or any EIP-1193 wallet.
- **Networks**:
    - **Sepolia** (Chain ID: 11155111) - for CCTP and MEV Shield.
    - **Arc Testnet** (Chain ID: 5042002) - for Credit Line and Deposit.
- **Tokens**:
    - **Sepolia ETH**: For gas on Sepolia.
    - **Sepolia USDC**: Get from [Circle Faucet](https://faucet.circle.com/).
    - **Arc Testnet ETH**: For gas on Arc.
    - **Arc Testnet USDC**: For credit operations.

---

## 🧪 Test Flows

### 1. Deposit (Arc Testnet)
**Goal**: Fund your credit line to increase borrowing limit.
- **Pre-condition**: Wallet on **Arc Testnet** (auto-switches).
- **Steps**:
    1.  Go to **Deposit** tab.
    2.  Enter Amount (e.g., `15`).
    3.  Click **Deposit to Credit Line**.
    4.  **MetaMask**: Approve USDC spending.
    5.  **MetaMask**: Confirm Deposit transaction.
- **Success**: Notification appears, and "Deposited" amount in Dashboard increases.

### 2. Borrow / Repay (Arc Testnet)
**Goal**: Draw USDC against your deposited collateral.
- **Pre-condition**: You must have deposited funds first.
- **Steps (Borrow)**:
    1.  Go to **Borrow / Repay** tab.
    2.  Select **Borrow**.
    3.  Enter Amount (must be ≤ Available Credit).
    4.  Click **Borrow**.
    5.  **MetaMask**: Confirm transaction.
- **Steps (Repay)**:
    1.  Select **Repay**.
    2.  Enter Amount.
    3.  Click **Repay**.
    4.  **MetaMask**: Approve USDC (if needed) -> Confirm Repay tx.
- **Success**: "Borrowed" amount in Dashboard updates.

### 3. CCTP Bridge (Sepolia -> Arc)
**Goal**: Move USDC from Ethereum Sepolia to Arc Testnet natively.
- **Pre-condition**: Have **Sepolia USDC** (from faucet).
- **Steps**:
    1.  Go to **CCTP Bridge** tab.
    2.  Enter Amount (e.g., `10` USDC).
    3.  Click **Bridge to Arc Testnet**.
    4.  **Auto-Switch**: Wallet switches to **Sepolia**.
    5.  **MetaMask**: Approve USDC -> Confirm Burn transaction.
    6.  **Wait**: App waits for Circle Attestation (~30-60s). Status bar fills up.
    7.  **Auto-Switch**: Wallet switches to **Arc Testnet**.
    8.  **MetaMask**: Confirm Mint transaction.
- **Success**: Sepolia USDC decreases, Arc USDC increases.

### 4. Yellow Channel (State Channels)
**Goal**: Open a high-speed payment channel using the Nitrolite SDK.
- **Steps**:
    1.  Go to **Yellow Channel** tab.
    2.  Click **Connect to Yellow ClearNode**.
    3.  **MetaMask**: Sign the EIP-712 authentication message.
    4.  **App**: Shows "Connected" and live logs from the WebSocket.
    5.  Click **Create Session** to initialize a state channel with the counterparty.
- **Success**: Logs show "Authenticated", "Session Created".

### 5. MEV Shield (Sepolia)
**Goal**: Execute a swap protected from front-running/sandwich attacks.
- **Steps**:
    1.  Go to **MEV Shield** tab.
    2.  Enter Swap Amount.
    3.  Click **Commit Hidden Order**.
    4.  **MetaMask**: Confirm Commit transaction (on Sepolia).
    5.  **Wait**: Transaction confirms (simulating block wait).
    6.  Click **Reveal & Execute Swap**.
    7.  **MetaMask**: Confirm Reveal transaction.
- **Success**: Transaction confirmed, swap executed without leaking intent in mempool.

---

## Troubleshooting
- **"Transaction Failed"**: Check if you have enough ETH for gas on the respective network.
- **Wallet Popups**: Always check which network MetaMask is prompting for. The app now auto-switches.
- **Phantom/Other Wallets**: If using multiple extensions, ensure MetaMask is prioritized or disable others to avoid conflicts (though the app now enforces the connected wagmi wallet).
