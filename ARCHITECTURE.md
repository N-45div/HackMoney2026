# NitroBridge Vault - Technical Architecture

> Deep technical documentation for the NitroBridge Vault system

## Deployed Infrastructure

| Component | Address | Network | Block |
|-----------|---------|---------|-------|
| **ArcCreditTerminal** | `0xd1835d13A9694F0E9329FfDE9b18936CE872aae5` | Arc Testnet | 25322657 |
| USDC Token | `0x3600000000000000000000000000000000000000` | Arc Testnet | Native |
| TokenMessenger | `0xb43db544E2c27092c107639Ad201b3dEfAbcF192` | Arc Testnet | Circle |
| MessageTransmitter | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | Arc Testnet | Circle |

## System Architecture

```mermaid
graph TB
    subgraph "User Layer"
        UI[Web App - Next.js]
        CD[Credit Dashboard]
        MT[Margin Top-up UI]
        BM[Bridge Monitor]
    end

    subgraph "Smart Contracts - Arc Testnet"
        ACT[ArcCreditTerminal.sol<br/>0xd1835d13...aae5]
        ASH[AntiSniperHook.sol<br/>Uniswap v4]
    end

    subgraph "Integration Layer"
        YN[Yellow Nitrolite SDK]
        CC[Circle CCTP]
    end

    subgraph "Cross-Chain Layer"
        ES[Ethereum Sepolia<br/>Chain ID: 11155111]
        AT[Arc Testnet<br/>Chain ID: 5042002]
    end

    UI --> CD
    UI --> MT
    UI --> BM
    CD --> ACT
    MT --> YN
    BM --> CC
    YN --> ACT
    CC --> ES
    CC --> AT
    ACT --> ASH
```

## End-to-End Flow

```mermaid
sequenceDiagram
    participant Trader
    participant UI as Web App
    participant ACT as ArcCreditTerminal
    participant YN as Yellow Nitrolite
    participant Agent as Margin Agent
    participant CCTP as Circle CCTP
    participant Hook as Uniswap v4 Hook

    Trader->>UI: Deposit 10,000 USDC
    UI->>ACT: deposit(10000)
    ACT-->>Trader: Credit line opened
    
    Trader->>YN: Open state channel
    YN-->>Trader: Session with 1,000 allowance
    
    Note over Trader,Agent: Trading activity (off-chain)
    
    Agent->>YN: Monitor margin level
    YN-->>Agent: Margin = 200 (LOW!)
    
    Agent->>YN: Instant off-chain top-up
    YN-->>Trader: +800 USDC (< 100ms, $0 gas)
    
    Agent->>CCTP: Bridge 5,000 USDC
    CCTP->>ACT: Mint USDC on Arc
    
    ACT->>Hook: commit(orderHash)
    Hook->>Hook: Hide order details
    ACT->>Hook: reveal(amount, salt)
    Hook-->>ACT: Execute swap (MEV-protected)
    
    ACT-->>Trader: Credit line restored
```

## Component Architecture

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

## Data Flow

```mermaid
flowchart TD
    A[Trader deposits USDC] --> B[Arc Credit Terminal]
    B --> C{Margin Check}
    C -->|Healthy| D[Continue Trading]
    C -->|Low| E[Yellow State Channel]
    E --> F[Instant Top-up]
    F --> G[Circle CCTP Bridge]
    G --> H[Uniswap v4 Hook]
    H --> I[Hidden Swap Execution]
    I --> J[Funds Restored]
    J --> K[Credit Line Updated]
```

## Technology Stack

```mermaid
mindmap
  root((NitroBridge<br/>Vault))
    Frontend
      Next.js 14
      Wagmi v2
      Viem
      TailwindCSS
    Smart Contracts
      Arc Testnet
      Uniswap v4 Hooks
      Foundry
      OpenZeppelin
    Integrations
      Yellow Nitrolite
      Circle CCTP
      WebSocket API
    Networks
      Arc 5042002
      Sepolia 11155111
      Yellow Sandbox
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Testnet Infrastructure"
        subgraph "Arc Testnet (5042002)"
            A1[ArcCreditTerminal.sol<br/>0xd1835d13...aae5]
            A2[AntiSniperHook.sol]
            A3[PoolManager v4]
            A4[USDC 0x3600...]
        end

        subgraph "Ethereum Sepolia (11155111)"
            S1[CCTP TokenMessenger<br/>0x9f3B...dB96]
            S2[CCTP MessageTransmitter<br/>0x7865...3388]
            S3[USDC 0x1c7D...7238]
        end

        subgraph "Yellow Sandbox"
            Y1[ClearNode WebSocket]
            Y2[State Channel Manager]
        end
    end

    subgraph "Backend Services"
        B1[Margin Monitor Agent<br/>marginMonitor.js]
        B2[CCTP Bridge Service<br/>cctpBridge.js]
    end

    A1 <-->|CCTP| S1
    A2 --> A3
    B1 --> Y1
    B1 --> A1
    B2 --> S1
    B2 --> A1
```

