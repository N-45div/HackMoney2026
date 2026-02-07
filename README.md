# NitroBridge Vault

> **Instant cross-chain margin refills with sub-second state channel settlements and MEV-protected execution**

## The Problem

Traders with capital across multiple chains face catastrophic margin calls:

| Pain Point | Current Reality | Impact |
|------------|-----------------|--------|
| **Bridge Latency** | 5-15 minute finality | Position liquidated before funds arrive |
| **MEV Extraction** | Public refill signals | Bots frontrun, increasing costs 2-5% |
| **Fragmented Liquidity** | USDC on wrong chain | Manual bridging, multiple gas tokens |
| **No Credit Memory** | Every tx starts fresh | Perfect repayers treated like new users |

**A $50,000 margin call with 5-minute bridge time = guaranteed liquidation.**

## The Solution

NitroBridge Vault combines three breakthrough technologies:

```mermaid
graph TB
    subgraph "Integration Layer"
        Y[Yellow Nitrolite<br/>State Channels<br/>⚡ <100ms, Zero gas]
        C[Circle CCTP<br/>Native USDC Bridge<br/>🌉 Sepolia ↔ Arc]
        U[Uniswap v4 Hooks<br/>Commit-Reveal<br/>🔒 MEV Protection]
    end
    
    subgraph "Core Protocol"
        ACT[ArcCreditTerminal<br/>Revolving Credit<br/>Agent-Authorized<br/>Auto-Refill]
    end
    
    Y --> ACT
    C --> ACT
    U --> ACT
```

## Architecture Overview

```mermaid
graph TB
    subgraph "Presentation Layer"
        UI[Next.js + wagmi]
        CD[Credit Dashboard]
        MT[Margin Top-Up]
        BM[Bridge Monitor]
    end
    
    subgraph "Smart Contracts - Arc Testnet"
        ACT[ArcCreditTerminal.sol<br/>0xd1835d13A9694F0E9329FfDE9b18936CE872aae5]
        ASH[AntiSniperHook.sol<br/>Uniswap v4]
    end
    
    subgraph "Backend Services"
        MM[Margin Monitor Agent<br/>marginMonitor.js]
        CB[CCTP Bridge Service<br/>cctpBridge.js]
    end
    
    subgraph "External Protocols"
        YN[Yellow ClearNode<br/>wss://clearnet-sandbox.yellow.com]
        CCTP[Circle CCTP<br/>Sepolia ↔ Arc]
        V4[Uniswap v4<br/>PoolManager]
    end
    
    UI --> CD
    UI --> MT
    UI --> BM
    CD --> ACT
    MT --> MM
    BM --> CB
    MM --> YN
    MM --> ACT
    CB --> CCTP
    ACT --> ASH
    ASH --> V4
```

## Transaction Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Web App
    participant ACT as ArcCreditTerminal
    participant YN as Yellow ClearNode
    participant CCTP as Circle CCTP
    participant Hook as AntiSniperHook

    User->>UI: 1. Deposit 10,000 USDC
    UI->>ACT: depositToCreditLine(10000)
    ACT-->>User: Credit line: 10,000 USDC
    
    User->>UI: 2. Connect to Yellow Network
    UI->>YN: createAuthRequest + EIP-712 sign
    YN-->>User: Authenticated 
    User->>UI: 3. Create Payment Session
    UI->>YN: createAppSessionMessage
    YN-->>User: Session ID + allocations
    
    User->>UI: 4. Send Instant Transfer (10 USDC)
    UI->>YN: createTransferMessage
    YN-->>User: Transfer confirmed (<100ms, $0 gas)
    
    User->>UI: 5. Bridge from Sepolia
    UI->>CCTP: depositForBurn on Sepolia
    CCTP->>CCTP: Attestation (30-60s)
    UI->>ACT: receiveMessage on Arc
    ACT-->>User: USDC minted on Arc 
    User->>UI: 6. MEV-Protected Order
    UI->>Hook: commit(hash)
    Hook-->>User: Commitment stored
    Note over Hook: Wait 1 block
    UI->>Hook: reveal(amount, nonce)
    Hook-->>User: Reveal verified 
