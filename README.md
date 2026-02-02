# NitroBridge Vault

**HackMoney 2026 Submission**

> Revolving credit line with instant cross-chain margin refills via state channels and privacy hooks

## Product Overview

NitroBridge Vault enables traders to deposit USDC into an Arc smart contract and access a revolving credit line. When margin is low, a Yellow-authorized agent auto-approves instant top-ups through state channels, while Uniswap v4 privacy hooks hide order execution details from MEV bots.

## Problem We Solve

**Current State:** Traders with capital scattered across multiple chains face a brutal dilemma when margin runs low:

1. **Liquidation Risk** – Traditional bridging takes 5-15 minutes. By the time funds arrive, positions are already liquidated.

2. **MEV Extraction** – Publicly requesting liquidity signals the market. Bots frontrun your refill, making it more expensive.

3. **Credit Blindness** – On-chain protocols have no memory. A trader with perfect repayment history gets treated the same as a first-time borrower.

4. **Chain Fragmentation** – Your USDC is on Ethereum, but you need it on Arc *right now*. Moving it requires bridging, swapping, gas in multiple currencies.

**NitroBridge Vault fixes this:**

- **Instant Top-ups** via Yellow state channels – sub-second, zero gas, pre-authorized by your credit policy
- **Hidden Execution** via Uniswap v4 hooks – your order size stays private until execution, no MEV leakage
- **Portable Reputation** via ENS – your credit score travels with your .eth name across any protocol
- **Seamless Liquidity** via Circle CCTP – native USDC bridges from Ethereum to Arc in minutes, settled directly into your credit line

## System Architecture

### Layer 1: User Interface
The frontend is built with Next.js and provides three core interfaces:
- **Credit Dashboard**: View available credit, current debt, and repayment history
- **Margin Top-up UI**: Request instant margin refills with real-time status
- **ENS Profile Management**: Link borrower.eth domain and view credit reputation

### Layer 2: Smart Contracts (Arc Testnet)
**ArcCreditTerminal.sol** manages the core credit logic:
- `depositToCreditLine()`: Accepts USDC deposits via Circle Gateway, mints credit tokens
- `requestMarginTopUp()`: Triggered when margin falls below threshold
- `receiveCCTP()`: Handles USDC received from Ethereum Sepolia via Circle CCTP
- `settleCredit()`: Processes repayments from trading profits

**AntiSniperHook.sol** (Uniswap v4 on Arc Testnet):
- Implements commit-reveal scheme to hide order sizes
- `beforeSwap()`: Records encrypted commitment of trade details
- `afterSwap()`: Reveals actual execution, prevents MEV frontrunning

### Layer 3: Integration Layer
**Yellow Nitrolite SDK**:
- Opens state channel sessions between trader and authorized agent
- Enables instant off-chain transfers (sub-second, zero gas)
- Settles final balances on Arc testnet

**Circle CCTP**:
- Bridges USDC from Ethereum Sepolia to Arc Testnet
- Burn-and-mint mechanism ensures native USDC on destination
- Contracts: Message Transmitter (0x8FE6B...2DAA), Token Messenger (0xb43db...cF192)

**Circle Gateway**:
- Unified USDC balance across chains
- Instant transfers with next-block finality

**ENS (Sepolia Testnet)**:
- Text records store credit scores and policies
- `vnd.credit-score`: JSON with score, history, limits
- `vnd.credit-policy`: Risk parameters and approval rules

### Layer 4: Cross-Chain Execution
End-to-end flow:
1. Trader deposits 10,000 USDC into Arc Credit Terminal
2. Receives 10,000 credit tokens as revolving line
3. Opens Yellow state channel with 1,000 USDC allowance
4. Agent monitors margin via WebSocket connection
5. When margin drops to 200, instant off-chain top-up (800 USDC)
6. CCTP bridges 5,000 USDC from Ethereum Sepolia
7. Uniswap v4 hook executes swap with hidden order size
8. Funds arrive, credit line restored, ENS records updated

## Testnet Configuration

| Component | Network | Chain ID | Status |
|-----------|---------|----------|--------|
| Arc | Testnet | 5042002 | Live |
| Yellow | Sandbox | - | Available |
| Uniswap v4 | Arc Testnet | 5042002 | Deployable |
| CCTP | Sepolia ↔ Arc | 11155111 ↔ 5042002 | Active |
| ENS | Sepolia | 11155111 | Available |

## Key Contracts

**Arc Testnet**:
- CCTP Message Transmitter: `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`
- CCTP Token Messenger: `0xb43db544E2c27092c107639Ad201b3dEfAbcF192`
- Circle Gateway: `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`

**Yellow**:
- Sandbox Endpoint: `wss://clearnet-sandbox.yellow.com/ws`

**ENS**:
- Sepolia Registry: Standard ENS testnet deployment

## Documentation

For detailed architecture diagrams, see ARCHITECTURE.md

---

Built for HackMoney 2026