## Smart Contract Details

### ArcCreditTerminal.sol

```mermaid
classDiagram
    class ArcCreditTerminal {
        +IERC20 usdc
        +mapping~address,CreditLine~ creditLines
        +mapping~address,bool~ authorizedAgents
        +deposit(uint256 amount) external
        +borrow(uint256 amount) external
        +agentTopUp(address user, uint256 amount) external
        +settleCredit(uint256 amount) external
        +receiveCCTP(uint256 amount, bytes32 messageHash) external
        +authorizeAgent(address agent) external
        +revokeAgent(address agent) external
    }

    class CreditLine {
        +uint256 limit
        +uint256 borrowed
        +uint256 lastActivity
    }

    ArcCreditTerminal "1" --> "*" CreditLine : manages
```

### AntiSniperHook.sol

```mermaid
classDiagram
    class AntiSniperHook {
        +IPoolManager poolManager
        +mapping~bytes32,Commitment~ commitments
        +uint256 COMMIT_DEADLINE
        +commit(bytes32 hash) external
        +reveal(uint256 amount, bytes32 salt) external
        +beforeSwap(PoolKey, SwapParams) returns(bytes4)
        +afterSwap(PoolKey, SwapParams, BalanceDelta) returns(bytes4)
        +getHookPermissions() returns(Hooks.Permissions)
    }

    class Commitment {
        +bytes32 hash
        +uint256 timestamp
        +address trader
        +bool revealed
    }

    AntiSniperHook "1" --> "*" Commitment : tracks
```

## Yellow Nitrolite Integration

```mermaid
sequenceDiagram
    participant Trader
    participant SDK as @erc7824/nitrolite
    participant ClearNode as Yellow ClearNode
    participant Contract as ArcCreditTerminal

    Note over Trader,SDK: Initialize SDK
    Trader->>SDK: createAppSessionMessage(params)
    SDK->>ClearNode: WebSocket: app_session
    ClearNode-->>SDK: Session created
    SDK-->>Trader: sessionId

    Note over Trader,ClearNode: Off-chain transfers
    Trader->>SDK: createTransferMessage(amount)
    SDK->>ClearNode: WebSocket: transfer
    ClearNode-->>SDK: State updated
    SDK-->>Trader: newBalance

    Note over Trader,Contract: Settlement
    Trader->>SDK: createSettlementMessage()
    SDK->>ClearNode: WebSocket: settle
    ClearNode->>Contract: settleOnChain(finalState)
    Contract-->>Trader: Balances finalized
```

## Circle CCTP Integration

```mermaid
sequenceDiagram
    participant User
    participant Sepolia as TokenMessenger (Sepolia)
    participant Circle as Circle Attestation API
    participant Arc as MessageTransmitter (Arc)

    User->>Sepolia: approve(messenger, amount)
    User->>Sepolia: depositForBurn(amount, 10, recipient, usdc)
    Sepolia-->>User: MessageSent(message, hash)

    Note over User,Circle: Wait for attestation (~30-60s)

    loop Poll attestation
        User->>Circle: GET /attestations/{hash}
        Circle-->>User: {status: "pending"}
    end
    
    Circle-->>User: {status: "complete", attestation: "0x..."}

    User->>Arc: receiveMessage(message, attestation)
    Arc-->>User: USDC minted on Arc
```

## Security Model

```mermaid
flowchart TB
    subgraph "Access Control"
        A[Owner] --> B[authorizeAgent]
        A --> C[revokeAgent]
        D[Authorized Agent] --> E[agentTopUp]
    end

    subgraph "Safety Mechanisms"
        F[ReentrancyGuard] --> G[All external calls]
        H[CCTP Attestation] --> I[Cross-chain messages]
        J[Commit-Reveal] --> K[Order privacy]
    end

    subgraph "State Protection"
        L[Credit limits] --> M[Prevent over-borrowing]
        N[Nonce tracking] --> O[Prevent replay]
    end
```

## API Reference

### Backend Services

| Service | File | Purpose |
|---------|------|---------|
| Margin Monitor | `marginMonitor.js` | Yellow SDK integration, margin monitoring, auto top-up |
| CCTP Bridge | `cctpBridge.js` | Cross-chain USDC bridging via Circle CCTP |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Agent wallet private key |
| `ARC_RPC_URL` | Yes | Arc testnet RPC endpoint |
| `SEPOLIA_RPC_URL` | No | Sepolia RPC endpoint |
| `YELLOW_WS_URL` | No | Yellow ClearNode WebSocket URL |

### Contract ABIs

See `contracts/arc-credit/out/` for compiled ABIs after running `forge build`.