```

## Smart Contract Architecture

```mermaid
classDiagram
    class ArcCreditTerminal {
        +IERC20 usdc
        +mapping creditLines
        +mapping authorizedAgents
        +deposit(amount)
        +borrow(amount)
        +agentTopUp(user, amount)
        +settleCredit(amount)
        +receiveCCTP(amount, messageHash)
    }
    
    class AntiSniperHook {
        +mapping commitments
        +uint256 commitDeadline
        +commit(hash)
        +reveal(amount, salt)
        +beforeSwap(key, params)
        +afterSwap(key, params, delta)
    }
    
    class CreditLine {
        +uint256 limit
        +uint256 borrowed
        +uint256 lastActivity
    }
    
    ArcCreditTerminal --> CreditLine
    ArcCreditTerminal --> AntiSniperHook
```

## Yellow State Channel Flow

```mermaid
sequenceDiagram
    participant Trader
    participant ClearNode as Yellow ClearNode
    participant Agent as Margin Agent
    
    Trader->>ClearNode: createAppSessionMessage()
    ClearNode-->>Trader: Session opened
    
    Note over Trader,ClearNode: Off-chain state channel<br/>Trader: 1,000 USDC<br/>Agent Allowance: 1,000 USDC
    
    Agent->>ClearNode: Monitor margin
    ClearNode-->>Agent: Margin low (200 USDC)
    
    Agent->>ClearNode: offChainTransfer(800)
    ClearNode-->>Trader: +800 USDC (instant)
    
    Note over Trader,ClearNode: Updated state<br/>Trader: 1,800 USDC<br/>Agent Allowance: 200 USDC
    
    Trader->>ClearNode: settleOnChain()
    ClearNode-->>Trader: Final balances on Arc
```

## Circle CCTP Bridge Flow

```mermaid
sequenceDiagram
    participant User
    participant Sepolia as Ethereum Sepolia
    participant Circle as Circle Attestation
    participant Arc as Arc Testnet
    
    User->>Sepolia: approve(TokenMessenger, amount)
    User->>Sepolia: depositForBurn(amount, domain=10, recipient)
    Sepolia-->>Circle: MessageSent event
    
    loop Poll for attestation
        User->>Circle: GET /attestations/{hash}
        Circle-->>User: status: pending
    end
    
    Circle-->>User: status: complete, attestation: 0x...
    
    User->>Arc: receiveMessage(message, attestation)
    Arc-->>User: USDC minted on Arc
```

## Component Integration

```mermaid
graph LR
    subgraph "Arc Credit Terminal"
        A[deposit]
        B[borrow]
        C[agentTopUp]
        D[settleCredit]
        E[receiveCCTP]
    end
    
    subgraph "Yellow Integration"
        F[createSession]
        G[offChainTransfer]
        H[settleOnChain]
    end
    
    subgraph "Uniswap v4 Hook"
        I[commit]
        J[reveal]
        K[beforeSwap]
        L[afterSwap]
    end
    
    subgraph "Circle CCTP"
        M[depositForBurn]
        N[fetchAttestation]
        O[receiveMessage]
    end
    
    A --> F
    C --> G
    G --> H
    H --> E
    E --> I
    I --> J
    J --> K
    K --> L
    D --> M
    M --> N
    N --> O
    O --> E
```

## Deployed Contracts

| Contract | Network | Address | Tx Hash |
|----------|---------|---------|---------|
| **ArcCreditTerminal** | Arc Testnet | `0xd1835d13A9694F0E9329FfDE9b18936CE872aae5` | `0xf30bfc37a23013a8f68d2b5375f5f5b19ddc5934b889923d91ba91462b61970f` |
| USDC | Arc Testnet | `0x3600000000000000000000000000000000000000` | Native |
| TokenMessenger | Arc Testnet | `0xb43db544E2c27092c107639Ad201b3dEfAbcF192` | Circle |
| MessageTransmitter | Arc Testnet | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | Circle |

## Project Structure

```
HackMoney2026/
├── contracts/
│   ├── arc-credit/
│   │   ├── src/
│   │   │   └── ArcCreditTerminal.sol      # Core credit line logic
│   │   ├── script/
│   │   │   └── Deploy.s.sol               # Deployment script
│   │   └── foundry.toml                   # Foundry config
│   │
│   └── uniswap-hook/
│       ├── src/
│       │   └── AntiSniperHook.sol         # MEV protection hook
│       └── script/
│           └── DeployHook.s.sol           # Hook deployment
│
├── backend/
│   ├── marginMonitor.js                   # Yellow SDK integration
│   ├── cctpBridge.js                      # Circle CCTP bridge
│   └── package.json
│
├── frontend/
│   ├── app/                               # Next.js app router
│   ├── components/
│   │   ├── CreditDashboard.tsx            # Credit line UI
│   │   ├── MarginTopUp.tsx                # Top-up interface
│   │   └── ConnectWallet.tsx              # Wallet connection
│   └── package.json
│
└── README.md
```

## Quick Start (Judges & Demo)

### Frontend Only (Recommended for Testing)

```bash
# 1. Clone repository
git clone https://github.com/N-45div/HackMoney2026.git
cd HackMoney2026/frontend

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Open http://localhost:3000 and connect your wallet
# - Arc Testnet: Get USDC from faucet
# - Sepolia: Get test ETH + USDC from faucets
```

### Required Setup

1. **Add Networks to MetaMask:**
   - **Arc Testnet**: Chain ID `5042002`, RPC `https://rpc.testnet.arc.network`
   - **Ethereum Sepolia**: Chain ID `11155111` (auto-configured by MetaMask)

2. **Get Test Tokens:**
   - Arc USDC: [Arc Testnet Faucet](https://testnet.arcscan.app/faucet)
   - Sepolia ETH: [Sepolia Faucet](https://sepoliafaucet.com/)
   - Sepolia USDC: Use contract `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

### What You Can Test

| Tab | Feature | Networks |
|-----|---------|----------|
| **Deposit** | Deposit USDC → Get credit line | Arc Testnet |
| **Borrow/Repay** | Borrow against deposit, repay debt | Arc Testnet |
| **CCTP Bridge** | Bridge USDC Sepolia → Arc | Sepolia + Arc |
| **Yellow Channel** | Off-chain instant transfers | Any (WebSocket) |
| **MEV Shield** | Commit-reveal anti-frontrunning | Sepolia |

## Environment Variables

```bash
# Required
PRIVATE_KEY=0x...                    # Agent wallet private key
ARC_RPC_URL=https://rpc.testnet.arc.network

# Optional
SEPOLIA_RPC_URL=https://rpc.sepolia.org
YELLOW_WS_URL=wss://clearnet-sandbox.yellow.com/ws
```

## Network Configuration

| Network | Chain ID | RPC URL | Explorer |
|---------|----------|---------|----------|
| Arc Testnet | 5042002 | `https://rpc.testnet.arc.network` | [Explorer](https://explorer.testnet.arc.network) |
| Sepolia | 11155111 | `https://rpc.sepolia.org` | [Etherscan](https://sepolia.etherscan.io) |
| Yellow Sandbox | - | `wss://clearnet-sandbox.yellow.com/ws` | - |

## Technical Specifications

- **Settlement Time**: < 100ms (Yellow state channel) / 30-60s (CCTP bridge)
- **Gas Cost**: $0 for off-chain transfers / ~$0.04 for on-chain settlement
- **Supported Assets**: USDC (native via Circle CCTP)
- **Credit Limit**: Configurable per user (default: 100% of deposit)
- **Collateral Ratio**: 100% (fully collateralized credit line)

## Security Considerations

1. **State Channel Security**: All off-chain states are cryptographically signed
2. **CCTP Attestation**: Circle validates every cross-chain message
3. **Commit-Reveal**: Order details hidden until execution
4. **Agent Authorization**: Only whitelisted agents can trigger top-ups
5. **Reentrancy Protection**: All contracts use OpenZeppelin's ReentrancyGuard

---

**NitroBridge Vault** — *Because your margin shouldn't wait for finality.*
